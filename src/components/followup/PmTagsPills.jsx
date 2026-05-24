import React from 'react';

/**
 * PmTagsPills — renders one pill per PM tag.
 * Accepts a comma-separated label string (from string_agg) and splits it.
 * `max` caps visible pills; the rest collapse into a "+N" pill (with tooltip).
 */
export default function PmTagsPills({ label, max = 2 }) {
  if (!label) return <span className="text-[#A3A3A3] text-xs">—</span>;

  const tags = String(label)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (tags.length === 0) return <span className="text-[#A3A3A3] text-xs">—</span>;

  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;

  return (
    <div className="inline-flex flex-wrap gap-1 max-w-full" title={tags.join(' · ')}>
      {visible.map((t, i) => (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200 whitespace-nowrap"
          title={t}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]"
          title={tags.slice(max).join(' · ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}