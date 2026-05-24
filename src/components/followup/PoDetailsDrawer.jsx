import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import HeroBlock from './po-details/HeroBlock';
import ProgressBlock from './po-details/ProgressBlock';
import DelayBlock from './po-details/DelayBlock';
import MetaBlock from './po-details/MetaBlock';
import TimelineBlock from './po-details/TimelineBlock';

export default function PoDetailsDrawer({ po, onClose }) {
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (!po?.po_number) return;
    let cancelled = false;
    setDetails(null);
    base44.functions.invoke('getPoDetails', { po_number: po.po_number }).then(res => {
      if (cancelled) return;
      setDetails(res?.data || null);
    });
    return () => { cancelled = true; };
  }, [po?.po_number]);

  if (!po) return null;

  const orderType = po.po_number.endsWith('-CL') ? 'CL' : po.po_number.endsWith('-AC') ? 'ACC' : 'Regular';
  const destStr = po.sub_pos?.map(s => s.destination).filter(Boolean).join(' · ') || po.destination || null;

  // Aggregate quantities across sub-POs — API returns strings, coerce.
  const totalOrdered = po.sub_pos?.length
    ? po.sub_pos.reduce((sum, s) => sum + (Number(s.ordered_qty) || 0), 0)
    : (Number(po.ordered_qty) || null);
  const totalReceived = po.sub_pos?.length
    ? po.sub_pos.reduce((sum, s) => sum + (Number(s.qty_received) || 0), 0)
    : (Number(po.qty_received) || null);

  // GFS aggregated from getPoDetails size breakdown
  const totalGfs = details?.destinations?.length
    ? details.destinations.reduce((t, d) => t + d.sizes.reduce((s, sz) => s + (sz.good_for_sale || 0), 0), 0)
    : null;

  const airOtw   = po.air_otw   ?? po.otw ?? details?.air_otw   ?? null;
  const manualRw = po.manual_rw ?? details?.manual_rw ?? null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[460px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col overflow-hidden">

        {/* Sticky Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0 bg-white">
          <div className="min-w-0 flex-1">
            <div className="font-mono font-bold text-[#0A0A0A] text-base">{po.po_number}</div>
            <div className="text-[12px] text-[#525252] mt-0.5 font-medium truncate">{po.style_color}</div>
            {destStr && <div className="text-[11px] text-[#A3A3A3] mt-0.5 truncate">{destStr}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <HeroBlock po={po} />
          <ProgressBlock
            ordered={totalOrdered}
            received={totalReceived}
            sentOut={po.qty_sent_out}
            gfs={totalGfs}
            airOtw={airOtw}
            manualRw={manualRw}
            shippedPct={po.shipped_percent}
          />
          <DelayBlock po={po} />
          <MetaBlock po={po} destStr={destStr} orderType={orderType} />
          <TimelineBlock log={po.dd_comment_log} />
        </div>
      </div>
    </div>
  );
}