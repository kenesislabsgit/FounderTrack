import { useState, useEffect, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, clearQueryCache } from '../lib/supabase';
import { UserProfile } from '../types';

/** Roles that new users are allowed to self-select. Admin/founder must be assigned by an existing admin. */
const SELF_SELECT_ROLES: Array<'employee' | 'intern'> = ['employee', 'intern'];

export type CompatibleUser = SupabaseUser & {
  uid: string;
  getIdToken: () => Promise<string>;
};

export interface UseAuthReturn {
  user: CompatibleUser | null;
  profile: UserProfile | null;
  loading: boolean;
  showRoleSelection: boolean;
  login: () => Promise<void>;
  logout: () => void;
  handleRoleSelect: (role: 'founder' | 'admin' | 'employee' | 'intern') => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<CompatibleUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  // Helper to construct a CompatibleUser from a SupabaseUser
  const makeCompatibleUser = useCallback((sbUser: SupabaseUser | null): CompatibleUser | null => {
    if (!sbUser) return null;
    return {
      ...sbUser,
      uid: sbUser.id, // compatibility alias
      getIdToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || '';
      },
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    // Failsafe: Ensure loading is cleared after 5 seconds no matter what
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // Helper to fetch session and profile
    const syncAuth = async (sbUser: SupabaseUser | null) => {
      if (!mounted) return;
      const compUser = makeCompatibleUser(sbUser);
      setUser(compUser);

      if (sbUser) {
        try {
          await fetchOrCreateProfile(sbUser);
        } catch (err) {
          console.error('[Auth] Critical error syncing profile:', err);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setProfile(null);
        setShowRoleSelection(false);
        if (mounted) setLoading(false);
      }
    };

    // 1. Initial Sync
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncAuth(session?.user ?? null);
    });

    // 2. Listen to session shifts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        syncAuth(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        syncAuth(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [makeCompatibleUser]);

  const fetchOrCreateProfile = async (sbUser: SupabaseUser) => {
    console.log('[Auth] fetchOrCreateProfile called for user:', sbUser.id, sbUser.email);
    try {
      // 1. Search by UID first
      let { data: userDoc, error: readError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', sbUser.id)
        .maybeSingle();

      console.log('[Auth] User doc from DB:', userDoc);
      if (readError) {
        console.error('[Auth] DB Read Error:', readError.message);
      }

      // 2. If not found by UID, just create new profile (skip UID migration check)
      // Old Firebase users will be handled by the SQL migration script

      if (userDoc) {
        const profileData: UserProfile = {
          uid: userDoc.uid,
          name: userDoc.name,
          email: userDoc.email,
          role: userDoc.role,
          photoURL: userDoc.photo_url || undefined,
          preferences: userDoc.preferences || undefined,
        };
        setProfile(profileData);
        setShowRoleSelection(!profileData.role || profileData.role.trim() === '');
      } else {
        // Not found by UID, try by email (Firebase migration case)
        const { data: emailMatch } = await supabase
          .from('users')
          .select('*')
          .eq('email', sbUser.email)
          .maybeSingle();

        if (emailMatch) {
          console.log('[Auth] Found profile by email (old Firebase user). Migrating data...');
          try {
            const response = await fetch('/api/migrate-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: sbUser.email,
                newUid: sbUser.id,
                selectedRole: emailMatch.role || 'employee',
              }),
            });

            if (!response.ok) {
              throw new Error(`Migration API returned status ${response.status}`);
            }

            const migrationData = await response.json();
            console.log('[Auth] Migration completed successfully:', migrationData);

            // Fetch newly migrated profile
            const { data: newDoc } = await supabase
              .from('users')
              .select('*')
              .eq('uid', sbUser.id)
              .maybeSingle();

            if (newDoc) {
              const profileData: UserProfile = {
                uid: newDoc.uid,
                name: newDoc.name,
                email: newDoc.email,
                role: newDoc.role,
                photoURL: newDoc.photo_url || undefined,
                preferences: newDoc.preferences || undefined,
              };
              setProfile(profileData);
              setShowRoleSelection(false);
              return;
            }
          } catch (err) {
            console.error('[Auth] Migration failed, falling back to local fallback session:', err);
          }

          // Fallback: load user locally even if DB migration failed
          const profileData: UserProfile = {
            uid: sbUser.id,
            name: emailMatch.name,
            email: emailMatch.email,
            role: emailMatch.role,
            photoURL: emailMatch.photo_url || undefined,
            preferences: emailMatch.preferences || undefined,
          };
          setProfile(profileData);
          setShowRoleSelection(false);
          return;
        }

        // Truly new user - create profile
        const firstProfile: UserProfile = {
          uid: sbUser.id,
          name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
          email: sbUser.email || '',
          role: 'admin',
          photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || undefined,
        };

        // Attempt to claim admin spot
        const { error: insertSentinelErr } = await supabase
          .from('settings')
          .insert({
            id: 'admin-assigned',
            value: { uid: sbUser.id, assignedAt: new Date().toISOString() },
          });

        const isNewAdmin = !insertSentinelErr;
        const targetRole: UserProfile['role'] = isNewAdmin ? 'admin' : 'employee';

        const { error: insertUserErr } = await supabase.from('users').insert({
          uid: sbUser.id,
          name: firstProfile.name,
          email: firstProfile.email,
          role: targetRole,
          photo_url: firstProfile.photoURL || null,
        });

        if (!insertUserErr) {
          const finalProfile = { ...firstProfile, role: targetRole };
          setProfile(finalProfile);
          // Only show role selection if we couldn't determine a role (shouldn't happen with default 'employee')
          setShowRoleSelection(false);
          return;
        } else {
          console.error('[Auth] Failed to create user profile:', insertUserErr.message);
          // If insert fails (likely 409 email conflict), show role selection as a fallback
          // handleRoleSelect will deal with the upsert/conflict
          setShowRoleSelection(true);
        }
      }
    } catch (err) {
      console.error('[Auth] fetchOrCreateProfile exception:', err);
    }
  };

  const login = useCallback(async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
          },
          redirectTo: window.location.origin,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  }, []);

  const logout = useCallback(() => {
    // Clear the in-memory query cache before signing out to prevent
    // the next user's session from seeing this user's data.
    clearQueryCache();
    supabase.auth.signOut().catch((err) => console.error('Logout error:', err));
  }, []);

  const handleRoleSelect = useCallback(
    async (selectedRole: 'founder' | 'admin' | 'employee' | 'intern') => {
      if (!user) return;
      setLoading(true);

      // Security: Only allow safe self-select roles. Admin/founder must be
      // assigned by an existing admin via TeamManagementPage.
      const safeRole: 'employee' | 'intern' = SELF_SELECT_ROLES.includes(selectedRole as any)
        ? (selectedRole as 'employee' | 'intern')
        : 'employee';


      const newProfile: UserProfile = {
        uid: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
        email: user.email || '',
        role: safeRole,
        photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
      };

      try {
        const { error } = await supabase.from('users').upsert({
          uid: user.id,
          name: newProfile.name,
          email: newProfile.email,
          role: safeRole,
          photo_url: newProfile.photoURL || null,
        }, { onConflict: 'uid' });

        if (error) throw error;

        setProfile(newProfile);
        setShowRoleSelection(false);
      } catch (err) {
        console.error('[Auth] Error setting role:', err);
        alert('Failed to save role. Please try again or contact admin.');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return {
    user,
    profile,
    loading,
    showRoleSelection,
    login,
    logout,
    handleRoleSelect,
    setProfile,
  };
}
