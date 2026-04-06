import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { ChoppingBlock } from '../ChoppingBlock';
import { UserProfile } from '../../types';

export default function ChoppingBlockPage() {
  const { user, profile } = useAuthContext();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map((d) => d.data() as UserProfile));
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-8">
      <ChoppingBlock user={user} profile={profile} allUsers={allUsers} />
    </div>
  );
}
