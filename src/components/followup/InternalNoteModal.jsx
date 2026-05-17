import React, { useState } from 'react';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function InternalNoteModal({ po, onClose, onSaved }) {
  const [note, setNote] = useState(po?.internal_note || '');
  const [saving, setSaving] = useState(false);

  if (!po) return null;

  async function handleSave() {
    if (!po.last_ddd_update_id) { onClose(); return; }
    setSaving(true);
    const res = await base44.functions.invoke('saveFollowUpAction', {
      action_type: 'INTERNAL_NOTE',
      po_number: po.po_number,
      payload: { internal_note: note.trim(), last_ddd_update_id: po.last_ddd_update_id },
    });
    setSaving(false);
    if (res.data?.error) { alert(res.data.error); return; }
    onSaved(res.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] w-[520px] max-w-[calc(100vw-32px)] flex flex-col shadow-[0_8px_24px_rgba(227,27,127,.10),0_4px_8px_rgba(0,0,0,.04)] animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-base font-semibold text-[#0A0A0A]">Internal Last Comment</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-5">
          <dl className="grid text-xs mb-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[8px] p-3" style={{ gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
            <dt className="text-[#525252] font-semibold">PO</dt><dd className="font-mono font-bold">{po.po_number}</dd>
            <dt className="text-[#525252] font-semibold">Style</dt><dd className="font-mono">{po.style_color}</dd>
            <dt className="text-[#525252] font-semibold">Delay Response</dt><dd className="text-[#525252]">{po.delay_response_comment ? `"${po.delay_response_comment}"` : <span className="text-[#A3A3A3]">none yet</span>} <em className="text-[#A3A3A3]">(visible to DD)</em></dd>
          </dl>
          <div>
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-1.5">Internal note <span className="text-[#A3A3A3] font-normal">(optional)</span></label>
            <textarea
              className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-[6px] text-sm focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 resize-none min-h-[80px]"
              maxLength={500}
              placeholder="Write or update the purchase-team internal note for this PO. Not visible to the DD team."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <div className="text-[11px] text-[#A3A3A3] mt-1">Not sent to the DD team. Editable at any time.</div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="h-8 px-4 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-[#F8F8F8] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}