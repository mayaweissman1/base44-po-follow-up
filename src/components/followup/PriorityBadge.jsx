import React from 'react';

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide border';

/**
 * Renders the raw urgency_reason value from po_urgent_status.
 * Examples seen: "US-Sizes Inv Days", "Best Seller New", "Best Seller", "URGENT", "Deadline at risk", "Normal".
 * The component color-codes by category.
 */
export default function PriorityBadge({ priority }) {
  if (!priority || priority === 'Normal') {
    return <span className={`${BASE} bg-gray-50 text-gray-400 border-gray-200`}>Normal</span>;
  }

  const p = String(priority);
  const lower = p.toLowerCase();

  // Best Seller — pink
  if (lower.includes('best seller')) {
    return <span className={`${BASE} bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]`}>{p}</span>;
  }
  // URGENT — amber
  if (lower === 'urgent' || lower.includes('urgent')) {
    return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}>{p}</span>;
  }
  // Deadline at risk — red
  if (lower.includes('deadline')) {
    return <span className={`${BASE} bg-red-50 text-red-500 border-red-200`}>{p}</span>;
  }
  // INV / inventory based signals — teal
  if (lower.includes('inv') || lower.includes('sizes')) {
    return <span className={`${BASE} bg-teal-50 text-teal-600 border-teal-200`}>{p}</span>;
  }
  // Drop — purple
  if (lower.includes('drop')) {
    return <span className={`${BASE} bg-purple-50 text-purple-600 border-purple-200`}>{p}</span>;
  }
  // Fallback
  return <span className={`${BASE} bg-amber-50 text-amber-600 border-amber-200`}>{p}</span>;
}