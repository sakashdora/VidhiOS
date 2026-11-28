import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-hairline">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#e6f2f2] dark:bg-[#132e31] text-teal-accent border border-[#0d5c63]/20 dark:border-[#57c5cc]/25">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'teal' | 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    teal: 'bg-[#e6f2f2] dark:bg-[#132e31] text-[#0d5c63] dark:text-[#57c5cc] border-[#0d5c63]/20',
    success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    danger: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50',
    neutral: 'bg-[#f4f2ec] dark:bg-[#1c2628] text-ink-secondary border-stone-hairline',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="neu-empty rounded-xl py-10 px-6 text-center space-y-2.5">
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-stone-hairline flex items-center justify-center mx-auto text-teal-accent">
          {icon}
        </div>
      )}
      <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300 flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-red-600 dark:text-red-300 hover:opacity-75"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function InfoBanner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
        : 'border-stone-hairline bg-[var(--surface-inset)] text-ink-secondary';
  return (
    <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${cls}`}>
      {tone === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
      ) : tone === 'warning' ? (
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
      ) : (
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-accent" />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function LoadingPanel({ label = 'Loading module...' }: { label?: string }) {
  return (
    <div className="neu-card rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-xs text-ink-muted">
      <Loader2 className="w-5 h-5 animate-spin text-teal-accent" />
      <span>{label}</span>
    </div>
  );
}
