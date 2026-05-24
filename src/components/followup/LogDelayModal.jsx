import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { DD_REASONS_BY_GROUP, fmtDate } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';

// Normalize legacy single-reason rows into an array
function toReasonArray(r) {
  if (!r) return [];
  return Array.isArray(r) ? r : [r];
}

export default function LogDelayModal({ po, posBulk, onClose, onSaved, currentUser }) {
  const isBulk = !po && !!posBulk?.length;

  const [delayedDD, setDelayedDD] = useState(isBulk ? '' : (po?.effective_delayed_due_date || ''));
  const [reasons, setReasons] = useState(isBulk ? [] : toReasonArray(po?.ddd_reason));
  const [otherText, setOtherText] = useState(isBulk ? '' : (po?.ddd_reason_other_text || ''));
  const [comment, setComment] = useState(isBulk ? '' : (po?.ddd_comment || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!po && !posBulk?.length) return null;

  const isEdit = !isBulk && !!po.effective_delayed_due_date;
  const otherSelected = reasons.includes('Other');

  function toggleReason(r) {
    setReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function handleSave() {
    if (!delayedDD || reasons.length === 0 || !comment.trim()) {
      setError('Date, at least one reason, and a comment are required.');
      return;
    }
    if (otherSelected && !otherText.trim()) {
      setError('Please describe the "Other" reason.');
      return;
    }
    if (!isBulk && delayedDD <= po.due_date) {
      setError('Delayed DD must be after the original Due Date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const targets = isBulk ? posBulk : [po];
      for (const target of targets) {
        const res = await base44.functions.invoke('saveFollowUpAction', {
          action_type: 'DDD_UPDATE',
          po_number: target.po_number,
          payload: {
            new_due_date: delayedDD,
            reasons,
            reason_other_text: otherSelected ? otherText.trim() : null,
            ddd_comment: comment.trim(),
            previous_due_date: target.effective_delayed_due_date || target.due_date,
            original_due_date: target.due_date,
            is_urgent: target.urgent,
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
      setError('An error occurred.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] w-[560px] max-w-[calc(100vw-32px)] max-h-[90vh] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A]">
            {isBulk ? `Report delay · ${posBulk.length} POs` : isEdit ? 'Edit delay' : 'Report delay'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-5 overflow-y-auto flex-1">
          {/* Context */}
          {isBulk ? (
            <div className="mb-4 bg-[#FFF0F7] border border-[#FFE5F2] rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#E31B7F]">
              {posBulk.length} POs selected · same delay settings will apply to all
            </div>
          ) : (
            <dl className="grid text-xs mb-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3" style={{ gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
              <dt className="text-[#525252] font-semibold">PO</dt><dd className="font-mono font-bold">{po.po_number}</dd>
              <dt className="text-[#525252] font-semibold">Style</dt><dd className="font-mono">{po.style_color}</dd>
              <dt className="text-[#525252] font-semibold">Supplier</dt><dd>{po.supplier}</dd>
              <dt className="text-[#525252] font-semibold">Due Date</dt><dd>{fmtDate(po.due_date)}</dd>
              {isEdit && <><dt className="text-[#525252] font-semibold">Current Delayed DD</dt><dd>{fmtDate(po.effective_delayed_due_date)}</dd></>}
            </dl>
          )}

          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Delayed DD <span className="text-red-500">*</span></label>
            <input
              type="date"
              className="w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
              min={!isBulk ? po.due_date : undefined}
              value={delayedDD}
              onChange={e => setDelayedDD(e.target.value)}
            />
            {!isBulk && <div className="text-[11px] text-[#A3A3A3] mt-1">Must be later than the original Due Date.</div>}
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">
              DD Reasons <span className="text-red-500">*</span>
              <span className="text-[11px] font-normal text-[#A3A3A3] ml-1.5">select one or more</span>
            </label>
            <div className="border border-[#D4D4D4] rounded-[6px] max-h-[220px] overflow-y-auto bg-white">
              {DD_REASONS_BY_GROUP.map(g => (
                <div key={g.group} className="border-b border-[#E5E5E5] last:border-0">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.06em] text-[#A3A3A3] bg-[#FAFAFA]">{g.group}</div>
                  {g.reasons.map(r => {
                    const selected = reasons.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleReason(r)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[#FFF0F7] transition-colors ${selected ? 'bg-[#FFF0F7]' : ''}`}
                      >
                        <span className={`w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${selected ? 'bg-[#E31B7F] border-[#E31B7F]' : 'border-[#D4D4D4] bg-white'}`}>
                          {selected && <Check size={11} className="text-white" />}
                        </span>
                        <span className={selected ? 'text-[#E31B7F] font-semibold' : 'text-[#0A0A0A]'}>{r}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {/* Other option */}
              <div className="border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => toggleReason('Other')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[#FFF0F7] transition-colors ${otherSelected ? 'bg-[#FFF0F7]' : ''}`}
                >
                  <span className={`w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${otherSelected ? 'bg-[#E31B7F] border-[#E31B7F]' : 'border-[#D4D4D4] bg-white'}`}>
                    {otherSelected && <Check size={11} className="text-white" />}
                  </span>
                  <span className={otherSelected ? 'text-[#E31B7F] font-semibold' : 'text-[#0A0A0A]'}>Other (custom)</span>
                </button>
              </div>
            </div>
            {otherSelected && (
              <input
                type="text"
                className="mt-2 w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
                placeholder="Describe the other reason…"
                value={otherText}
                onChange={e => setOtherText(e.target.value)}
                maxLength={120}
              />
            )}
            {reasons.length > 0 && (
              <div className="text-[11px] text-[#525252] mt-1.5">{reasons.length} reason{reasons.length > 1 ? 's' : ''} selected</div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">DDD Comment <span className="text-red-500">*</span></label>
            <textarea
              className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[80px]"
              maxLength={500}
              placeholder="Briefly explain the cause of the delay…"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div className="text-[11px] text-[#A3A3A3] mt-1">{comment.length} / 500</div>
          </div>

          {error && <div className="text-sm text-red-500 font-medium mb-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isBulk ? `Save ${posBulk.length} reports` : 'Save report'}
          </button>
        </div>
      </div>
    </div>
  );
}