import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { Settings, Bell, User, Shield, Moon, Sun } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, setProfile } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');

  const handleSaveName = async () => {
    if (!user || !profile || !editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: editName.trim() });
      setProfile((prev) => (prev ? { ...prev, name: editName.trim() } : prev));
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] flex items-center gap-3">
          <Settings size={24} />
          Account Settings
        </h2>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Manage your profile and preferences.</p>
      </div>

      {/* Profile Section */}
      <div className="glass rounded-2xl p-6 space-y-6 animate-slide-up-fade">
        <div className="flex items-center gap-3">
          <User size={20} className="text-[hsl(var(--text-muted))]" />
          <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Profile</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center text-xl font-bold overflow-hidden border-2 border-[hsl(var(--border-default))] shadow-md text-[hsl(var(--text-primary))]">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile?.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile?.name?.[0] || 'U'
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-[hsl(var(--text-muted))]">Email</p>
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{profile?.email || user?.email}</p>
            <p className="text-sm text-[hsl(var(--text-muted))] mt-2">Role</p>
            <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase mt-0.5 bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] text-white">
              {profile?.role}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Display Name</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 rounded-xl inset-well px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
              placeholder="Your display name"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || editName.trim() === profile?.name}
              className="rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="glass rounded-2xl p-6 space-y-6 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-[hsl(var(--text-muted))]" />
          <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl inset-well p-4">
            <p className="text-sm text-[hsl(var(--text-muted))]">
              Email and push notifications are not yet available. In-app notifications are delivered automatically via the notification bell in the header.
            </p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass rounded-2xl p-6 space-y-6 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-3">
          {theme === 'dark' ? <Moon size={20} className="text-[hsl(var(--text-muted))]" /> : <Sun size={20} className="text-[hsl(var(--text-muted))]" />}
          <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Dark Mode</p>
            <p className="text-xs text-[hsl(var(--text-muted))]">{theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}</p>
          </div>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'dark'}
            className={`relative h-7 w-12 rounded-full transition-colors ${theme === 'dark' ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border-default))]'}`}
          >
            <span className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}>
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
            </span>
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="glass rounded-2xl p-6 space-y-4 animate-slide-up-fade" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-[hsl(var(--text-muted))]" />
          <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Security</h3>
        </div>
        <p className="text-sm text-[hsl(var(--text-muted))]">You are signed in via Google. Your authentication is managed by Google's secure OAuth 2.0 system.</p>
        <div className="flex items-center gap-3 rounded-xl inset-well p-4">
          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Google Account</p>
            <p className="text-xs text-[hsl(var(--text-muted))]">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
