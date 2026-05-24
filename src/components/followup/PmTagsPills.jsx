import React from 'react';

/**
 * PmTagsPills — renders one pill per PM tag.
 * Follows the Edikted Tag spec (#3): Pink variant.
 *   bg: --color-primary-light (#FFF0F7)
 *   text: --color-primary (#E31B7F)
 *   font: 10px/600, line-height 1.2
 *   radius: 6px, padding: 6px 12px (compact: 4px 8px in tables)
 *   container gap: 6px
 *
 * `max` caps visible pills; the rest collapse into a gray "+N" pill (tooltip).
 */
export default function PmTagsPills({ label, max = 2 }) {
  if (!label) return <span className="text-[#A3A3A3] text-[11px]">—</span>;

  const tags = String(label)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (tags.length === 0) return <span className="text-[#A3A3A3] text-[11px]">—</span>;

  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;

  const pillBase =
    'inline-flex items-center px-2 py-[3px] rounded-[0.65rem] text-[10px] font-semibold leading-[1.2] whitespace-nowrap';

  return (
    <div className="inline-flex flex-wrap gap-1.5 max-w-full" title={tags.join(' · ')}>
      {visible.map((t, i) => (
        <span
          key={i}
          className={`${pillBase} bg-[#FFF0F7] text-[#E31B7F]`}
          title={t}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`${pillBase} bg-[#FAFAFA] text-[#525252]`}
          title={tags.slice(max).join(' · ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}