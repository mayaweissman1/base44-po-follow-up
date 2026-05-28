import React, { useState } from 'react';
import { X } from 'lucide-react';
import { STATUS_ENUM, DELAY_RESPONSE_OPTIONS } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';

export default function DecisionModal({ po, posBulk, decision, onClose, onSaved }) {
  const isBulk = !po && !!posBulk?.length;

  const [preset, setPreset] = useState('');
  const [sendOnDate, setSendOnDate] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!po && !posBulk?.length) return null;
  if (!decision) return null;

  const newLabel = STATUS_ENUM[decision]?.name || decision;
  const isOverride = !isBulk && po.current_status && po.current_status !== 'HOLD';
  const currentLabel = !isBulk && po.current_status ? STATUS_ENUM[po.current_status]?.name : null;
  const commentRequired = decision === 'REJECTED';

  const decisionColor = decision === 'APPROVED' ? 'text-green-600'
    : decision === 'REJECTED' ? 'text-red-500' : 'text-teal-600';

  function buildComment() {
    if (!preset) return null;
    if (preset === 'SEND_ON_DATE') return `Push to send on ${sendOnDate || '[date]'}`;
    if (preset === 'OTHER') return otherText.trim() || null;
    return DELAY_RESPONSE_OPTIONS.find(o => o.key === preset)?.label || null;
  }

  async function handleConfirm() {
    const comment = buildComment();
    if (commentRequired && !comment) {
      setError('A comment is required when rejecting.');
      return;
    }
    if (preset === 'SEND_ON_DATE' && !sendOnDate) {
      setError('Please select a date.');
      return;
    }
    if (preset === 'OTHER' && !otherText.trim()) {
      setError('Please enter the comment text.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const targets = isBulk ? posBulk : [po];
      for (const target of targets) {
        if (!target.last_ddd_update_id) continue;
        const res = await base44.functions.invoke('saveFollowUpAction', {
          action_type: 'DECISION',
          po_number: target.po_number,
          payload: {
            decision,
            delay_response_comment: comment,
            delay_response_comment_preset: preset || null,
            last_ddd_update_id: target.last_ddd_update_id,
          },
        });
        if (res.data?.error) {
          setError(`Error on ${target.po_number}: ${res.data.error}`);
          setSaving(false);
          return;
        }
      }
      onSaved();
    } catch {
      setError('An error occurred. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] w-[480px] max-w-[calc(100vw-32px)] max-h-[90vh] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A]">
            {isBulk
              ? `Mark ${posBulk.length} PO${posBulk.length > 1 ? 's' : ''} as ${newLabel}`
              : isOverride ? 'Change decision?' : `Mark as ${newLabel}?`}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto flex-1">
          {isBulk ? (
            <div className="mb-4 bg-[#FFF0F7] border border-[#FFE5F2] rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#E31B7F]">
              {posBulk.length} POs selected · same decision &amp; comment will apply to all
            </div>
          ) : (
            <p className="text-sm text-[#525252] leading-relaxed mb-4">
              {isOverride
                ? <><strong className="text-[#0A0A0A]">{po.po_number}</strong> is currently <strong className={decisionColor}>{currentLabel}</strong>. Change to <strong className={decisionColor}>{newLabel}</strong>?</>
                : <>Mark <strong className="text-[#0A0A0A]">{po.po_number}</strong> as <strong className={decisionColor}>{newLabel}</strong>.</>}
            </p>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">
              Delay Response Comment{' '}
              {commentRequired
                ? <span className="text-red-500">*</span>
                : <span className="text-[#A3A3A3] font-normal">(optional)</span>}
            </label>
            <select
              className={`w-full h-9 px-3 border rounded-[6px] text-sm bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 ${error && !preset ? 'border-red-400' : 'border-[#D4D4D4]'}`}
              value={preset}
              onChange={e => { setPreset(e.target.value); setError(''); }}
            >
              <option value="">— No comment —</option>
              {DELAY_RESPONSE_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            {preset === 'SEND_ON_DATE' && (
              <input
                type="date"
                className="w-full h-9 px-3 mt-2 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
                value={sendOnDate}
                onChange={e => setSendOnDate(e.target.value)}
              />
            )}

            {preset === 'OTHER' && (
              <textarea
                className="w-full mt-2 px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[72px]"
                maxLength={280}
                placeholder="Explain the decision…"
                value={otherText}
                onChange={e => { setOtherText(e.target.value); setError(''); }}
              />
            )}

            {isBulk && preset && (
              <div className="text-[11px] text-[#A3A3A3] mt-1.5">
                This comment will be sent to all {posBulk.length} selected POs.
              </div>
            )}

            <div className="text-[11px] text-[#A3A3A3] mt-1">
              {commentRequired
                ? 'Required — the DD team will see this explanation.'
                : 'Leave blank to confirm without a comment.'}
            </div>
            {error && <div className="text-xs text-red-500 font-medium mt-1.5">{error}</div>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isBulk ? `Confirm ${posBulk.length} POs` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
