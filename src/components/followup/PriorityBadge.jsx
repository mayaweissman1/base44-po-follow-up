import React from 'react';

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide border';

export default function PriorityBadge({ priority }) {
  if (!priority || priority === 'Normal') {
    return <span className={`${BASE} bg-gray-50 text-gray-400 border-gray-200`}>Normal</span>;
  }

  const p = String(priority);
  const lower = p.toLowerCase();

  if (lower.includes('best seller')) {
    return <span className={`${BASE} bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]`}>{p}</span>;
  }
  if (p === 'URGENT') {
    return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}>URGENT</span>;
  }
  if (p.includes('Deadline')) {
    return <span className={`${BASE} bg-red-50 text-red-500 border-red-200`}>Deadline at risk</span>;
  }
  return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}>{p}</span>;
}