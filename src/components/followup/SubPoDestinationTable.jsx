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

function indCellClass(v) {
  if (v == null) return 'text-[#A3A3A3]';
  if (v >= 9999) return 'text-[#A3A3A3] font-mono';
  if (v < 5)  return 'text-red-500 font-mono font-semibold';
  if (v < 14) return 'text-amber-600 font-mono font-semibold';
  return 'text-[#0A0A0A] font-mono font-semibold';
}

function indCellText(v) {
  if (v == null) return '—';
  if (v >= 9999) return '∞';
  return `${v}d`;
}

/**
 * Expanded sub-PO view — one row per destination (US / UK / …).
 * Columns: Destination · IND · sizes (XS / S / M / L / XL / XXL) · Shipping Method · Air OTW
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
      <div className="mb-2">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Sub-POs · per destination</div>
        <div className="text-xs text-[#A3A3A3]">Loading…</div>
      </div>
    );
  }

  if (!destinations || destinations.length === 0) {
    return (
      <div className="mb-2">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Sub-POs · per destination</div>
        <div className="text-xs text-[#A3A3A3]">No sub-PO data available.</div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Sub-POs · per destination</div>
      <div className="border border-[#E5E5E5] rounded-[8px] overflow-hidden bg-white">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">Destination</th>
              <th className="text-center px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">IND</th>
              {SIZE_ORDER.map(s => (
                <th key={s} className="text-center px-2.5 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">{s}</th>
              ))}
              <th className="text-center px-3 py-1.5 text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">Total</th>
              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">Shipping Method</th>
              <th className="text-center px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">Air OTW</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d, idx) => {
              const sizeMap = d.sizes_by_size || {};
              const total = SIZE_ORDER.reduce((acc, s) => acc + (Number(sizeMap[s]) || 0), 0);
              const shipping = (d.shipping_method_names && d.shipping_method_names.length > 0)
                ? d.shipping_method_names.join(', ')
                : '—';
              return (
                <tr key={`${d.destination}-${idx}`} className="hover:bg-[#FFF0F7]">
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5]">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFF0F7] text-[#E31B7F] text-[10px] font-bold">{destLabel(d.destination)}</span>
                  </td>
                  <td className={`px-3 py-1.5 border-b border-[#E5E5E5] text-center ${indCellClass(d.inv_days)}`}>{indCellText(d.inv_days)}</td>
                  {SIZE_ORDER.map(s => {
                    const v = Number(sizeMap[s]) || 0;
                    return (
                      <td key={s} className="px-2.5 py-1.5 border-b border-[#E5E5E5] font-mono text-center text-[#525252]">
                        {v > 0 ? v : <span className="text-[#D4D4D4]">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono font-semibold text-center bg-[#FAFAFA]">{total}</td>
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] text-[#525252] truncate max-w-[180px]" title={shipping}>{shipping}</td>
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono text-center">
                    {d.air_otw > 0
                      ? <span className="font-semibold text-[#0A0A0A]">{d.air_otw}</span>
                      : <span className="text-[#A3A3A3]">0</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}