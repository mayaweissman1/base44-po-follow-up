import React from 'react';
import { STATUS_ENUM } from '@/lib/followUpConstants';

const STYLES = {
  badge_hold:     'bg-amber-50 text-amber-600 border border-amber-200',
  badge_auto:     'bg-pink-50 text-pink-600 border border-pink-200',
  badge_approved: 'bg-green-50 text-green-600 border border-green-200',
  badge_rejected: 'bg-red-50 text-red-600 border border-red-200',
  badge_ack:      'bg-teal-50 text-teal-600 border border-teal-200',
  badge_none:     'bg-gray-50 text-gray-400 border border-gray-200',
};

export default function StatusBadge({ status }) {
  if (!status) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-gray-50 text-gray-400 border border-gray-200">—</span>;
  const def = STATUS_ENUM[status];
  if (!def) return null;
  const styleKey = def.badgeClass.replace('-', '_');
  const cls = STYLES[styleKey] || STYLES.badge_none;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap ${cls}`}
      title={def.desc}
    >
      {def.name}
    </span>
  );
}