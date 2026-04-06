import { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import type { ToastItem } from './ToastProvider';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

const variantConfig: Record<
  ToastVariant,
  { icon: typeof Info; bg: string; border: string; text: string; iconColor: string }
> = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-green-50 dark:bg-green-950/60',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    iconColor: 'text-green-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 dark:bg-yellow-950/60',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-950/60',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    iconColor: 'text-red-500',
  },
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role="alert"
      data-variant={toast.variant}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${config.bg} ${config.border}`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className={`text-sm flex-1 ${config.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity ${config.text}`}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
