import React from 'react';
import { X } from 'lucide-react';
import { fmtDate, ddmm, getResponsibility } from '@/lib/followUpConstants';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import DdStatusBadge from './DdStatusBadge';
import ReasonTag from './ReasonTag';

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">{title}</div>
      <dl className="grid" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: '12px', rowGap: '6px' }}>
        {children}
      </dl>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <>
      <dt className="text-[12px] text-[#525252] font-medium whitespace-nowrap">{label}</dt>
      <dd className="text-[12px] text-[#0A0A0A] font-semibold min-w-0">{children ?? '—'}</dd>
    </>
  );
}

export default function PoDetailsDrawer({ po, onClose }) {
  if (!po) return null;

  const orderType = po.po_number.endsWith('-CL') ? 'CL' : po.po_number.endsWith('-AC') ? 'ACC' : 'Regular';
  const responsibility = getResponsibility(po.ddd_reason);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[420px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0">
          <div>
            <div className="font-mono font-bold text-[#0A0A0A] text-base">{po.po_number}</div>
            <div className="text-[12px] text-[#525252] mt-0.5">{po.style_color}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Section title="Order info">
            <Row label="Supplier">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span>
            </Row>
            <Row label="DD Manager">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span>
            </Row>
            <Row label="Collection">{po.collection || '—'}</Row>
            <Row label="Order Date"><span className="font-mono">{fmtDate(po.order_date)}</span></Row>
            <Row label="Order Type">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">{orderType}</span>
            </Row>
          </Section>

          <div className="border-t border-[#E5E5E5] mb-5" />

          <Section title="Priority & Tags">
            <Row label="Status"><StatusBadge status={po.current_status} /></Row>
            <Row label="Priority"><PriorityBadge priority={po.priority} /></Row>
            {po.flags && (
              <Row label="Flag">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span>
              </Row>
            )}
            {po.ddd_reason && (
              <Row label="Responsibility">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${responsibility === 'SUPPLIER' ? 'bg-orange-50 text-orange-500 border border-orange-200' : responsibility === 'EDIKTED' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{responsibility}</span>
              </Row>
            )}
            {po.pm_tags && <Row label="PM Tags">{po.pm_tags}</Row>}
          </Section>

          <div className="border-t border-[#E5E5E5] mb-5" />

          <Section title="Quantities">
            <Row label="Ordered Qty"><span className="font-mono">{po.ordered_qty ?? '—'}</span></Row>
            <Row label="Qty Received"><span className="font-mono">{po.qty_received ?? 0}</span></Row>
            <Row label="Manual RW">{po.qty_rw_manual ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : '—'}</Row>
            <Row label="Auto RW">{po.qty_rw_auto ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : '—'}</Row>
            {po.goods_received && <Row label="Goods Received"><span className="font-mono">{fmtDate(po.goods_received)}</span></Row>}
          </Section>

          <div className="border-t border-[#E5E5E5] mb-5" />

          <Section title="Delivery dates">
            <Row label="Due Date"><span className="font-mono">{fmtDate(po.due_date)}</span></Row>
            <Row label="Delayed DD">
              {po.effective_delayed_due_date
                ? <span className="font-mono font-bold text-[#E31B7F]">{fmtDate(po.effective_delayed_due_date)}</span>
                : '—'}
            </Row>
            <Row label="Final DD"><span className="font-mono font-bold">{fmtDate(po.final_dd)}</span></Row>
            <Row label="Days Late">
              {po.days_late_counting != null ? (
                <span className={`font-mono font-semibold ${po.days_late_counting <= 0 ? 'text-green-500' : po.days_late_counting <= 3 ? 'text-[#525252]' : 'text-red-500'}`}>
                  {po.days_late_counting > 0 ? `+${po.days_late_counting}` : po.days_late_counting}
                </span>
              ) : '—'}
            </Row>
            {po.hold_age_days != null && (
              <Row label="HOLD Age">
                <span className="font-mono">
                  {po.hold_age_days <= 0 ? 'Today' : `${po.hold_age_days}d ago`}
                </span>
              </Row>
            )}
          </Section>

          {po.ddd_reason && (
            <>
              <div className="border-t border-[#E5E5E5] mb-5" />
              <Section title="Delay info">
                <Row label="DD Reason"><ReasonTag reason={po.ddd_reason} /></Row>
                {po.ddd_comment && <Row label="DDD Comment"><span className="text-xs leading-snug">{po.ddd_comment}</span></Row>}
                <Row label="DDD Count"><span className="font-mono">{po.ddd_count ?? 0}</span></Row>
                {po.delay_response_comment && <Row label="Response"><span className="text-xs leading-snug">{po.delay_response_comment}</span></Row>}
              </Section>
            </>
          )}

          <div className="border-t border-[#E5E5E5] mb-5" />

          <Section title="DD Status">
            <Row label="DD Status"><DdStatusBadge status={po.effective_dd_status} /></Row>
            <Row label="Next Update">
              {po.effective_next_update ? <span className="font-mono">{fmtDate(po.effective_next_update)}</span> : '—'}
            </Row>
            {po.internal_note && <Row label="Internal note"><span className="text-xs leading-snug text-[#525252]">{po.internal_note}</span></Row>}
          </Section>

          {po.dd_comment_log?.length > 0 && (
            <>
              <div className="border-t border-[#E5E5E5] mb-5" />
              <div className="mb-5">
                <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">DD Comment Log</div>
                <div className="space-y-1.5">
                  {po.dd_comment_log.map((e, i) => (
                    <div key={i} className="flex gap-2 text-[12px]">
                      <span className="font-mono text-[#A3A3A3] flex-shrink-0">{ddmm(e.date)}</span>
                      <span className="text-[#0A0A0A]">{e.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {po.sub_pos?.length > 0 && (
            <>
              <div className="border-t border-[#E5E5E5] mb-5" />
              <div className="mb-5">
                <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Sub-POs · per destination</div>
                <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {['Destination', 'Priority', 'Ordered Qty', 'Received'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] border-b border-[#E5E5E5]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {po.sub_pos.map((s, i) => (
                        <tr key={i} className="hover:bg-[#FFF0F7]">
                          <td className="px-3 py-2 border-b border-[#E5E5E5]">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFF0F7] text-[#E31B7F] text-[10px] font-bold">{s.destination}</span>
                          </td>
                          <td className="px-3 py-2 border-b border-[#E5E5E5]"><PriorityBadge priority={s.priority || po.priority} /></td>
                          <td className="px-3 py-2 border-b border-[#E5E5E5] font-mono">{s.ordered_qty ?? '—'}</td>
                          <td className="px-3 py-2 border-b border-[#E5E5E5] font-mono">{s.qty_received ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
