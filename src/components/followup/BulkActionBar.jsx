import React from 'react';
import { Check, Info, X, FileDown } from 'lucide-react';

export default function BulkActionBar({ count, role, onApproveAll, onAcknowledgeAll, onRejectAll, onBulkLogDelay, onBulkGeneralUpdate, onExport, onClear }) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-[#0A0A0A] text-white rounded-[12px] px-4 py-2.5 flex items-center gap-3 shadow-[0_8px_24px_rgba(0,0,0,.25)]">
        <span className="text-xs font-semibold text-white/60 whitespace-nowrap">{count} selected</span>
        <div className="w-px h-4 bg-white/20" />

        {role === 'main_office' && (
          <>
            <button onClick={onApproveAll} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1.5">
              <Check size={12} /> Approve all
            </button>
            <button onClick={onAcknowledgeAll} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-teal-500 text-white hover:bg-teal-600 transition-colors flex items-center gap-1.5">
              <Info size={12} /> Acknowledge all
            </button>
            <button onClick={onRejectAll} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5">
              <X size={12} /> Reject all
            </button>
          </>
        )}

        {role === 'dd_team_employee' && (
          <>
            <button onClick={onBulkLogDelay} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-[#E31B7F] text-white hover:bg-[#C21571] transition-colors">
              Report delay
            </button>
            <button onClick={onBulkGeneralUpdate} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/10 text-white hover:bg-white/20 transition-colors">
              Add update
            </button>
          </>
        )}

        <div className="w-px h-4 bg-white/20" />
        <button onClick={onExport} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-1.5">
          <FileDown size={12} /> Export
        </button>
        <button onClick={onClear} title="Clear selection" className="w-6 h-6 flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
