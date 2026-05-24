import React from 'react';
import { getResponsibility } from '@/lib/followUpConstants';

const STYLES = {
  OTHER:    'bg-amber-50 text-amber-600',
  EDIKTED:  'bg-purple-50 text-purple-600',
  SUPPLIER: 'bg-teal-50 text-teal-600',
};

function shorten(reason) {
  return reason
    .replace('Technical problem - ', 'Tech · ')
    .replace(' (YKK zip, beads, feathers, fringes)', '');
}

function Pill({ reason }) {
  const resp = getResponsibility(reason);
  const cls = STYLES[resp] || STYLES.OTHER;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}
      title={reason}
    >
      {shorten(reason)}
    </span>
  );
}

/**
 * ReasonTag — renders one or more delay reasons.
 * Accepts either `reason` (string, legacy) or `reasons` (array, new).
 */
export default function ReasonTag({ reason, reasons }) {
  const list = Array.isArray(reasons) && reasons.length > 0
    ? reasons
    : (reason ? [reason] : []);
  if (list.length === 0) return <span className="text-[#A3A3A3] text-xs">—</span>;
  if (list.length === 1) return <Pill reason={list[0]} />;
  return (
    <div className="inline-flex flex-wrap gap-1" title={list.join(' · ')}>
      <Pill reason={list[0]} />
      {list.length > 1 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]">
          +{list.length - 1}
        </span>
      )}
    </div>
  );
}