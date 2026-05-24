import React from 'react';
import { fmtDate } from '@/lib/followUpConstants';
import DdStatusBadge from '../DdStatusBadge';

/**
 * Compact metadata: who, what, where. Single-column "definition list" feel.
 */
export default function MetaBlock({ po, destStr, orderType }) {
  const rows = [
    { label: 'DD Manager', value: po.dd_manager_name, type: 'pink' },
    { label: 'Supplier', value: po.supplier, type: 'teal' },
    { label: 'Destinations', value: destStr },
    { label: 'Collection', value: po.collection },
    { label: 'Order Type', value: orderType, type: 'gray' },
    { label: 'Order Date', value: po.order_date ? fmtDate(po.order_date) : null, mono: true },
    { label: 'DD Status', value: po.effective_dd_status, type: 'dd-status' },
    { label: 'Next Update', value: po.effective_next_update ? fmtDate(po.effective_next_update) : null, mono: true },
  ].filter(r => r.value);

  if (rows.length === 0) return null;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Details</div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="text-[#A3A3A3] font-medium">{r.label}</span>
            <span className="text-right">
              {r.type === 'pink' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{r.value}</span>
              ) : r.type === 'teal' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{r.value}</span>
              ) : r.type === 'gray' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">{r.value}</span>
              ) : r.type === 'dd-status' ? (
                <DdStatusBadge status={r.value} />
              ) : (
                <span className={`${r.mono ? 'font-mono' : ''} font-semibold text-[#0A0A0A]`}>{r.value}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}