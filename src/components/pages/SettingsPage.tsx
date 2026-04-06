import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import {
  Button,
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Chip,
  ChipLabel,
  Switch,
  SwitchControl,
  SwitchThumb,
} from '@heroui/react';
import { Settings, Bell, User, Shield, Moon, Sun } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, setProfile } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');

  const emailNotifications = profile?.preferences?.emailNotifications ?? true;
  const pushNotifications = profile?.preferences?.pushNotifications ?? true;

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

  const handleToggleNotification = async (key: 'emailNotifications' | 'pushNotifications') => {
    if (!user || !profile) return;
    const current = profile.preferences?.[key] ?? true;
    const newPrefs = { ...profile.preferences, [key]: !current };
    try {
      await updateDoc(doc(db, 'users', user.uid), { preferences: newPrefs });
      setProfile((prev) => (prev ? { ...prev, preferences: newPrefs } : prev));
    } catch (err) {
      console.error('Failed to update preferences:', err);
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
      <Card className="glass rounded-2xl animate-slide-up-fade">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <User size={20} className="text-[hsl(var(--text-muted))]" />
            <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Profile</h3>
          </div>

          <div className="flex items-center gap-6">
            <Avatar className="h-16 w-16 border-2 border-[hsl(var(--border-default))] shadow-md">
              <AvatarImage src={profile?.photoURL} alt={profile?.name} className="object-cover" referrerPolicy="no-referrer" />
              <AvatarFallback className="text-xl font-bold">{profile?.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-[hsl(var(--text-muted))]">Email</p>
              <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{profile?.email || user?.email}</p>
              <p className="text-sm text-[hsl(var(--text-muted))] mt-2">Role</p>
              <Chip className="mt-0.5 bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)]">
                <ChipLabel className="text-xs font-bold text-white uppercase">{profile?.role}</ChipLabel>
              </Chip>
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
              <Button
                variant="primary"
                onPress={handleSaveName}
                isDisabled={saving || editName.trim() === profile?.name}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="glass rounded-2xl animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-[hsl(var(--text-muted))]" />
            <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Notifications</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Email Notifications</p>
                <p className="text-xs text-[hsl(var(--text-muted))]">Receive updates via email</p>
              </div>
              <Switch
                isSelected={emailNotifications}
                onChange={() => handleToggleNotification('emailNotifications')}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
              </Switch>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Push Notifications</p>
                <p className="text-xs text-[hsl(var(--text-muted))]">Receive browser push notifications</p>
              </div>
              <Switch
                isSelected={pushNotifications}
                onChange={() => handleToggleNotification('pushNotifications')}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
              </Switch>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="glass rounded-2xl animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon size={20} className="text-[hsl(var(--text-muted))]" />
            ) : (
              <Sun size={20} className="text-[hsl(var(--text-muted))]" />
            )}
            <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Appearance</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Dark Mode</p>
              <p className="text-xs text-[hsl(var(--text-muted))]">
                {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
              </p>
            </div>
            <Switch
              isSelected={theme === 'dark'}
              onChange={toggleTheme}
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
            </Switch>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="glass rounded-2xl animate-slide-up-fade" style={{ animationDelay: '150ms' }}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-[hsl(var(--text-muted))]" />
            <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Security</h3>
          </div>
          <p className="text-sm text-[hsl(var(--text-muted))]">
            You are signed in via Google. Your authentication is managed by Google's secure OAuth 2.0 system.
          </p>
          <div className="flex items-center gap-3 rounded-xl inset-well p-4">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Google Account</p>
              <p className="text-xs text-[hsl(var(--text-muted))]">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
