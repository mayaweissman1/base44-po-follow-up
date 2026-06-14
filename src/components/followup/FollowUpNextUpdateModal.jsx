import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Main Office "Follow up next update" — sets po_overrides.next_update_date
 * for one or more POs. No DDD decision is involved.
 */
export default function FollowUpNextUpdateModal({ po, posBulk, onClose, onSaved }) {
  const isBulk = !po && !!posBulk?.length;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [date, setDate] = useState(isBulk ? tomorrow : (po?.effective_next_update?.slice(0, 10) || tomorrow));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!po && !posBulk?.length) return null;

  async function handleSave() {
    if (!date) { setError('Please select a date.'); return; }
    if (date < today) { setError('Date must be today or later.'); return; }
    setError('');
    setSaving(true);
    try {
      const targets = isBulk ? posBulk : [po];
      for (const target of targets) {
        const res = await base44.functions.invoke('saveFollowUpAction', {
          action_type: 'FOLLOW_UP_NEXT_UPDATE',
          po_number: target.po_number,
          payload: {
            next_update_date: date,
            internal_note: note.trim() || null,
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
      <div className="relative bg-white rounded-[14px] w-[440px] max-w-[calc(100vw-32px)] shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <div>
            <h2 className="text-base font-semibold text-[#0A0A0A] flex items-center gap-2">
              <Calendar size={16} className="text-[#E31B7F]" />
              Follow up next update
            </h2>
            <div className="text-[11px] text-[#A3A3A3] mt-0.5">
              {isBulk
                ? `${posBulk.length} PO${posBulk.length > 1 ? 's' : ''} selected`
                : <span className="font-mono">{po.po_number} · {po.style_color}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors"><X size={16} /></button>
        </div>

        <div className="px-5 py-5">
          <div className="text-sm text-[#525252] mb-4">
            Set the date you'd like the DD team to provide the next update by. This updates the Next Update column.
          </div>

          <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Next Update Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            className="w-full h-9 px-3 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
          />

          <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5 mt-4">Internal note <span className="text-[#A3A3A3] font-normal">(optional)</span></label>
          <textarea
            className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[60px]"
            maxLength={200}
            placeholder="Note for the Main Office team…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div className="text-[11px] text-[#A3A3A3] mt-1">Visible to Main Office only.</div>

          {error && <div className="text-sm text-red-500 font-medium mt-2">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isBulk ? `Set for ${posBulk.length} POs` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}