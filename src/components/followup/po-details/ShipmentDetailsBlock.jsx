import React from 'react';
import { Truck } from 'lucide-react';
import { fmtDate } from '@/lib/followUpConstants';

// Map raw destination name to short label (Edikted → US, EdiktedUK → UK).
function destLabel(name) {
  const n = String(name || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (n === 'edikteduk' || n === 'uk') return 'UK';
  if (n === 'edikted'   || n === 'us') return 'US';
  return name || '—';
}

function destPillColors(name) {
  const l = destLabel(name);
  if (l === 'US') return 'bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]';
  if (l === 'UK') return 'bg-blue-50 text-blue-600 border-blue-200';
  return 'bg-[#F8F8F8] text-[#525252] border-[#E5E5E5]';
}

function indClass(v) {
  if (v == null) return 'text-[#A3A3A3]';
  if (v < 5)  return 'text-red-500';
  if (v < 14) return 'text-amber-600';
  return 'text-[#0A0A0A]';
}

function SizeBreakdownTable({ sizes, sizesByIndSize }) {
  if (!sizes || sizes.length === 0) {
    return <div className="text-[11px] text-[#A3A3A3] py-1.5">No size breakdown available.</div>;
  }
  return (
    <table className="w-full text-[11px] border-collapse mt-1.5">
      <thead>
        <tr className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.06em]">
          <th className="text-left px-2 py-1 border-b border-[#F0F0F0]">Size</th>
          <th className="text-right px-2 py-1 border-b border-[#F0F0F0]">Ordered</th>
          <th className="text-right px-2 py-1 border-b border-[#F0F0F0]">Received</th>
          <th className="text-right px-2 py-1 border-b border-[#F0F0F0]">IND</th>
        </tr>
      </thead>
      <tbody>
        {sizes.map(s => {
          const ind = sizesByIndSize?.[String(s.size).toUpperCase()];
          return (
            <tr key={s.size}>
              <td className="px-2 py-1 font-mono font-semibold text-[#0A0A0A]">{s.size}</td>
              <td className="px-2 py-1 text-right font-mono">{(s.ordered ?? 0).toLocaleString()}</td>
              <td className="px-2 py-1 text-right font-mono">{(s.received ?? 0).toLocaleString()}</td>
              <td className={`px-2 py-1 text-right font-mono font-semibold ${indClass(ind)}`}>
                {ind == null ? '—' : `${ind}d`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Shipment Details — main_office PO drawer section.
 * For each sub-PO destination, shows:
 * - destination
 * - shipping method
 * - air OTW qty
 * - next shipment's departure / arrival dates
 * - per-size breakdown (ordered, received, IND)
 */
export default function ShipmentDetailsBlock({ destinations }) {
  if (!Array.isArray(destinations) || destinations.length === 0) return null;

  return (
    <section className="px-5 py-4 border-t border-[#E5E5E5]">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] mb-2">
        <Truck size={12} /> Shipment Details
      </h3>
      <div className="space-y-3">
        {destinations.map((d, idx) => {
          const next = d.next_shipment;
          const methods = d.shipping_method_names?.length
            ? d.shipping_method_names.join(', ')
            : (next?.shipping_method || '—');
          return (
            <div key={`${d.destination}-${idx}`} className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${destPillColors(d.destination)}`}>
                  {destLabel(d.destination)}
                </span>
                <div className="text-[10px] text-[#A3A3A3] uppercase tracking-[.06em]">
                  Air OTW: <span className="font-mono font-semibold text-[#0A0A0A]">{(d.air_otw ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <dl className="grid text-[11px]" style={{ gridTemplateColumns: 'max-content 1fr', gap: '4px 12px' }}>
                <dt className="text-[#525252] font-semibold">Shipping method</dt>
                <dd className="text-[#0A0A0A]">{methods}</dd>
                <dt className="text-[#525252] font-semibold">Departure</dt>
                <dd className="font-mono text-[#0A0A0A]">{next?.departure_date ? fmtDate(next.departure_date) : '—'}</dd>
                <dt className="text-[#525252] font-semibold">Arrival (est.)</dt>
                <dd className="font-mono text-[#0A0A0A]">{next?.est_arrival_date ? fmtDate(next.est_arrival_date) : '—'}</dd>
              </dl>

              <SizeBreakdownTable sizes={d.size_breakdown} sizesByIndSize={d.sizes_by_size} />
            </div>
          );
        })}
      </div>
    </section>
  );
}