import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import {
  Button,
  Skeleton,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Chip,
  ChipLabel,
} from '@heroui/react';
import { Users, Shield, Edit2, Check, X } from 'lucide-react';

export default function TeamManagementPage() {
  const { profile } = useAuthContext();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserProfile['role']>('employee');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map((d) => d.data() as UserProfile));
      setLoading(false);
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, []);

  const handleEditRole = (user: UserProfile) => {
    setEditingUid(user.uid);
    setEditRole(user.role);
  };

  const handleSaveRole = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: editRole });
      setEditingUid(null);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const roleColors: Record<string, string> = {
    founder: 'bg-purple-100 text-purple-700',
    admin: 'bg-orange-100 text-orange-700',
    employee: 'bg-blue-100 text-blue-700',
    intern: 'bg-green-100 text-green-700',
  };

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Team Management</h2>
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl glass p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/4 mb-2 rounded-lg" />
                  <Skeleton className="h-3 w-1/3 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] flex items-center gap-3">
          <Users size={24} />
          Team Management
        </h2>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
          Manage team members and their roles. {allUsers.length} members total.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['founder', 'admin', 'employee', 'intern'] as const).map((role) => {
          const count = allUsers.filter((u) => u.role === role).length;
          return (
            <div key={role} className="rounded-2xl glass p-4 text-center animate-slide-up-fade">
              <p className="text-2xl font-black text-[hsl(var(--text-primary))]">{count}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] mt-1">{role}s</p>
            </div>
          );
        })}
      </div>

      {/* Team List */}
      <div className="rounded-2xl glass overflow-hidden animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))]">
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Member</th>
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Email</th>
              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Role</th>
              <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <tr key={u.uid} className="border-b border-[hsl(var(--border-subtle))] hover:bg-[hsla(var(--accent),0.05)] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.photoURL} alt={u.name} className="object-cover" referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-xs font-bold">{u.name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-[hsl(var(--text-primary))]">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[hsl(var(--text-muted))]">{u.email}</td>
                <td className="px-6 py-4">
                  {editingUid === u.uid ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserProfile['role'])}
                      className="rounded-lg inset-well px-3 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))]"
                    >
                      <option value="founder">Founder</option>
                      <option value="admin">Admin</option>
                      <option value="employee">Employee</option>
                      <option value="intern">Intern</option>
                    </select>
                  ) : (
                    <Chip className={`${roleColors[u.role]} rounded-full`}>
                      <ChipLabel className="text-[10px] font-bold uppercase">{u.role}</ChipLabel>
                    </Chip>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingUid === u.uid ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => handleSaveRole(u.uid)}
                        className="bg-gradient-to-b from-[hsl(145,70%,50%)] to-[hsl(145,70%,42%)] p-1.5"
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setEditingUid(null)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    profile?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleEditRole(u)}
                      >
                        <Edit2 size={14} />
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
