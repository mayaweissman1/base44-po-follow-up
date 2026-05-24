import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function PoSizeBreakdown({ poNumber, combined = false }) {
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

  const titleText = combined ? 'Size Breakdown' : 'Size Breakdown · per destination';

  if (loading) {
    return (
      <div className="mb-4">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">{titleText}</div>
        <div className="text-xs text-[#A3A3A3]">Loading…</div>
      </div>
    );
  }

  if (!destinations || destinations.length === 0) {
    return (
      <div className="mb-4">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">{titleText}</div>
        <div className="text-xs text-[#A3A3A3]">No size data available.</div>
      </div>
    );
  }

  // ─── Combined view (drawer) — aggregated across all destinations ────────────
  if (combined) {
    const sizeMap = {};
    destinations.forEach(d => {
      d.sizes.forEach(s => {
        if (!sizeMap[s.size]) sizeMap[s.size] = { size: s.size, ordered_qty: 0, qty_received: 0, good_for_sale: 0 };
        sizeMap[s.size].ordered_qty   += s.ordered_qty   || 0;
        sizeMap[s.size].qty_received  += s.qty_received  || 0;
        sizeMap[s.size].good_for_sale += s.good_for_sale || 0;
      });
    });
    const sizes = Object.values(sizeMap);
    const totals = sizes.reduce(
      (acc, s) => ({ ordered: acc.ordered + s.ordered_qty, received: acc.received + s.qty_received, gfs: acc.gfs + s.good_for_sale }),
      { ordered: 0, received: 0, gfs: 0 }
    );
    return (
      <div className="mb-4">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Size Breakdown</div>
        <div className="border border-[#E5E5E5] rounded-[8px] overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Size', 'Ordered', 'Received', 'GFS'].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA] border-b border-[#E5E5E5]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s, i) => (
                <tr key={s.size || i} className="hover:bg-[#FFF0F7]">
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono font-semibold">{s.size}</td>
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono">{s.ordered_qty}</td>
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono">{s.qty_received}</td>
                  <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono">{s.good_for_sale}</td>
                </tr>
              ))}
              <tr className="bg-[#FAFAFA] font-semibold">
                <td className="px-3 py-1.5 text-[11px] text-[#525252]">Total</td>
                <td className="px-3 py-1.5 font-mono">{totals.ordered}</td>
                <td className="px-3 py-1.5 font-mono">{totals.received}</td>
                <td className="px-3 py-1.5 font-mono">{totals.gfs}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Per-destination view (expanded rows) — side by side, no GFS ───────────
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Size Breakdown · per destination</div>
      <div className="flex flex-wrap gap-3 items-start">
        {destinations.map(d => {
          const totals = d.sizes.reduce(
            (acc, s) => ({ ordered: acc.ordered + (s.ordered_qty || 0), received: acc.received + (s.qty_received || 0) }),
            { ordered: 0, received: 0 }
          );
          return (
            <div key={d.destination} className="border border-[#E5E5E5] rounded-[8px] overflow-hidden flex-shrink-0">
              <div className="px-3 py-2 bg-[#FAFAFA] border-b border-[#E5E5E5] flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFF0F7] text-[#E31B7F] text-[10px] font-bold">{d.destination}</span>
                <span className="text-[11px] text-[#A3A3A3] ml-auto font-mono">{totals.received}/{totals.ordered}</span>
              </div>
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    {['Size', 'Ordered', 'Received'].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-white border-b border-[#E5E5E5]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.sizes.map((s, i) => (
                    <tr key={s.sku || i} className="hover:bg-[#FFF0F7]">
                      <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono font-semibold">{s.size}</td>
                      <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono">{s.ordered_qty}</td>
                      <td className="px-3 py-1.5 border-b border-[#E5E5E5] font-mono">{s.qty_received}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#FAFAFA] font-semibold">
                    <td className="px-3 py-1.5 text-[11px] text-[#525252]">Total</td>
                    <td className="px-3 py-1.5 font-mono">{totals.ordered}</td>
                    <td className="px-3 py-1.5 font-mono">{totals.received}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
