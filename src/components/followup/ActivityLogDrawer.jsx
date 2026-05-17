import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { STATUS_ENUM, REASON_TO_RESPONSIBILITY, fmtDate, ddmm } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';
import StatusBadge from './StatusBadge';
import ReasonTag from './ReasonTag';

export default function ActivityLogDrawer({ po, userRole, onClose }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!po) return;
    setLoading(true);
    base44.functions.invoke('getPoActivityLog', { po_number: po.po_number })
      .then(res => {
        setUpdates(res.data?.updates || []);
        setLoading(false);
      });
  }, [po?.po_number]);

  if (!po) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white h-full w-[480px] max-w-full flex flex-col border-l border-[#E5E5E5] shadow-[−6px_0_24px_rgba(0,0,0,.12)] animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <div>
            <h2 className="text-base font-semibold text-[#0A0A0A]">Activity logs</h2>
            <div className="font-mono text-[#E31B7F] text-xs mt-0.5">{po.po_number}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && <div className="text-sm text-[#A3A3A3] text-center py-8">Loading…</div>}
          {!loading && updates.length === 0 && (
            <div className="text-sm text-[#A3A3A3] text-center py-8">No activity logged yet for this PO.</div>
          )}
          {!loading && updates.map((u, i) => {
            const initials = (u.actor_email || 'SYS').split('@')[0].slice(0, 2).toUpperCase();
            const isSystem = !u.actor_email;
            const when = new Date(u.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <div key={u.id || i} className="grid gap-3 py-3 border-b border-[#E5E5E5] last:border-0" style={{ gridTemplateColumns: '32px 1fr' }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 ${isSystem ? 'bg-[#A3A3A3]' : 'bg-gradient-to-br from-[#E31B7F] to-[#8B5CF6]'}`}>
                  {isSystem ? '⚙' : initials}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#0A0A0A] mb-0.5">
                    {u.type === 'DDD_UPDATE' ? `${u.actor_email?.split('@')[0] || 'System'} posted a DDD update` : `${u.actor_email?.split('@')[0] || 'System'} posted a general update`}
                    {u.status && u.status !== 'HOLD' && u.status !== 'AUTOMATICALLY' && u.decision_by_email && ` — decided by ${u.decision_by_email?.split('@')[0]}`}
                  </div>
                  <div className="text-[11px] text-[#A3A3A3] mb-1.5">{when}</div>

                  {u.type === 'DDD_UPDATE' && (
                    <>
                      {u.previous_due_date && u.new_due_date && (
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] px-2.5 py-1.5 mb-2">
                          <span className="line-through text-[#A3A3A3]">{fmtDate(u.previous_due_date)}</span>
                          <span className="text-[#A3A3A3]">→</span>
                          <span className="text-[#E31B7F] font-semibold">{fmtDate(u.new_due_date)}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 flex-wrap mb-1.5">
                        {u.status && <StatusBadge status={u.status} />}
                        {u.reason && <ReasonTag reason={u.reason} />}
                      </div>
                      {u.ddd_comment && (
                        <div className="text-xs text-[#525252] bg-[#FAFAFA] border-l-[3px] border-[#FFE5F2] px-2.5 py-1.5 rounded-[4px] mt-1">
                          "{u.ddd_comment}"
                        </div>
                      )}
                      {u.delay_response_comment && (
                        <div className="text-xs text-[#525252] mt-1.5">
                          <span className="font-semibold text-[#0A0A0A]">Response: </span>"{u.delay_response_comment}"
                        </div>
                      )}
                      {userRole === 'main_office' && u.internal_note && (
                        <div className="text-xs text-[#525252] mt-1.5 italic">
                          <span className="font-semibold text-purple-600">Internal: </span>"{u.internal_note}"
                        </div>
                      )}
                    </>
                  )}

                  {u.type === 'GENERAL_UPDATE' && (
                    <div className="text-xs text-[#525252] bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] px-2.5 py-2 space-y-0.5">
                      {u.dd_status && <div><span className="font-semibold text-[#0A0A0A]">DD Status →</span> {u.dd_status}</div>}
                      {u.general_comment && <div><span className="font-semibold text-[#0A0A0A]">DD Comment →</span> "{u.general_comment === 'Other' ? u.general_comment_other_text : u.general_comment}"</div>}
                      {u.next_update_date && <div><span className="font-semibold text-[#0A0A0A]">Next Update →</span> {fmtDate(u.next_update_date)}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}