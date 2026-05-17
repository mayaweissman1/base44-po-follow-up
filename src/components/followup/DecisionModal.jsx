import React, { useState } from 'react';
import { X } from 'lucide-react';
import { STATUS_ENUM } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';

export default function DecisionModal({ po, decision, onClose, onSaved }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  if (!po || !decision) return null;

  const newLabel = STATUS_ENUM[decision]?.name || decision;
  const isOverride = po.current_status && po.current_status !== 'HOLD';
  const currentLabel = po.current_status ? STATUS_ENUM[po.current_status]?.name : null;

  async function handleConfirm() {
    if (!po.last_ddd_update_id) return;
    setSaving(true);
    const res = await base44.functions.invoke('saveFollowUpAction', {
      action_type: 'DECISION',
      po_number: po.po_number,
      payload: {
        decision,
        delay_response_comment: comment.trim() || null,
        last_ddd_update_id: po.last_ddd_update_id,
      },
    });
    setSaving(false);
    if (res.data?.error) { alert(res.data.error); return; }
    onSaved(res.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] w-[420px] max-w-[calc(100vw-32px)] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A]">{isOverride ? 'Change decision?' : `Mark as ${newLabel}?`}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-[#525252] leading-relaxed mb-4">
            {isOverride
              ? <><strong className="text-[#0A0A0A]">{po.po_number}</strong> is currently <strong className="text-[#0A0A0A]">{currentLabel}</strong>. Change it to <strong className="text-[#0A0A0A]">{newLabel}</strong>?</>
              : <>Mark <strong className="text-[#0A0A0A]">{po.po_number}</strong> as <strong className="text-[#0A0A0A]">{newLabel}</strong>.</>
            }
          </p>
          <div>
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Delay Response Comment <span className="text-[#A3A3A3] font-normal">(optional)</span></label>
            <textarea
              className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[72px]"
              placeholder="Add context for the DD team (will be saved in the activity log)…"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div className="text-[11px] text-[#A3A3A3] mt-1">Leave blank to confirm without a comment.</div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={saving || !po.last_ddd_update_id} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}