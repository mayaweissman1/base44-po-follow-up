import React from 'react';

// Color families grouped by production phase, so every status from
// DD_STATUS_OPTIONS gets a meaningful color (not a gray fallback).
const STATUS_STYLES = {
  // ── Pre-production / fabric ── amber
  'Order Fabric':                       'bg-amber-50 text-amber-700 border-amber-200',
  'PPS At Risk':                        'bg-amber-50 text-amber-700 border-amber-200',
  'PPS Send To Approval - Pre Prod':    'bg-amber-50 text-amber-700 border-amber-200',
  'PPS Send To Approval - Post Prod':   'bg-amber-50 text-amber-700 border-amber-200',

  // ── Ready / cutting ── teal
  'Ready For Production':               'bg-teal-50 text-teal-600 border-teal-200',
  'In Production - Cutting':            'bg-teal-50 text-teal-600 border-teal-200',

  // ── Active production ── pink
  'In Production - Knitting':           'bg-pink-50 text-pink-600 border-pink-200',
  'In Production - Sewing':             'bg-pink-50 text-pink-600 border-pink-200',
  'In Production - Washing':            'bg-pink-50 text-pink-600 border-pink-200',
  'In Production - ACC':                'bg-pink-50 text-pink-600 border-pink-200',

  // ── Issues ── red
  'Reproduction':                       'bg-red-50 text-red-600 border-red-200',
  'Rework':                             'bg-red-50 text-red-600 border-red-200',

  // ── QC / packing ── purple
  'Supplier Self Inspection':           'bg-purple-50 text-purple-600 border-purple-200',
  'QC in factory':                      'bg-purple-50 text-purple-600 border-purple-200',
  'QC in Office':                       'bg-purple-50 text-purple-600 border-purple-200',
  'Under Packing in Factory':           'bg-purple-50 text-purple-600 border-purple-200',

  // ── Shipping ── blue
  'OTW to Office':                      'bg-blue-50 text-blue-600 border-blue-200',

  // ── Received ── green
  'Partially Received':                 'bg-green-50 text-green-700 border-green-200',
  'Goods Received':                     'bg-green-50 text-green-700 border-green-200',

  'Empty status':                       '',
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