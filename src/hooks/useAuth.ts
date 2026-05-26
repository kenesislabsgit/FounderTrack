import { useState, useEffect, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

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
    // 1. Fetch initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const sbUser = session?.user ?? null;
        const compUser = makeCompatibleUser(sbUser);
        setUser(compUser);

        if (sbUser) {
          await fetchOrCreateProfile(sbUser);
        }
      } catch (error) {
        console.error('Error initializing Supabase Auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to session shifts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sbUser = session?.user ?? null;
      const compUser = makeCompatibleUser(sbUser);
      setUser(compUser);

      if (sbUser) {
        setLoading(true);
        await fetchOrCreateProfile(sbUser);
        setLoading(false);
      } else {
        setProfile(null);
        setShowRoleSelection(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [makeCompatibleUser]);

  const fetchOrCreateProfile = async (sbUser: SupabaseUser) => {
    try {
      const { data: userDoc, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', sbUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile from public.users:', error.message);
        return;
      }

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
        if (!profileData.role) {
          setShowRoleSelection(true);
        }
      } else {
        // Atomic first-user-becomes-admin check using settings key uniqueness constraint
        const firstProfile: UserProfile = {
          uid: sbUser.id,
          name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'Admin',
          email: sbUser.email || '',
          role: 'admin',
          photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || undefined,
        };

        // Try to fetch the sentinel first
        const { data: sentinelDoc } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'admin-assigned')
          .maybeSingle();

        if (!sentinelDoc) {
          // Attempt to atomically claim the admin spot by inserting the unique settings record
          const { error: insertSentinelErr } = await supabase
            .from('settings')
            .insert({
              id: 'admin-assigned',
              value: { uid: sbUser.id, assignedAt: new Date().toISOString() },
            });

          if (!insertSentinelErr) {
            // Successfully claimed! Write user profile as admin
            const { error: insertUserErr } = await supabase.from('users').insert({
              uid: sbUser.id,
              name: firstProfile.name,
              email: firstProfile.email,
              role: 'admin',
              photo_url: firstProfile.photoURL || null,
            });

            if (!insertUserErr) {
              setProfile(firstProfile);
              setShowRoleSelection(false);
              return;
            }
          }
        }

        // Admin spot is already claimed or insert failed -> trigger standard role selection
        setShowRoleSelection(true);
      }
    } catch (err) {
      console.error('Error during fetchOrCreateProfile:', err);
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
    supabase.auth.signOut().catch((err) => console.error('Logout error:', err));
  }, []);

  const handleRoleSelect = useCallback(
    async (selectedRole: 'founder' | 'admin' | 'employee' | 'intern') => {
      if (!user) return;
      const newProfile: UserProfile = {
        uid: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
        email: user.email || '',
        role: selectedRole,
        photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
      };
      try {
        const { error } = await supabase.from('users').upsert({
          uid: user.id,
          name: newProfile.name,
          email: newProfile.email,
          role: selectedRole,
          photo_url: newProfile.photoURL || null,
        });

        if (error) throw error;

        setProfile(newProfile);
        setShowRoleSelection(false);
      } catch (err) {
        console.error('Error setting role:', err);
        throw err;
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
