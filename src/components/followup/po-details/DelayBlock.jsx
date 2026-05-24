import React from 'react';
import { AlertCircle } from 'lucide-react';
import { getResponsibility } from '@/lib/followUpConstants';
import ReasonTag from '../ReasonTag';

export default function DelayBlock({ po }) {
  if (!po.ddd_reason && !po.ddd_comment && !po.delay_response_comment) return null;

  const responsibility = getResponsibility(po.ddd_reason);
  const respColor = responsibility === 'SUPPLIER'
    ? 'bg-orange-50 text-orange-600 border-orange-200'
    : responsibility === 'EDIKTED'
    ? 'bg-purple-50 text-purple-600 border-purple-200'
    : 'bg-gray-50 text-gray-500 border-gray-200';

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] flex items-center gap-1.5">
          <AlertCircle size={11} className="text-red-400" />
          Delay Info
        </div>
        <div className="flex items-center gap-1.5">
          {po.ddd_reason && <ReasonTag reason={po.ddd_reason} />}
          {responsibility && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${respColor}`}>
              {responsibility}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {po.ddd_comment && (
          <Quote label="DD Manager" body={po.ddd_comment} />
        )}
        {po.delay_response_comment && (
          <Quote label="Main Office Response" body={po.delay_response_comment} accent />
        )}
        {po.internal_note && (
          <Quote label="Internal Note" body={po.internal_note} muted />
        )}
      </div>

      {(po.ddd_count > 0 || po.hold_age_days != null) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F0F0F0] text-[11px]">
          {po.ddd_count > 0 && (
            <span className="text-[#525252]">
              <strong className="font-semibold text-[#0A0A0A]">{po.ddd_count}</strong> delay request{po.ddd_count > 1 ? 's' : ''}
            </span>
          )}
          {po.hold_age_days != null && (
            <span className="text-[#525252]">
              On HOLD <strong className="font-semibold text-red-500">{po.hold_age_days <= 0 ? 'today' : `${po.hold_age_days}d ago`}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Quote({ label, body, accent = false, muted = false }) {
  const bar = accent ? 'border-[#E31B7F]' : muted ? 'border-[#D4D4D4]' : 'border-[#FFE5F2]';
  return (
    <div className={`border-l-2 ${bar} pl-3`}>
      <div className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] mb-0.5">{label}</div>
      <div className={`text-[12px] leading-snug ${muted ? 'text-[#525252] italic' : 'text-[#0A0A0A]'}`}>{body}</div>
    </div>
  );
}