import React, { useEffect, useState } from 'react';
import { X, Plane } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtDate } from '@/lib/followUpConstants';

/**
 * Modal listing the in-flight (Air OTW) shipments for a (style_color, destination) pair.
 * Driven by the dedicated `getAirOtwShipments` backend function.
 */
export default function AirOtwModal({ styleColor, destination, onClose }) {
  const [shipments, setShipments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    base44.functions
      .invoke('getAirOtwShipments', { style_color: styleColor, destination })
      .then(res => {
        if (cancelled) return;
        if (res.data?.error) setError(res.data.error);
        else setShipments(res.data?.shipments || []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load shipments');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [styleColor, destination]);

  const destLabel = destination === 'Edikted' ? 'US'
                  : destination === 'EdiktedUK' ? 'UK'
                  : destination;

  const totalQty = (shipments || []).reduce((s, r) => s + (r.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,.18)] w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Plane size={16} className="text-[#E31B7F] flex-shrink-0" />
            <h2 className="text-[15px] font-bold text-[#0A0A0A] truncate">{styleColor}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF0F7] text-[#E31B7F] border border-[#FFCCDE] flex-shrink-0">
              {destLabel}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-[#A3A3A3]">Loading shipments…</div>
          )}
          {!loading && error && (
            <div className="flex items-center justify-center py-12 text-sm text-red-500">{error}</div>
          )}
          {!loading && !error && shipments && shipments.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-[#A3A3A3]">No air shipments on the way.</div>
          )}
          {!loading && !error && shipments && shipments.length > 0 && (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] bg-[#FAFAFA]">
                  <th className="text-left px-4 py-2.5 border-b border-[#E5E5E5]">Shipment Number</th>
                  <th className="text-left px-3 py-2.5 border-b border-[#E5E5E5]">Departure</th>
                  <th className="text-left px-3 py-2.5 border-b border-[#E5E5E5]">Est. Arrival</th>
                  <th className="text-left px-3 py-2.5 border-b border-[#E5E5E5]">Method</th>
                  <th className="text-right px-4 py-2.5 border-b border-[#E5E5E5]">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((r, i) => (
                  <tr key={`${r.shipment_number}-${i}`} className="hover:bg-[#FFF8FC]">
                    <td className="px-4 py-2.5 border-b border-[#F0F0F0] font-mono font-semibold text-[#0A0A0A]">{r.shipment_number}</td>
                    <td className="px-3 py-2.5 border-b border-[#F0F0F0] font-mono text-[#525252]">{fmtDate(r.departure_date) || '—'}</td>
                    <td className="px-3 py-2.5 border-b border-[#F0F0F0] font-mono font-semibold">{fmtDate(r.est_arrival_date) || '—'}</td>
                    <td className="px-3 py-2.5 border-b border-[#F0F0F0]">
                      {r.shipping_method
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-[0.5rem] text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">{r.shipping_method}</span>
                        : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 border-b border-[#F0F0F0] text-right font-mono font-semibold">{r.quantity.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && shipments && shipments.length > 0 && (
          <div className="px-5 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between text-[11px]">
            <span className="text-[#525252]">
              {shipments.length} shipment{shipments.length === 1 ? '' : 's'}
            </span>
            <span className="text-[#0A0A0A] font-semibold">
              Total: <span className="font-mono">{totalQty.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}