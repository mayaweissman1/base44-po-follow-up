import React from 'react';
import { MessageSquare, Calendar, X, FileDown } from 'lucide-react';

export default function BulkActionBar({
  count, role,
  onRespond, onFollowUp,
  onBulkLogDelay, onBulkGeneralUpdate,
  onExport, onClear,
}) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-[#E31B7F] text-white rounded-[12px] px-4 py-2.5 flex items-center gap-3 shadow-[0_8px_24px_rgba(227,27,127,.35)]">
        <span className="text-xs font-semibold text-white/80 whitespace-nowrap">{count} selected</span>
        <div className="w-px h-4 bg-white/30" />

        {role === 'main_office' && (
          <>
            <button onClick={onRespond} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center gap-1.5">
              <MessageSquare size={12} /> Respond
            </button>
            <button onClick={onFollowUp} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center gap-1.5">
              <Calendar size={12} /> Follow up
            </button>
          </>
        )}

        {(role === 'dd_team_manager' || role === 'dd_team_employee') && (
          <>
            <button onClick={onBulkLogDelay} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/20 text-white hover:bg-white/30 transition-colors">
              Report delay
            </button>
            <button onClick={onBulkGeneralUpdate} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/20 text-white hover:bg-white/30 transition-colors">
              Add update
            </button>
          </>
        )}

        <div className="w-px h-4 bg-white/30" />
        <button onClick={onExport} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center gap-1.5">
          <FileDown size={12} /> Export
        </button>
        <button onClick={onClear} title="Clear selection" className="w-6 h-6 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/20 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}