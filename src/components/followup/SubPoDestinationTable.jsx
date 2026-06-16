import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import AirOtwModal from './AirOtwModal';

// Sub-PO destination table shows per-size **inventory days** (not ordered qty)
// for the four sizes that drive the Rep urgent ladder: XS, S, M, XS/S.
const SUB_PO_SIZES = ['XS', 'S', 'M', 'XS/S'];

// Simple in-memory cache + prefetch — re-expanding the same PO is instant,
// and hovering the expand chevron starts the request before the click.
// CACHE_VERSION — bump when the getPoDetails response shape changes so
// already-mounted clients drop their stale entries on next render.
const CACHE_VERSION = 'v7-shipment-details';
const _cache = new Map();         // po_number -> { v, dests }
const _inflight = new Map();      // po_number -> Promise

function readCache(poNumber) {
  const e = _cache.get(poNumber);
  return e && e.v === CACHE_VERSION ? e.dests : null;
}
function writeCache(poNumber, dests) {
  _cache.set(poNumber, { v: CACHE_VERSION, dests });
}

export function prefetchPoDetails(poNumber) {
  if (!poNumber || readCache(poNumber) || _inflight.has(poNumber)) return;
  const p = base44.functions.invoke('getPoDetails', { po_number: poNumber })
    .then(res => {
      const dests = res?.data?.destinations || [];
      writeCache(poNumber, dests);
      _inflight.delete(poNumber);
      return dests;
    })
    .catch(err => {
      _inflight.delete(poNumber);
      throw err;
    });
  _inflight.set(poNumber, p);
}

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

// Per-destination priority for the expand row. Shows the same closed-list
// value (BEST SELLER / SOLD OUT / MISSING SIZES / MANUAL / URGENT / Drop … /
// Risk in Fabric/PPS) that the main row's Priority column is filtered by.
// Falls back to the legacy destination-specific tag (us_priority/uk_priority).
function priorityForDest(destName, parentRow) {
  if (!parentRow) return null;
  if (parentRow.urgent_priority) return parentRow.urgent_priority;
  const l = destLabel(destName);
  if (l === 'US' && parentRow.us_priority) return parentRow.us_priority;
  if (l === 'UK' && parentRow.uk_priority) return parentRow.uk_priority;
  return null;
}

function PriorityCell({ value }) {
  if (!value) return <span className="text-[#A3A3A3]">—</span>;
  const v = String(value);
  let cls = 'bg-[#F8F8F8] text-[#525252] border-[#E5E5E5]';
  if (/best.?seller/i.test(v)) cls = 'bg-[#FFF0F7] text-[#E31B7F] border-[#FFCCDE]';
  else if (/sold.?out|missing/i.test(v)) cls = 'bg-red-50 text-red-600 border-red-200';
  else if (/urgent|manual|risk/i.test(v)) cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (/^drop/i.test(v)) cls = 'bg-teal-50 text-teal-700 border-teal-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.5rem] border text-[10px] font-bold uppercase tracking-[.04em] ${cls}`} title={v}>
      {v}
    </span>
  );
}

// Per-size inventory-days cell. Uses the same color ladder as the destination
// IND column (red < 5d, amber < 14d, neutral otherwise).
function SizeIndCell({ value }) {
  if (value == null) return <span className="text-[#D4D4D4] font-mono">—</span>;
  return <span className={`font-mono font-semibold ${indClass(value)}`}>{indText(value)}</span>;
}

/**
 * Expanded sub-PO view — one row per destination (US / UK / …).
 * Compact card with a clear header strip and tidy size grid.
 */
export default function SubPoDestinationTable({ poNumber, parentRow }) {
  const [destinations, setDestinations] = useState(() => readCache(poNumber));
  const [loading, setLoading] = useState(() => !readCache(poNumber));
  const [airOtwTarget, setAirOtwTarget] = useState(null); // { styleColor, destination }

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(poNumber);
    if (cached) {
      setDestinations(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    let promise = _inflight.get(poNumber);
    if (!promise) {
      prefetchPoDetails(poNumber);
      promise = _inflight.get(poNumber);
    }
    promise?.then(dests => {
      if (cancelled) return;
      setDestinations(dests || []);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setDestinations([]);
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
    <div className="bg-white border border-[#E5E5E5] rounded-[8px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] bg-[#FAFAFA]">
            <th className="text-left px-3 py-1.5 border-b border-[#E5E5E5]">Destination</th>
            <th className="text-left px-2 py-1.5 border-b border-[#E5E5E5]">Priority</th>
            <th className="text-center px-2 py-1.5 border-b border-[#E5E5E5]" title="Inventory days — from mart_repeats__sc_united_with_groups">IND</th>
            {SUB_PO_SIZES.map(s => (
              <th key={s} className="text-center px-1.5 py-1.5 border-b border-[#E5E5E5] w-[44px]" title={`Inventory days for size ${s} at this destination (sku_sizes_invd)`}>{s}</th>
            ))}
            <th className="text-left px-3 py-1.5 border-b border-[#E5E5E5]">Shipping</th>
            <th className="text-center px-2 py-1.5 border-b border-[#E5E5E5]" title="Air on-the-way — open shipments in transit (pl_po + shipments, all order types)">Air OTW</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((d, idx) => {
            const sizeMap = d.sizes_by_size || {};
            const shippingArr = d.shipping_method_names || [];
            const isLast = idx === destinations.length - 1;
            const border = isLast ? '' : 'border-b border-[#F0F0F0]';
            return (
              <tr key={`${d.destination}-${idx}`} className="hover:bg-[#FFF8FC]">
                <td className={`px-3 py-2 ${border}`}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${destPillColors(d.destination)}`}>
                    {destLabel(d.destination)}
                  </span>
                </td>
                <td className={`px-2 py-2 ${border}`}>
                  <PriorityCell value={priorityForDest(d.destination, parentRow)} />
                </td>
                <td className={`px-2 py-2 text-center font-mono font-semibold ${border} ${indClass(d.inv_days)}`}>
                  {indText(d.inv_days)}
                </td>
                {SUB_PO_SIZES.map(s => (
                  <td key={s} className={`px-1.5 py-2 text-center ${border}`}>
                    <SizeIndCell value={sizeMap[s] ?? null} />
                  </td>
                ))}
                <td className={`px-3 py-2 ${border}`}>
                  {shippingArr.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {shippingArr.map(m => (
                        <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded-[0.5rem] text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">{m}</span>
                      ))}
                    </div>
                  ) : <span className="text-[#A3A3A3]">—</span>}
                </td>
                <td className={`px-2 py-2 text-center ${border}`}>
                  {d.air_otw > 0
                    ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAirOtwTarget({ styleColor: parentRow?.style_color, destination: d.destination }); }}
                        title="View Air OTW shipments"
                        className="font-mono font-semibold text-[#E31B7F] hover:underline"
                      >
                        {d.air_otw.toLocaleString()}
                      </button>
                    )
                    : <span className="text-[#A3A3A3] font-mono">{d.air_otw == null ? '—' : 0}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {airOtwTarget && (
        <AirOtwModal
          styleColor={airOtwTarget.styleColor}
          destination={airOtwTarget.destination}
          onClose={() => setAirOtwTarget(null)}
        />
      )}
    </div>
  );
}