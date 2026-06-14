import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { SIZE_ORDER } from '@/lib/followUpConstants';

// Map raw destination names to short display labels (Edikted → US, EdiktedUK → UK)
function destLabel(name) {
  const n = String(name || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (n === 'edikteduk' || n === 'uk') return 'UK';
  if (n === 'edikted' || n === 'us')   return 'US';
  return name;
}

function destPillColors(name) {
  const l = destLabel(name);
  if (l === 'US') return 'bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]';
  if (l === 'UK') return 'bg-blue-50 text-blue-600 border-blue-200';
  return 'bg-[#F8F8F8] text-[#525252] border-[#E5E5E5]';
}

function indClass(v) {
  if (v == null || v >= 9999) return 'text-[#A3A3A3]';
  if (v < 5)  return 'text-red-500';
  if (v < 14) return 'text-amber-600';
  return 'text-[#0A0A0A]';
}

function indText(v) {
  if (v == null) return '—';
  if (v >= 9999) return '∞';
  return `${v}d`;
}

function SizeCell({ value }) {
  if (!value || value <= 0) {
    return <span className="text-[#D4D4D4] font-mono">—</span>;
  }
  return <span className="font-mono font-semibold text-[#0A0A0A]">{value}</span>;
}

/**
 * Expanded sub-PO view — one row per destination (US / UK / …).
 * Compact card with a clear header strip and tidy size grid.
 */
export default function SubPoDestinationTable({ poNumber }) {
  const [destinations, setDestinations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    base44.functions.invoke('getPoDetails', { po_number: poNumber }).then(res => {
      if (cancelled) return;
      setDestinations(res?.data?.destinations || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [poNumber]);

  if (loading) {
    return (
      <div className="text-xs text-[#A3A3A3] py-2">Loading sub-PO details…</div>
    );
  }

  if (!destinations || destinations.length === 0) {
    return (
      <div className="text-xs text-[#A3A3A3] py-2">No sub-PO data available.</div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
        <span className="text-[10px] font-bold text-[#525252] uppercase tracking-[.08em]">Sub-POs by Destination</span>
        <span className="text-[10px] text-[#A3A3A3]">·</span>
        <span className="text-[10px] text-[#A3A3A3]">{destinations.length} destination{destinations.length === 1 ? '' : 's'}</span>
      </div>

      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em]">
            <th className="text-left px-4 py-2 border-b border-[#E5E5E5] bg-white">Destination</th>
            <th className="text-center px-3 py-2 border-b border-[#E5E5E5] bg-white">IND</th>
            {SIZE_ORDER.map(s => (
              <th key={s} className="text-center px-2 py-2 border-b border-[#E5E5E5] bg-white w-[44px]">{s}</th>
            ))}
            <th className="text-center px-3 py-2 border-b border-[#E5E5E5] bg-[#F8F8F8] text-[#525252]">Total</th>
            <th className="text-left px-4 py-2 border-b border-[#E5E5E5] bg-white">Shipping Method</th>
            <th className="text-center px-3 py-2 border-b border-[#E5E5E5] bg-white">Air OTW</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((d, idx) => {
            const sizeMap = d.sizes_by_size || {};
            const total = SIZE_ORDER.reduce((acc, s) => acc + (Number(sizeMap[s]) || 0), 0);
            const shippingArr = d.shipping_method_names || [];
            return (
              <tr key={`${d.destination}-${idx}`} className="hover:bg-[#FFF8FC]">
                <td className="px-4 py-2.5 border-b border-[#F0F0F0]">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold ${destPillColors(d.destination)}`}>
                    {destLabel(d.destination)}
                  </span>
                </td>
                <td className={`px-3 py-2.5 border-b border-[#F0F0F0] text-center font-mono font-semibold ${indClass(d.inv_days)}`}>
                  {indText(d.inv_days)}
                </td>
                {SIZE_ORDER.map(s => (
                  <td key={s} className="px-2 py-2.5 border-b border-[#F0F0F0] text-center">
                    <SizeCell value={Number(sizeMap[s]) || 0} />
                  </td>
                ))}
                <td className="px-3 py-2.5 border-b border-[#F0F0F0] text-center bg-[#FAFAFA]">
                  <span className="font-mono font-bold text-[#0A0A0A]">{total.toLocaleString()}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-[#F0F0F0]">
                  {shippingArr.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {shippingArr.map(m => (
                        <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-[0.5rem] text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">{m}</span>
                      ))}
                    </div>
                  ) : <span className="text-[#A3A3A3]">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-[#F0F0F0] text-center">
                  {d.air_otw > 0
                    ? <span className="font-mono font-semibold text-[#0A0A0A]">{d.air_otw.toLocaleString()}</span>
                    : <span className="text-[#A3A3A3] font-mono">0</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}