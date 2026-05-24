import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fmtDate, ddmm, getResponsibility } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import DdStatusBadge from './DdStatusBadge';
import ReasonTag from './ReasonTag';

function Section({ title, children }) {
  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  );
}

function Field({ label, mono = false, full = false, children }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-0.5">{label}</div>
      <div className={`text-[13px] ${mono ? 'font-mono font-semibold' : 'font-medium'} text-[#0A0A0A]`}>
        {children ?? <span className="text-[#A3A3A3]">—</span>}
      </div>
    </div>
  );
}

export default function PoDetailsDrawer({ po, onClose }) {
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (!po?.po_number) return;
    let cancelled = false;
    setDetails(null);
    base44.functions.invoke('getPoDetails', { po_number: po.po_number }).then(res => {
      if (cancelled) return;
      setDetails(res?.data || null);
    });
    return () => { cancelled = true; };
  }, [po?.po_number]);

  if (!po) return null;

  const orderType = po.po_number.endsWith('-CL') ? 'CL' : po.po_number.endsWith('-AC') ? 'ACC' : 'Regular';
  const responsibility = getResponsibility(po.ddd_reason);
  const destStr = po.sub_pos?.map(s => s.destination).filter(Boolean).join(' · ') || po.destination || null;

  // Aggregate quantities across all sub-POs — coerce to Number because API returns strings
  const totalOrdered = po.sub_pos?.length
    ? po.sub_pos.reduce((sum, s) => sum + (Number(s.ordered_qty) || 0), 0)
    : (Number(po.ordered_qty) || null);
  const totalReceived = po.sub_pos?.length
    ? po.sub_pos.reduce((sum, s) => sum + (Number(s.qty_received) || 0), 0)
    : (Number(po.qty_received) || null);

  // GFS aggregated from getPoDetails size breakdown
  const totalGfs = details?.destinations?.length
    ? details.destinations.reduce((t, d) => t + d.sizes.reduce((s, sz) => s + (sz.good_for_sale || 0), 0), 0)
    : null;

  // These fields may exist on the PO row or inside getPoDetails at the destination level
  const airOtw       = po.air_otw       ?? po.otw          ?? details?.air_otw       ?? null;
  const openQty      = po.open_qty      ?? details?.open_qty      ?? null;
  const openOrders   = po.open_orders   ?? details?.open_orders   ?? null;
  const shippedPct   = po.shipped_percent ?? po.shipped_pct ?? details?.shipped_percent ?? null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[440px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0">
          <div>
            <div className="font-mono font-bold text-[#0A0A0A] text-base">{po.po_number}</div>
            {destStr && <div className="text-[12px] text-[#E31B7F] font-medium mt-0.5">{po.po_number} › {destStr}</div>}
            <div className="text-[12px] text-[#525252] mt-0.5">{po.style_color}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Order Info */}
          <Section title="Order info">
            <Field label="Style Color" mono>{po.style_color || null}</Field>
            <Field label="Destinations">{destStr}</Field>
            <Field label="Collection">{po.collection || null}</Field>
            <Field label="Order Type">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">{orderType}</span>
            </Field>
            <Field label="Order Date" mono>{fmtDate(po.order_date)}</Field>
            <Field label="Supplier">
              {po.supplier
                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span>
                : null}
            </Field>
            <Field label="DD Manager">
              {po.dd_manager_name
                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name}</span>
                : null}
            </Field>
          </Section>

          {/* Priority & Tags */}
          <Section title="Priority & Tags">
            <Field label="Status"><StatusBadge status={po.current_status} /></Field>
            <Field label="Priority"><PriorityBadge priority={po.priority} /></Field>
            {po.flags && (
              <Field label="Flag">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span>
              </Field>
            )}
            {po.ddd_reason && (
              <Field label="Responsibility">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${responsibility === 'SUPPLIER' ? 'bg-orange-50 text-orange-500 border border-orange-200' : responsibility === 'EDIKTED' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{responsibility}</span>
              </Field>
            )}
            {po.pm_tags && <Field label="PM Tags" full>{po.pm_tags}</Field>}
          </Section>

          {/* Quantities */}
          <Section title="Quantities">
            <Field label="Ordered Qty" mono>{totalOrdered}</Field>
            <Field label="Qty Received" mono>{totalReceived}</Field>
            <Field label="Good For Sale" mono>{totalGfs}</Field>
            <Field label="Air OTW" mono>{airOtw}</Field>
            <Field label="Open Qty" mono>{openQty}</Field>
            <Field label="Open Orders" mono>{openOrders}</Field>
            <Field label="Shipped %" mono>{shippedPct}</Field>
          </Section>

          {/* Delivery Dates */}
          <Section title="Delivery Dates">
            <Field label="Due Date" mono>{fmtDate(po.due_date)}</Field>
            <Field label="Final DD" mono>{fmtDate(po.final_dd)}</Field>
            <Field label="Delayed DD">
              {po.effective_delayed_due_date
                ? <span className="font-mono font-bold text-[#E31B7F]">{fmtDate(po.effective_delayed_due_date)}</span>
                : null}
            </Field>
            <Field label="Days Late">
              {po.days_late_counting != null ? (
                <span className={`font-mono font-semibold ${po.days_late_counting <= 0 ? 'text-green-500' : po.days_late_counting <= 3 ? 'text-[#525252]' : 'text-red-500'}`}>
                  {po.days_late_counting > 0 ? `+${po.days_late_counting}` : po.days_late_counting}
                </span>
              ) : null}
            </Field>
            {po.hold_age_days != null && (
              <Field label="HOLD Age" mono>{po.hold_age_days <= 0 ? 'Today' : `${po.hold_age_days}d ago`}</Field>
            )}
            {po.goods_received && (
              <Field label="Goods Received" mono>{fmtDate(po.goods_received)}</Field>
            )}
          </Section>

          {/* Delay Info */}
          {po.ddd_reason && (
            <Section title="Delay Info">
              <Field label="DD Reason"><ReasonTag reason={po.ddd_reason} /></Field>
              <Field label="DDD Count" mono>{po.ddd_count ?? 0}</Field>
              {po.ddd_comment && <Field label="DDD Comment" full>{po.ddd_comment}</Field>}
              {po.delay_response_comment && <Field label="Response" full>{po.delay_response_comment}</Field>}
            </Section>
          )}

          {/* DD Status */}
          <Section title="DD Status">
            <Field label="DD Status"><DdStatusBadge status={po.effective_dd_status} /></Field>
            <Field label="Next Update" mono>
              {po.effective_next_update ? fmtDate(po.effective_next_update) : null}
            </Field>
            {po.internal_note && <Field label="Internal Note" full>{po.internal_note}</Field>}
          </Section>

          {/* Manufacturing */}
          {(po.bulk_fabric_approval || po.pps_receipt_date) && (
            <Section title="Manufacturing">
              {po.bulk_fabric_approval && (
                <Field label="Bulk Fabric Approval" mono>{fmtDate(po.bulk_fabric_approval)}</Field>
              )}
              {po.pps_receipt_date && (
                <Field label="PPS Receipt Date" mono>{fmtDate(po.pps_receipt_date)}</Field>
              )}
            </Section>
          )}

          {/* DD Comment Log */}
          {po.dd_comment_log?.length > 0 && (
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2.5">DD Comment Log</div>
              <div className="space-y-1.5">
                {po.dd_comment_log.map((e, i) => (
                  <div key={i} className="flex gap-2 text-[12px]">
                    <span className="font-mono text-[#A3A3A3] flex-shrink-0">{ddmm(e.date)}</span>
                    <span className="text-[#0A0A0A]">{e.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
