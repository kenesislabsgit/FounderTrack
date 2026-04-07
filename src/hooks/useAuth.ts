import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

export interface UseAuthReturn {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  showRoleSelection: boolean;
  login: () => Promise<void>;
  logout: () => void;
  handleRoleSelect: (role: 'founder' | 'admin' | 'employee' | 'intern') => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            setProfile(profileData);
            if (!profileData.role) {
              setShowRoleSelection(true);
            }
          } else {
            // Atomic first-user-becomes-admin using sentinel document as lock
            const firstProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              email: firebaseUser.email || '',
              role: 'admin',
              photoURL: firebaseUser.photoURL || undefined,
            };

            const result = await runTransaction(db, async (transaction) => {
              const sentinelRef = doc(db, 'settings', 'admin-assigned');
              const sentinelDoc = await transaction.get(sentinelRef);

              if (!sentinelDoc.exists()) {
                transaction.set(sentinelRef, { uid: firebaseUser.uid, assignedAt: new Date() });
                transaction.set(doc(db, 'users', firebaseUser.uid), firstProfile);
                return 'admin-assigned';
              } else {
                return 'not-admin';
              }
            });

            if (result === 'admin-assigned') {
              setProfile(firstProfile);
              setShowRoleSelection(false);
            } else {
              setShowRoleSelection(true);
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setProfile(null);
        setShowRoleSelection(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  }, []);

  const logout = useCallback(() => {
    signOut(auth);
  }, []);

  const handleRoleSelect = useCallback(
    async (selectedRole: 'founder' | 'admin' | 'employee' | 'intern') => {
      if (!user) return;
      const newProfile: UserProfile = {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email || '',
        role: selectedRole,
        photoURL: user.photoURL || undefined,
      };
      try {
        await setDoc(doc(db, 'users', user.uid), newProfile);
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
