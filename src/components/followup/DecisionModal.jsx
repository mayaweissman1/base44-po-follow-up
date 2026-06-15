import React, { useState } from 'react';
import { X, Check, Info } from 'lucide-react';
import { STATUS_ENUM, DELAY_RESPONSE_OPTIONS, fmtDate } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';
import ReasonTag from './ReasonTag';

// Three status options — same icons as the row Actions cluster.
const STATUS_OPTIONS = [
  { key: 'APPROVED',     label: 'Approve',     Icon: Check, color: 'green' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledge', Icon: Info,  color: 'teal' },
  { key: 'REJECTED',     label: 'Reject',      Icon: X,     color: 'red' },
];

function StatusIconButton({ option, selected, onClick }) {
  const { Icon, color, label, key } = option;
  const palette = {
    green: { sel: 'bg-green-50 text-green-600 ring-green-500',  idle: 'text-[#A3A3A3] hover:bg-green-50 hover:text-green-600' },
    teal:  { sel: 'bg-teal-50 text-teal-600 ring-teal-500',     idle: 'text-[#A3A3A3] hover:bg-teal-50 hover:text-teal-600' },
    red:   { sel: 'bg-red-50 text-red-500 ring-red-500',        idle: 'text-[#A3A3A3] hover:bg-red-50 hover:text-red-500' },
  }[color];
  return (
    <button
      type="button"
      onClick={() => onClick(key)}
      title={label}
      className={`flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-[10px] transition-all ${selected ? `${palette.sel} ring-2` : palette.idle}`}
    >
      <Icon size={28} strokeWidth={2.5} />
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function DetailRow({ label, children }) {
  return (
    <>
      <dt className="text-[#525252] font-semibold">{label}</dt>
      <dd className="text-[#0A0A0A] min-w-0 break-words">{children}</dd>
    </>
  );
}

function DelayRequestDetails({ po }) {
  const original = po.due_date;
  const newDate = po.effective_delayed_due_date;
  const reasons = po.ddd_reasons && po.ddd_reasons.length > 0 ? po.ddd_reasons : (po.ddd_reason ? [po.ddd_reason] : []);
  const comment = po.ddd_comment;
  return (
    <div className="mb-5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] mb-2">Delay Request</div>
      <dl className="grid text-xs" style={{ gridTemplateColumns: 'max-content 1fr', gap: '6px 14px' }}>
        <DetailRow label="Original DD">
          <span className="font-mono">{fmtDate(original)}</span>
        </DetailRow>
        <DetailRow label="New DD">
          <span className="font-mono font-semibold text-[#E31B7F]">{newDate ? fmtDate(newDate) : '—'}</span>
        </DetailRow>
        <DetailRow label="Reason">
          {reasons.length > 0 ? <ReasonTag reasons={reasons} /> : <span className="text-[#A3A3A3]">—</span>}
        </DetailRow>
        <DetailRow label="Comment">
          {comment ? <span className="text-[#525252] leading-snug">{comment}</span> : <span className="text-[#A3A3A3]">—</span>}
        </DetailRow>
      </dl>
    </div>
  );
}

export default function DecisionModal({ po, posBulk, decision: initialDecision, onClose, onSaved }) {
  const isBulk = !po && !!posBulk?.length;
  const [decision, setDecision] = useState(initialDecision || null);
  const [preset, setPreset] = useState('');
  const [sendOnDate, setSendOnDate] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!po && !posBulk?.length) return null;

  const newLabel = decision ? (STATUS_ENUM[decision]?.name || decision) : null;
  const isOverride = !isBulk && decision && po.current_status && po.current_status !== 'HOLD' && po.current_status !== decision;
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
    if (!decision) {
      setError('Please select a status.');
      return;
    }
    const comment = buildComment();
    if (commentRequired && !comment) {
      setError('A comment is required when rejecting.');
      return;
    }
    if (preset === 'SEND_ON_DATE' && !sendOnDate) { setError('Please select a date.'); return; }
    if (preset === 'OTHER' && !otherText.trim()) { setError('Please enter the comment text.'); return; }
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
      <div className="relative bg-white rounded-[14px] w-[520px] max-w-[calc(100vw-32px)] max-h-[90vh] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <div>
            <h2 className="text-base font-semibold text-[#0A0A0A]">Respond to DD delay</h2>
            {isBulk ? (
              <div className="text-[11px] text-[#A3A3A3] mt-0.5">{posBulk.length} PO{posBulk.length > 1 ? 's' : ''} selected</div>
            ) : (
              <div className="text-[11px] text-[#A3A3A3] mt-0.5 font-mono">{po.po_number} · {po.style_color}</div>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto flex-1">
          {/* Request details — single-PO only */}
          {!isBulk && <DelayRequestDetails po={po} />}

          {/* Status selector — larger icon buttons with label below */}
          <div className="mb-5">
            <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] mb-2">Decision</label>
            <div className="flex items-center gap-3">
              {STATUS_OPTIONS.map(opt => (
                <StatusIconButton key={opt.key} option={opt} selected={decision === opt.key} onClick={k => { setDecision(k); setError(''); }} />
              ))}
            </div>
            {isOverride && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[6px] px-2.5 py-1.5">
                Currently <strong>{currentLabel}</strong>. Changing to <strong className={decisionColor}>{newLabel}</strong>.
              </div>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">
              Delay Response Comment{' '}
              {commentRequired
                ? <span className="text-red-500">*</span>
                : <span className="text-[#A3A3A3] font-normal">(optional)</span>}
            </label>
            <select
              className={`w-full h-9 px-3 border rounded-[6px] text-sm bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 ${error && commentRequired && !preset ? 'border-red-400' : 'border-[#D4D4D4]'}`}
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
            disabled={saving || !decision}
            className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isBulk ? `Confirm ${posBulk.length} POs` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}