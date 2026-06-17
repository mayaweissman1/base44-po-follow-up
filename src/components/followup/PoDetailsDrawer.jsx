import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import HeroBlock from './po-details/HeroBlock';
import ProgressBlock from './po-details/ProgressBlock';
import ReadinessBlock from './po-details/ReadinessBlock';
import DelayBlock from './po-details/DelayBlock';
import MetaBlock from './po-details/MetaBlock';
import TimelineBlock from './po-details/TimelineBlock';
import ShipmentDetailsBlock from './po-details/ShipmentDetailsBlock';
import DrawerErrorBoundary from './po-details/DrawerErrorBoundary';
import StyleThumbnail from './StyleThumbnail';

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

  const orderType = po.po_type || null;
  const destStr = po.sub_pos?.map(s => s.destination).filter(Boolean).join(' · ') || po.destination || null;

  // Quantities come from po_view (PO totals). sub_pos in this payload only
  // carries destination labels, not quantities.
  const totalOrdered = Number(po.ordered_qty) || null;
  const totalReceived = Number(po.qty_received) || null;

  // GFS aggregated from getPoDetails size breakdown
  const totalGfs = Array.isArray(details?.destinations)
    ? details.destinations.reduce((total, destination) => {
        const sizes = Array.isArray(destination?.size_breakdown) ? destination.size_breakdown : [];
        return total + sizes.reduce((sum, size) => sum + (Number(size.good_for_sale) || 0), 0);
      }, 0)
    : null;

  const airOtw = po.air_otw ?? po.otw ?? details?.air_otw ?? null;
  const autoRw = po.auto_rw ?? po.qty_rw_auto ?? details?.auto_rw ?? null;
  const manualRw = po.manual_rw ?? po.qty_rw_manual ?? details?.manual_rw ?? null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-[460px] max-w-[calc(100vw-32px)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.12)] flex flex-col overflow-hidden">

        {/* Sticky Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[#E5E5E5] flex-shrink-0 bg-white">
          <StyleThumbnail styleColor={po.style_color} imageUrl={po.product_image} size={64} />
          <div className="min-w-0 flex-1">
            <div className="font-mono font-bold text-[#0A0A0A] text-base">{po.po_number}</div>
            <div className="text-[12px] text-[#525252] mt-0.5 font-medium truncate">{po.style_color}</div>
            {destStr && <div className="text-[11px] text-[#A3A3A3] mt-0.5 truncate">{destStr}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body — each block in its own boundary so a render
            error in one section doesn't blank the whole drawer. */}
        <div className="flex-1 overflow-y-auto">
          <DrawerErrorBoundary><HeroBlock po={po} /></DrawerErrorBoundary>
          <DrawerErrorBoundary>
            <ProgressBlock
              ordered={totalOrdered}
              received={totalReceived}
              sentOut={po.qty_sent_out}
              gfs={totalGfs}
              airOtw={airOtw}
              autoRw={autoRw}
              manualRw={manualRw}
            />
          </DrawerErrorBoundary>
          <DrawerErrorBoundary><DelayBlock po={po} /></DrawerErrorBoundary>
          <DrawerErrorBoundary><ShipmentDetailsBlock destinations={details?.destinations || []} /></DrawerErrorBoundary>
          <DrawerErrorBoundary><MetaBlock po={po} destStr={destStr} orderType={orderType} /></DrawerErrorBoundary>
          <DrawerErrorBoundary><TimelineBlock log={po.dd_comment_log} /></DrawerErrorBoundary>
          <DrawerErrorBoundary><ReadinessBlock po={po} /></DrawerErrorBoundary>
        </div>
      </div>
    </div>
  );
}