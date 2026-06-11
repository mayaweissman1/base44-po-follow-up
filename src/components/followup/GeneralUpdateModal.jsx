import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DD_STATUS_OPTIONS, STATUS_COMMENT_TEMPLATES, fmtDate } from '@/lib/followUpConstants';
import { base44 } from '@/api/base44Client';

export default function GeneralUpdateModal({ po, posBulk, onClose, onSaved }) {
  const isBulk = !po && !!posBulk?.length;

  const [ddStatus, setDdStatus] = useState('');
  const [templateSel, setTemplateSel] = useState('');
  const [commentText, setCommentText] = useState('');
  const [nextUpdate, setNextUpdate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset template + comment when status changes
  useEffect(() => {
    setTemplateSel('');
    setCommentText('');
  }, [ddStatus]);

  // Pre-fill text area when a template is chosen
  useEffect(() => {
    if (templateSel) setCommentText(templateSel);
  }, [templateSel]);

  if (!po && !posBulk?.length) return null;

  const templates = ddStatus ? (STATUS_COMMENT_TEMPLATES[ddStatus] || []) : [];
  const hasTemplates = templates.length > 0;

  // Next-update cap: 5 days if any selected PO is urgent, else 7 days.
  // For bulk: if ANY PO is urgent, apply the stricter 5-day cap.
  const targets = isBulk ? posBulk : (po ? [po] : []);
  const anyUrgent = targets.some(t => t?.urgent);
  const maxDays = anyUrgent ? 5 : 7;
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + maxDays);
  const maxDateStr = maxDate.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  async function handleSave() {
    if (!ddStatus && !commentText.trim() && !nextUpdate) {
      setError('Change at least one field.');
      return;
    }
    if (nextUpdate && nextUpdate > maxDateStr) {
      setError(`Next Update date can't be more than ${maxDays} days from today${anyUrgent ? ' (urgent PO)' : ''}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const targets = isBulk ? posBulk : [po];
      for (const target of targets) {
        const res = await base44.functions.invoke('saveFollowUpAction', {
          action_type: 'GENERAL_UPDATE',
          po_number: target.po_number,
          payload: {
            dd_status: ddStatus || null,
            general_comment: commentText.trim() ? 'Other' : null,
            general_comment_other_text: commentText.trim() || null,
            next_update_date: nextUpdate || null,
            current_dd_status: target.effective_dd_status,
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
      <div className="relative bg-white rounded-[14px] w-[520px] max-w-[calc(100vw-32px)] max-h-[90vh] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A]">
            {isBulk ? `Add update · ${posBulk.length} POs` : 'Add update'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-5 overflow-y-auto flex-1">
          {isBulk ? (
            <div className="mb-4 bg-[#FFF0F7] border border-[#FFE5F2] rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#E31B7F]">
              {posBulk.length} POs selected · same update settings will apply to all
            </div>
          ) : (
            <dl className="grid text-xs mb-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3" style={{ gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
              <dt className="text-[#525252] font-semibold">PO</dt><dd className="font-mono font-bold">{po.po_number}</dd>
              <dt className="text-[#525252] font-semibold">Style</dt><dd className="font-mono">{po.style_color}</dd>
              <dt className="text-[#525252] font-semibold">Current Stage</dt><dd>{po.effective_dd_status || '—'}</dd>
              <dt className="text-[#525252] font-semibold">Next Update</dt><dd>{fmtDate(po.effective_next_update) || '—'}</dd>
            </dl>
          )}

          {/* DD Status */}
          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Production Stage</label>
            <select
              className="w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
              value={ddStatus}
              onChange={e => setDdStatus(e.target.value)}
            >
              <option value="">— No change —</option>
              {DD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="text-[11px] text-[#A3A3A3] mt-1">Leave as "No change" to keep the current value.</div>
          </div>

          {/* Comment — template picker if status has templates, else free text */}
          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Comment</label>

            {hasTemplates && (
              <select
                className="w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 mb-2"
                value={templateSel}
                onChange={e => setTemplateSel(e.target.value)}
              >
                <option value="">— Pick a template or write freely below —</option>
                {templates.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            <textarea
              className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[72px]"
              maxLength={500}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={hasTemplates ? 'Select a template above, or type freely. Replace [date] / [X/Y] with actual values.' : 'Describe the update…'}
            />
            {hasTemplates && commentText.includes('[') && (
              <div className="text-[11px] text-amber-500 mt-1">Replace all [ ] placeholders with actual values before saving.</div>
            )}
          </div>

          {/* Next Update */}
          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Next Update date</label>
            <input
              type="date"
              min={todayStr}
              max={maxDateStr}
              className="w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
              value={nextUpdate}
              onChange={e => setNextUpdate(e.target.value)}
            />
            <div className="text-[11px] text-[#A3A3A3] mt-1">
              Max {maxDays} days from today{anyUrgent ? ' (urgent PO)' : ''} · up to {fmtDate(maxDateStr)}
            </div>
          </div>

          {error && <div className="text-sm text-red-500 font-medium mb-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isBulk ? `Save ${posBulk.length} updates` : 'Save update'}
          </button>
        </div>
      </div>
    </div>
  );
}