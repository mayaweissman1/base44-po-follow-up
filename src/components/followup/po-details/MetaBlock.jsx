import React from 'react';
import { User, Truck, MapPin, Package, Calendar, Tag, Activity, Bell, Hash, Clock, CheckCircle, Layers, Send, Inbox } from 'lucide-react';
import { fmtDate } from '@/lib/followUpConstants';
import DdStatusBadge from '../DdStatusBadge';
import PmTagsPills from '../PmTagsPills';

/**
 * Details block — grouped, scannable layout.
 *
 * Logical groups:
 *   1. People (DD Manager, Supplier)
 *   2. Order Info (Destinations, Collection, Order Type, Order Date, Set With, Drop, PO Rank)
 *   3. Status (DD Status, Days Same Status, DD Date, Delivery Status, Next Update, Goods Received)
 *   4. Production Approvals (Bulk Fabric, PPS Receipt Date)
 * Plus a highlighted PM Tags row at the bottom.
 */
export default function MetaBlock({ po, destStr, orderType }) {
  const hasPmTags = !!po.pm_tags_label;

  const people = [
    po.dd_manager_name && { icon: User, label: 'DD Manager', value: po.dd_manager_name, variant: 'pink' },
    po.supplier && { icon: Truck, label: 'Supplier', value: po.supplier, variant: 'teal' },
  ].filter(Boolean);

  const orderInfo = [
    destStr && { icon: MapPin, label: 'Destinations', value: destStr },
    po.collection && { icon: Package, label: 'Collection', value: po.collection, mono: true },
    orderType && { icon: Tag, label: 'Order Type', value: orderType, variant: 'gray' },
    po.order_date && { icon: Calendar, label: 'Order Date', value: fmtDate(po.order_date), mono: true },
    po.set_with && { icon: Layers, label: 'Set With', value: po.set_with, mono: true },
    po.drop && { icon: Send, label: 'Drop', value: fmtDate(po.drop), mono: true },
    po.po_rank != null && { icon: Hash, label: 'PO Rank', value: String(po.po_rank), mono: true },
  ].filter(Boolean);

  const status = [
    po.effective_dd_status && { icon: Activity, label: 'DD Status', value: po.effective_dd_status, variant: 'dd-status' },
    po.days_same_status != null && { icon: Clock, label: 'Days Same Status', value: `${po.days_same_status}d`, mono: true },
    po.delivery_date && { icon: Calendar, label: 'DD Date', value: fmtDate(po.delivery_date), mono: true },
    po.delivery_date_status && { icon: Activity, label: 'Delivery Status', value: po.delivery_date_status },
    po.effective_next_update && { icon: Bell, label: 'Next Update', value: fmtDate(po.effective_next_update), mono: true },
    po.goods_received && { icon: Inbox, label: 'Goods Received', value: fmtDate(po.goods_received), mono: true },
  ].filter(Boolean);

  const production = [
    po.bulk_fabric_approval != null && {
      icon: CheckCircle,
      label: 'Bulk Fabric',
      value: po.bulk_fabric_approval ? 'Approved' : 'Pending',
      variant: po.bulk_fabric_approval ? 'success' : 'warning',
    },
    po.pps_receipt_date && { icon: Calendar, label: 'PPS Receipt Date', value: fmtDate(po.pps_receipt_date), mono: true },
  ].filter(Boolean);

  if (people.length === 0 && orderInfo.length === 0 && status.length === 0 && production.length === 0 && !hasPmTags) return null;

  return (
    <div className="px-5 py-4 border-b border-[#E5E5E5]">
      <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-3">Details</div>

      <div className="space-y-3">
        {people.length > 0 && <DetailGroup rows={people} />}
        {orderInfo.length > 0 && <DetailGroup rows={orderInfo} />}
        {status.length > 0 && <DetailGroup rows={status} />}
        {production.length > 0 && <DetailGroup rows={production} />}
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
  if (variant === 'success') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">{value}</span>;
  }
  if (variant === 'warning') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">{value}</span>;
  }
  if (variant === 'dd-status') {
    return <DdStatusBadge status={value} />;
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