import { useState, useEffect } from 'react';
import { supabase, subscribeToTable } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { ChoppingBlock } from '../ChoppingBlock';
import { UserProfile } from '../../types';
import { mapUserDbToProfile } from '../../services/dataService';

export default function ChoppingBlockPage() {
  const { user, profile } = useAuthContext();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToTable<any>('users', {}, (data) => {
      setAllUsers(data.map(mapUserDbToProfile));
    });
    return unsubscribe;
  }, []);

  return (
    <div className="p-8">
      <ChoppingBlock user={user} profile={profile} allUsers={allUsers} />
    </div>
  );
}
