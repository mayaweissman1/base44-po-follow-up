import React, { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function MarkUrgentConfirmModal({ po, onClose, onSaved }) {
  const alreadyMarked = !!po?.marked_urgent;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!po) return null;

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('saveFollowUpAction', {
        action_type: 'MARK_URGENT',
        po_number: po.po_number,
        payload: {
          marked_urgent: !alreadyMarked,
          marked_urgent_reason: !alreadyMarked && reason.trim() ? reason.trim().slice(0, 200) : null,
        },
      });
      if (res.data?.error) {
        setError(res.data.error);
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('An error occurred.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] w-[460px] max-w-[calc(100vw-32px)] shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A] flex items-center gap-2">
            <Zap size={16} className={alreadyMarked ? 'text-[#A3A3A3]' : 'text-[#E31B7F]'} />
            {alreadyMarked ? 'Remove urgent mark?' : 'Mark PO as urgent?'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-5">
          <dl className="grid text-xs mb-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3" style={{ gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
            <dt className="text-[#525252] font-semibold">PO</dt><dd className="font-mono font-bold">{po.po_number}</dd>
            <dt className="text-[#525252] font-semibold">Style</dt><dd className="font-mono">{po.style_color}</dd>
            <dt className="text-[#525252] font-semibold">Current Priority</dt><dd>{po.urgent_priority || 'Normal'}</dd>
          </dl>

          {alreadyMarked ? (
            <div className="text-sm text-[#525252] mb-3">
              Removing the urgent mark will restore the computed priority for this PO.
            </div>
          ) : (
            <>
              <div className="text-sm text-[#525252] mb-3">
                This PO will be tagged <strong className="text-[#E31B7F]">MANUAL</strong> in the Urgent Priority column, overriding the computed value. DD team will see it as urgent.
              </div>
              <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Reason (optional)</label>
              <textarea
                className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[60px]"
                maxLength={200}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why is this PO urgent?"
              />
              <div className="text-[11px] text-[#A3A3A3] mt-1">{reason.length}/200</div>
            </>
          )}

          {error && <div className="text-sm text-red-500 font-medium mt-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={saving} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : alreadyMarked ? 'Remove mark' : 'Mark as urgent'}
          </button>
        </div>
      </div>
    </div>
  );
}