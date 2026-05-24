import React from 'react';

const STATUS_STYLES = {
  'In Production - Sewing': 'bg-pink-50 text-pink-600 border-pink-200',
  'In Production - ACC':    'bg-pink-50 text-pink-600 border-pink-200',
  'OTW to Office':          'bg-green-50 text-green-600 border-green-200',
  'Ready For Production':   'bg-teal-50 text-teal-600 border-teal-200',
  'Rework':                 'bg-red-50 text-red-600 border-red-200',
  'Empty status':           '',
};

export default function DdStatusBadge({ status }) {
  if (!status || status === 'Empty status') return <span className="text-[#A3A3A3] text-xs">—</span>;
  const cls = STATUS_STYLES[status] || 'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[0.65rem] border text-[10px] font-medium max-w-[160px] truncate ${cls}`} title={status}>
      {status}
    </span>
  );
}