import React from 'react';

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide border max-w-[160px]';

function Label({ text }) {
  const needsTruncate = text.length > 20;
  return (
    <span className={needsTruncate ? 'truncate block' : 'whitespace-nowrap'} title={needsTruncate ? text : undefined}>
      {text}
    </span>
  );
}

/**
 * Renders the computed urgent_priority value from getFollowUpData
 * (or the legacy urgency_reason as fallback).
 *
 * Closed-list values from the urgent_reasons_base formula:
 *   BEST SELLER NEW · BEST SELLER OLD · SOLD OUT · MISSING SIZES ·
 *   MANUAL · URGENT · Drop … · Risk in Fabric/PPS · <pm_tags string>
 *
 * Plus legacy values still seen in some rows:
 *   "Best Seller New", "URGENT", "US-Sizes Inv Days", "Deadline at risk".
 */
export default function PriorityBadge({ priority }) {
  if (!priority) {
    return <span className="text-[#A3A3A3]">—</span>;
  }
  if (priority === 'Normal') {
    return <span className={`${BASE} bg-gray-50 text-gray-400 border-gray-200`}><Label text="Normal" /></span>;
  }

  const p = String(priority);
  const lower = p.toLowerCase();

  // SOLD OUT — red
  if (lower === 'sold out') {
    return <span className={`${BASE} bg-red-50 text-red-600 border-red-200`}><Label text={p} /></span>;
  }
  if (lower === 'missing sizes') {
    return <span className={`${BASE} bg-purple-50 text-purple-600 border-purple-200`}><Label text={p} /></span>;
  }
  if (lower.includes('risk in fabric') || lower.includes('risk in pps')) {
    return <span className={`${BASE} bg-red-50 text-red-500 border-red-200`}><Label text={p} /></span>;
  }
  if (lower.includes('best seller')) {
    return <span className={`${BASE} bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]`}><Label text={p} /></span>;
  }
  if (lower === 'manual') {
    return <span className={`${BASE} bg-amber-50 text-amber-700 border-amber-300`}><Label text={p} /></span>;
  }
  if (lower === 'urgent' || lower.includes('urgent')) {
    return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}><Label text={p} /></span>;
  }
  if (lower.startsWith('drop')) {
    return <span className={`${BASE} bg-teal-50 text-teal-600 border-teal-200`}><Label text={p} /></span>;
  }
  if (lower.includes('deadline')) {
    return <span className={`${BASE} bg-red-50 text-red-500 border-red-200`}><Label text={p} /></span>;
  }
  if (lower.includes('inv') || lower.includes('sizes')) {
    return <span className={`${BASE} bg-teal-50 text-teal-600 border-teal-200`}><Label text={p} /></span>;
  }
  return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}><Label text={p} /></span>;
}