import React from 'react';

export default function PriorityBadge({ priority }) {
  if (!priority || priority === 'Normal') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide bg-gray-50 text-gray-400 border border-gray-200">Normal</span>;
  }
  if (priority === 'URGENT') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">URGENT</span>;
  }
  if (priority.includes('Deadline')) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-500 border border-red-200">Deadline at risk</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-bold uppercase tracking-wide bg-gray-50 text-gray-400 border border-gray-200">{priority}</span>;
}