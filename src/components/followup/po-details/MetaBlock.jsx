import React, { useState } from 'react';
import { User, Truck, MapPin, Package, Calendar, Tag, Bell, Hash, Layers, Send, Inbox, ChevronDown, MessageCircle } from 'lucide-react';
import { fmtDate } from '@/lib/followUpConstants';
import PmTagsPills from '../PmTagsPills';

/**
 * Details block — focused, scannable.
 *
 * Primary content (always visible):
 *   • Delivery Status note from supplier (quote, top)
 *   • People & Routing (DD Manager, Supplier, Destinations)
 *   • Order (Collection, Order Type, Order Date, Next Update)
 *   • PM Tags
 *
 * Secondary content (collapsed under "More"):
 *   • Set With, PO Rank, Drop, Goods Received
 */
export default function MetaBlock({ po, destStr, orderType }) {
  const [showMore, setShowMore] = useState(false);

  const hasPmTags = !!po.pm_tags_label;
  const deliveryStatus = po.delivery_date_status;

  const peopleRouting = [
    po.dd_manager_name && { icon: User, label: 'DD Manager', value: po.dd_manager_name, variant: 'pink' },
    po.supplier && { icon: Truck, label: 'Supplier', value: po.supplier, variant: 'teal' },
    destStr && { icon: MapPin, label: 'Destinations', value: destStr },
  ].filter(Boolean);

  const order = [
    po.collection && { icon: Package, label: 'Collection', value: po.collection, mono: true },
    orderType && { icon: Tag, label: 'Order Type', value: orderType, variant: 'gray' },
    po.order_date && { icon: Calendar, label: 'Order Date', value: fmtDate(po.order_date), mono: true },
    po.effective_next_update && { icon: Bell, label: 'Next Update', value: fmtDate(po.effective_next_update), mono: true },
  ].filter(Boolean);

  const more = [
    po.set_with && { icon: Layers, label: 'Set With', value: po.set_with, mono: true },
    po.po_rank != null && { icon: Hash, label: 'PO Rank', value: String(po.po_rank), mono: true },
    po.drop && { icon: Send, label: 'Drop', value: fmtDate(po.drop), mono: true },
    po.goods_received && { icon: Inbox, label: 'Goods Received', value: fmtDate(po.goods_received), mono: true },
  ].filter(Boolean);

  const hasContent = !!deliveryStatus || peopleRouting.length || order.length || more.length || hasPmTags;
  if (!hasContent) return null;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Details</div>

      {deliveryStatus && (
        <div className="mb-3 pl-3 border-l-2 border-[#E31B7F] bg-[#FFF0F7]/40 py-1.5 pr-2 rounded-r-[6px]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageCircle size={10} className="text-[#E31B7F]" />
            <span className="text-[9px] font-bold text-[#E31B7F] uppercase tracking-[.06em]">Supplier note</span>
          </div>
          <div className="text-[12px] text-[#0A0A0A] leading-snug">{deliveryStatus}</div>
        </div>
      )}

      <div className="space-y-3">
        {peopleRouting.length > 0 && <DetailGroup rows={peopleRouting} />}
        {order.length > 0 && <DetailGroup rows={order} />}
      </div>

      {hasPmTags && (
        <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={11} className="text-[#E31B7F]" />
            <span className="text-[10px] font-bold text-[#525252] uppercase tracking-[.08em]">PM Tags</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <PmTagsPills label={po.pm_tags_label} max={20} />
          </div>
        </div>
      )}

      {more.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
          <button
            onClick={() => setShowMore(s => !s)}
            className="w-full flex items-center justify-between text-[10px] font-bold text-[#525252] uppercase tracking-[.08em] hover:text-[#E31B7F] transition-colors"
          >
            <span>More info ({more.length})</span>
            <ChevronDown size={12} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>
          {showMore && (
            <div className="mt-2">
              <DetailGroup rows={more} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailGroup({ rows }) {
  return (
    <div className="bg-[#FAFAFA] rounded-[8px] border border-[#F0F0F0] divide-y divide-[#F0F0F0]">
      {rows.map((r, i) => (
        <DetailRow key={i} {...r} />
      ))}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, variant, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={12} className="text-[#A3A3A3] flex-shrink-0" />
        <span className="text-[11px] text-[#525252] font-medium">{label}</span>
      </div>
      <div className="text-right min-w-0 max-w-[60%]">
        <ValueRenderer value={value} variant={variant} mono={mono} />
      </div>
    </div>
  );
}

function ValueRenderer({ value, variant, mono }) {
  if (variant === 'pink') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{value}</span>;
  }
  if (variant === 'teal') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{value}</span>;
  }
  if (variant === 'gray') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-white text-[#525252] border border-[#E5E5E5]">{value}</span>;
  }
  return (
    <span
      className={`${mono ? 'font-mono' : ''} font-semibold text-[12px] text-[#0A0A0A] truncate inline-block max-w-full`}
      title={value}
    >
      {value}
    </span>
  );
}