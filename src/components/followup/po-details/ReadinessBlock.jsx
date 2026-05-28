import React from 'react';
import { CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';
import { fmtDate } from '@/lib/followUpConstants';

/**
 * Production Readiness — compact 4-up status strip.
 * Answers: "Is this PO actually ready to move?"
 *   • Bulk Fabric (approved / pending)
 *   • PPS Received (date or pending)
 *   • Days Same Status (stale alarm)
 *   • DD Date (the supplier's committed delivery date)
 */
export default function ReadinessBlock({ po }) {
  const hasPps = po.pps_receipt_date !== undefined;
  const hasDss = po.days_same_status != null;
  const hasDdDate = !!po.delivery_date;

  if (!hasPps && !hasDss && !hasDdDate) return null;

  const dssAlert = (po.days_same_status ?? 0) >= 7;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">
        Production Readiness
      </div>
      <div className="grid grid-cols-2 gap-2">
        {hasPps && (
          <ReadinessCell
            icon={po.pps_receipt_date ? CheckCircle2 : XCircle}
            label="PPS Received"
            value={po.pps_receipt_date ? fmtDate(po.pps_receipt_date) : 'Pending'}
            tone={po.pps_receipt_date ? 'success' : 'warning'}
            mono={!!po.pps_receipt_date}
          />
        )}
        {hasDdDate && (
          <ReadinessCell
            icon={Calendar}
            label="DD Date"
            value={fmtDate(po.delivery_date)}
            tone="neutral"
            mono
          />
        )}
        {hasDss && (
          <ReadinessCell
            icon={Clock}
            label="Same Status"
            value={`${po.days_same_status}d`}
            tone={dssAlert ? 'warning' : 'neutral'}
            mono
          />
        )}
      </div>
    </div>
  );
}

function ReadinessCell({ icon: Icon, label, value, tone, mono }) {
  const toneStyles = {
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', value: 'text-green-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', value: 'text-amber-700' },
    neutral: { bg: 'bg-[#FAFAFA]', border: 'border-[#F0F0F0]', icon: 'text-[#A3A3A3]', value: 'text-[#0A0A0A]' },
  }[tone] || {};

  return (
    <div className={`rounded-[8px] border ${toneStyles.border} ${toneStyles.bg} px-2.5 py-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={toneStyles.icon} />
        <span className="text-[9px] font-bold uppercase tracking-[.06em] text-[#525252]">{label}</span>
      </div>
      <div className={`${mono ? 'font-mono' : ''} text-[13px] font-semibold ${toneStyles.value} truncate`} title={value}>
        {value}
      </div>
    </div>
  );
}