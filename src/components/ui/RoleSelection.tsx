/**
 * RoleSelection — full-screen overlay for new users to pick their role.
 *
 * Per Requirement 14.3 only "employee" and "intern" are offered.
 * The "founder" option has been intentionally removed.
 */

export interface RoleSelectionProps {
  /** Called when the user picks a role */
  onSelect: (role: 'employee' | 'intern') => void;
}

const roles = [
  {
    id: 'employee' as const,
    label: 'Employee',
    desc: 'Track your daily work, tasks, and leave.',
  },
  {
    id: 'intern' as const,
    label: 'Intern',
    desc: 'Log your working hours and daily progress.',
  },
];

export function RoleSelection({ onSelect }: RoleSelectionProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--bg-primary))]/90 backdrop-blur-md p-6">
      <div className="w-full max-w-2xl animate-scale-in">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-[hsl(var(--text-primary))] mb-4 uppercase tracking-tighter">
            Choose Your Role
          </h2>
          <p className="text-[hsl(var(--text-muted))] text-lg">
            Select your position to customize your experience.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className="group relative overflow-hidden rounded-3xl glass-elevated cursor-pointer hover:border-[hsl(var(--accent))]/50 transition-all hover:-translate-y-[0.5px] hover:shadow-[0_0_12px_hsla(var(--accent),0.25)]"
              onClick={() => onSelect(role.id)}
            >
              <div className="p-8 text-left">
                <h3 className="text-2xl font-bold text-[hsl(var(--text-primary))] mb-2">
                  {role.label}
                </h3>
                <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed">
                  {role.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
