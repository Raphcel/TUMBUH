import React from 'react';

export function WorkspaceCard({ title, eyebrow, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-[#E6ECF5] bg-white ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6ECF5] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              {React.createElement(Icon, { size: 18 })}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-text-light">{eyebrow}</p>}
            <h2 className="text-base font-semibold text-text">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusPill({ children, tone = 'neutral' }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-[#E6ECF5] bg-[#E6ECF5] text-text-muted',
    brand: 'border-brand/20 bg-brand/10 text-brand',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}
