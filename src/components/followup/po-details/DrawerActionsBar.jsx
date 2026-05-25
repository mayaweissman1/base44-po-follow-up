import React from 'react';
import { Check, Info, X, MessageSquare, Clock } from 'lucide-react';

/**
 * Action bar pinned to the bottom of the PO Details drawer.
 * Surfaces the same actions available in the table row, scoped by role.
 *
 *   - main_office:   Approve · Acknowledge · Reject · Internal note · View logs
 *   - dd_team_*:     Report/Edit delay · Update · View logs
 */
export default function DrawerActionsBar({ po, role, onDecide, onLogDelay, onGeneralUpdate, onInternalNote, onViewLogs }) {
  if (!po) return null;

  if (role === 'main_office') {
    return (
      <div className="flex-shrink-0 border-t border-[#E5E5E5] bg-white px-5 py-3">
        <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2">Decision</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={() => onDecide?.(po, 'APPROVED')}
            className="h-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-[8px] bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
          >
            <Check size={14} /> Approve
          </button>
          <button
            onClick={() => onDecide?.(po, 'ACKNOWLEDGED')}
            className="h-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-[8px] bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors"
          >
            <Info size={14} /> Acknowledge
          </button>
          <button
            onClick={() => onDecide?.(po, 'REJECTED')}
            className="h-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-[8px] bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <X size={14} /> Reject
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onInternalNote?.(po)}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-[6px] bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:border-[#E31B7F] transition-colors"
          >
            <MessageSquare size={12} /> Internal note
          </button>
          <button
            onClick={() => onViewLogs?.(po)}
            className="h-8 px-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-[6px] bg-white text-[#525252] border border-[#E5E5E5] hover:bg-[#F8F8F8] transition-colors"
          >
            <Clock size={12} /> Logs
          </button>
        </div>
      </div>
    );
  }

  // DD team manager / employee
  const hasDelay = !!po.effective_delayed_due_date;
  return (
    <div className="flex-shrink-0 border-t border-[#E5E5E5] bg-white px-5 py-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => onLogDelay?.(po)}
          className={`h-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-[8px] transition-colors ${
            hasDelay
              ? 'bg-white text-[#E31B7F] border border-[#E5E5E5] hover:bg-[#FFF0F7] hover:border-[#E31B7F]'
              : 'bg-[#E31B7F] text-white border border-[#E31B7F] hover:bg-[#C21571]'
          }`}
        >
          {hasDelay ? 'Edit delay' : 'Report delay'}
        </button>
        <button
          onClick={() => onGeneralUpdate?.(po)}
          className="h-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-[8px] bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:border-[#E31B7F] transition-colors"
        >
          Update
        </button>
      </div>
      <button
        onClick={() => onViewLogs?.(po)}
        className="w-full h-8 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-[6px] bg-white text-[#525252] border border-[#E5E5E5] hover:bg-[#F8F8F8] transition-colors"
      >
        <Clock size={12} /> View logs
      </button>
    </div>
  );
}