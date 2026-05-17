import React from 'react';
import { getResponsibility } from '@/lib/followUpConstants';

export default function ReasonTag({ reason }) {
  if (!reason) return <span className="text-[#A3A3A3] text-xs">—</span>;
  const resp = getResponsibility(reason);
  const styles = {
    OTHER:    'bg-amber-50 text-amber-600',
    EDIKTED:  'bg-purple-50 text-purple-600',
    SUPPLIER: 'bg-teal-50 text-teal-600',
  };
  const cls = styles[resp] || styles.OTHER;
  const short = reason.replace('Technical problem - ', 'Tech · ').replace(' (YKK zip, beads, feathers, fringes)', '');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`} title={reason}>
      {short}
    </span>
  );
}