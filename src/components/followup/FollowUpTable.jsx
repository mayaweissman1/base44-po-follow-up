import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Check, Info, X, Clock, MessageSquare, StickyNote, ChevronRight, ChevronUp, ChevronDown, Columns, Filter, Zap, Calendar } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReasonTag from './ReasonTag';
import DdStatusBadge from './DdStatusBadge';
import PriorityBadge from './PriorityBadge';
import { fmtDate, ddmm } from '@/lib/followUpConstants';
import SubPoDestinationTable from './SubPoDestinationTable';
import StyleThumbnail from './StyleThumbnail';
import PmTagsPills from './PmTagsPills';
import CustomFilterModal, { evaluateCustomFilters } from './CustomFilterModal';

// ─── Custom-filter column schemas per role ─────────────────────────────────
// Maps the visible table columns to the (key, label, type) shape needed by
// CustomFilterModal. Keep keys aligned with row fields so evaluateCustomFilters
// can read them directly.
const CUSTOM_FILTER_COLUMNS = {
  main_office: [
    { key: 'po_number',                  label: 'PO Number',         type: 'text' },
    { key: 'style_color',                label: 'Style Color',       type: 'text' },
    { key: 'effective_dd_status',        label: 'Production Stage',  type: 'text' },
    { key: 'current_status',             label: 'DDD Status',        type: 'text' },
    { key: 'urgent_priority',            label: 'Urgent Priority',   type: 'text' },
    { key: 'inv_days',                   label: 'IND',               type: 'number' },
    { key: 'dd_manager_name',            label: 'DD Manager',        type: 'text' },
    { key: 'supplier',                   label: 'Supplier',          type: 'text' },
    { key: 'delivery_date_status',       label: 'Delivery Status',   type: 'text' },
    { key: 'due_date',                   label: 'Due Date',          type: 'date' },
    { key: 'effective_delayed_due_date', label: 'Delayed DD',        type: 'date' },
    { key: 'final_dd',                   label: 'Final DD',          type: 'date' },
    { key: 'effective_next_update',      label: 'Next Update',       type: 'date' },
    { key: 'days_late_counting',         label: 'Days Late',         type: 'number' },
    { key: 'ddd_reason',                 label: 'DD Reason',         type: 'text' },
    { key: 'ddd_comment',                label: 'DDD Comment',       type: 'text' },
    { key: 'hold_age_days',              label: 'HOLD Age',          type: 'number' },
    { key: 'delay_response_comment',     label: 'Delay Response',    type: 'text' },
    { key: 'internal_note',              label: 'Last Comment (internal)', type: 'text' },
    { key: 'ddd_count',                  label: 'DDD Count',         type: 'number' },
    { key: 'pm_tags_label',              label: 'PM Tags',           type: 'text' },
    { key: 'collection',                 label: 'Collection',        type: 'text' },
    { key: 'po_type',                    label: 'Order Type',        type: 'text' },
  ],
  dd_team_manager: [
    { key: 'po_number',                  label: 'PO Number',         type: 'text' },
    { key: 'style_color',                label: 'Style Color',       type: 'text' },
    { key: 'effective_dd_status',        label: 'Production Stage',  type: 'text' },
    { key: 'current_status',             label: 'DDD Status',        type: 'text' },
    { key: 'delay_response_comment',     label: 'PO Response',       type: 'text' },
    { key: 'ddd_reason',                 label: 'DDD Reason',        type: 'text' },
    { key: 'ddd_comment',                label: 'DDD Comment',       type: 'text' },
    { key: 'due_date',                   label: 'Original DD',       type: 'date' },
    { key: 'effective_delayed_due_date', label: 'Delayed DD',        type: 'date' },
    { key: 'delivery_date',              label: 'DD Date',           type: 'date' },
    { key: 'countdown',                  label: 'CountDown',         type: 'number' },
    { key: 'dd_manager_name',            label: 'DD Manager',        type: 'text' },
    { key: 'supplier',                   label: 'Supplier',          type: 'text' },
    { key: 'delivery_date_status',       label: 'Delivery Status',   type: 'text' },
    { key: 'ddd_count',                  label: 'DDD Count',         type: 'number' },
    { key: 'ordered_qty',                label: 'Ordered QTY',       type: 'number' },
    { key: 'qty_received',               label: 'QTY Received',      type: 'number' },
    { key: 'manual_rw',                  label: 'Manual RW',         type: 'number' },
    { key: 'auto_rw',                    label: 'Auto RW',           type: 'number' },
    { key: 'goods_received',             label: 'Goods Received',    type: 'date' },
    { key: 'order_date',                 label: 'Order Date',        type: 'date' },
    { key: 'days_same_status',           label: 'Days Same Status',  type: 'number' },
    { key: 'effective_next_update',      label: 'Next Update',       type: 'date' },
    { key: 'drop',                       label: 'Drop',              type: 'date' },
    { key: 'collection',                 label: 'Collection',        type: 'text' },
    { key: 'pm_tags_label',              label: 'PM Tags',           type: 'text' },
    { key: 'bulk_fabric_approval',       label: 'Bulk Fabric',       type: 'boolean' },
    { key: 'pps_receipt_date',           label: 'PPS Receipt Date',  type: 'date' },
    { key: 'po_type',                    label: 'Order Type',        type: 'text' },
  ],
  dd_team_employee: [
    { key: 'po_number',                  label: 'PO Number',         type: 'text' },
    { key: 'style_color',                label: 'Style Color',       type: 'text' },
    { key: 'effective_dd_status',        label: 'Production Stage',  type: 'text' },
    { key: 'current_status',             label: 'DDD Status',        type: 'text' },
    { key: 'delay_response_comment',     label: 'PO Response',       type: 'text' },
    { key: 'ddd_reason',                 label: 'DDD Reason',        type: 'text' },
    { key: 'ddd_comment',                label: 'DDD Comment',       type: 'text' },
    { key: 'due_date',                   label: 'Original DD',       type: 'date' },
    { key: 'effective_delayed_due_date', label: 'Delayed DD',        type: 'date' },
    { key: 'delivery_date',              label: 'DD Date',           type: 'date' },
    { key: 'countdown',                  label: 'CountDown',         type: 'number' },
    { key: 'supplier',                   label: 'Supplier',          type: 'text' },
    { key: 'delivery_date_status',       label: 'Delivery Status',   type: 'text' },
    { key: 'dd_manager_name',            label: 'DD Manager',        type: 'text' },
    { key: 'ddd_count',                  label: 'DDD Count',         type: 'number' },
    { key: 'ordered_qty',                label: 'Ordered QTY',       type: 'number' },
    { key: 'qty_received',               label: 'QTY Received',      type: 'number' },
    { key: 'manual_rw',                  label: 'Manual RW',         type: 'number' },
    { key: 'auto_rw',                    label: 'Auto RW',           type: 'number' },
    { key: 'goods_received',             label: 'Goods Received',    type: 'date' },
    { key: 'order_date',                 label: 'Order Date',        type: 'date' },
    { key: 'days_same_status',           label: 'Days Same Status',  type: 'number' },
    { key: 'effective_next_update',      label: 'Next Update',       type: 'date' },
    { key: 'drop',                       label: 'Drop',              type: 'date' },
    { key: 'collection',                 label: 'Collection',        type: 'text' },
    { key: 'pm_tags_label',              label: 'PM Tags',           type: 'text' },
    { key: 'bulk_fabric_approval',       label: 'Bulk Fabric',       type: 'boolean' },
    { key: 'pps_receipt_date',           label: 'PPS Receipt Date',  type: 'date' },
    { key: 'po_type',                    label: 'Order Type',        type: 'text' },
  ],
};

// ─── Footer with Load more + Custom Filter button ──────────────────────────
function FilterButton({ activeCount, onClick }) {
  const btnRef = useRef(null);
  return (
    <button
      ref={btnRef}
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
      title="Custom filter"
      className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold rounded-[6px] border transition-colors ${activeCount > 0 ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`}
    >
      <Filter size={12} />
      {activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}
    </button>
  );
}

function DaysCell({ value }) {
  if (value === null || value === undefined) return <span className="font-mono text-[#A3A3A3]">0</span>;
  const cls = value <= 0 ? 'text-green-500' : value <= 3 ? 'text-[#525252]' : 'text-red-500';
  return <span className={`font-mono font-semibold ${cls}`}>{value > 0 ? `+${value}` : value}</span>;
}

function DdCommentLog({ log }) {
  if (!log || log.length === 0) return <span className="text-[#A3A3A3]">—</span>;
  return (
    <div className="max-w-[200px] space-y-0.5">
      {log.map((e, i) => (
        <div key={i} className="text-[11px] truncate leading-snug flex items-baseline gap-1" title={`${ddmm(e.date)} — ${e.text}`}>
          <span className="font-mono font-semibold text-[#E31B7F] flex-shrink-0">{ddmm(e.date)}</span>
          <span className="text-[#525252] truncate">{e.text}</span>
        </div>
      ))}
    </div>
  );
}

function PoCell({ po, onLogsClick }) {
  const isLate = po.late_future === 'LATE';
  const isFuture = po.late_future === 'FUTURE';
  const isReceived = po.late_future === 'RECEIVED';
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); onLogsClick(po); }} className="font-mono font-semibold text-[#E31B7F] hover:underline text-[13px]">{po.po_number}</button>
      </div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {po.marked_urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200">URGENT</span>}
        {isReceived && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">RECEIVED</span>}
        {isLate && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">LATE</span>}
        {isFuture && !po.marked_urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">FUTURE</span>}
      </div>
    </div>
  );
}

function LoadMoreFooter({ visible, total, onLoadMore, onShowAll, leftSlot, rightSlot }) {
  const hasMore = visible < total;
  return (
    <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between text-[11px] gap-2">
      <div className="flex items-center gap-2">{leftSlot}</div>
      <div className="flex items-center gap-2">
        {hasMore ? (
          <>
            <span className="text-[#525252]">
              Showing <strong className="text-[#0A0A0A]">{visible}</strong> of <strong className="text-[#0A0A0A]">{total}</strong>
            </span>
            <button onClick={onLoadMore} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white text-[#E31B7F] border border-[#E5E5E5] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors">Load more</button>
            <button onClick={onShowAll} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] text-[#525252] hover:text-[#0A0A0A] hover:bg-white transition-colors">Show all ({total})</button>
          </>
        ) : (
          <span className="text-[#A3A3A3]">Showing all {total} row{total === 1 ? '' : 's'}</span>
        )}
        {rightSlot}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-3.5 h-3.5 rounded border-[#D4D4D4] cursor-pointer accent-[#E31B7F]"
    />
  );
}

function deliveryDateStatusText(po) {
  const raw = po.delivery_date_status ?? po.ddd_comment;
  if (!raw) return '—';
  return raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
}

function sortValue(row, col) {
  const v = row[col];
  if (v === null || v === undefined) return '';
  return v;
}

function compareRows(a, b, col, dir) {
  const av = sortValue(a, col);
  const bv = sortValue(b, col);
  let cmp;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
  }
  return dir === 'asc' ? cmp : -cmp;
}

function useColResize(initialWidths) {
  const [widths, setWidths] = useState(initialWidths);
  const dragging = useRef(null);

  const startResize = useCallback((col, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[col] || 120;
    dragging.current = { col, startX, startW };

    function onMove(ev) {
      if (!dragging.current) return;
      const { col, startX, startW } = dragging.current;
      const newW = Math.max(60, startW + ev.clientX - startX);
      setWidths(prev => ({ ...prev, [col]: newW }));
    }
    function onUp() {
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [widths]);

  return [widths, startResize];
}

function Th({ col, sortCol, sortDir, onSort, width, onResizeStart, className, children, style = {}, tooltip }) {
  const isActive = sortCol === col;
  return (
    <th
      className={`${className} relative select-none`}
      style={{ minWidth: width || 80, ...style }}
      onClick={col ? () => onSort(col) : undefined}
      title={tooltip || undefined}
    >
      <div className="flex items-center gap-1 pr-3 cursor-pointer">
        <span className="truncate">{children}</span>
        {col && (
          <span className="flex-shrink-0 opacity-50">
            {isActive && sortDir === 'asc' ? <ChevronUp size={10} /> : isActive && sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} className="opacity-20" />}
          </span>
        )}
      </div>
      {col && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#E31B7F]/30 active:bg-[#E31B7F]/50"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => onResizeStart(col, e)}
        />
      )}
    </th>
  );
}

const TIPS = {
  po_rank: 'Sub-PO order within the same destination + style_color, ranked by delayed/original due date',
  current_status: 'Delay decision (HOLD / APPROVED / REJECTED / ACKNOWLEDGED)',
  effective_dd_status: 'Production stage (e.g. Cutting, Sewing, OTW to Office)',
  priority: 'URGENT (flagged) · Deadline at risk (>3 days late) · Normal',
  hold_age_days: 'Days the delay request has been awaiting Main Office decision',
  days_late_counting: 'Difference between delayed DD and original Due Date',
  countdown: 'Days remaining until the Final DD (negative = past due)',
  ddd_count: 'How many times the delivery date has been changed',
  days_same_status: 'Days since the production stage last changed',
  pm_tags: 'Product Management tag — risk flag',
  bulk_fabric_approval: 'Has the bulk fabric been approved for production?',
  pps_receipt_date: 'Date the PPS (pre-production sample) was received',
};

// ─── DD Manager columns (order preserved when toggled) ─────────────────────────
// Standard (s) = defaultOn true, Additional (h) = defaultOn false
const DDM_ALL_COLS = [
  // Standard — ON by default
  { key: 'style_color',                label: 'Style Color',      defaultOn: true  },
  { key: 'effective_dd_status',        label: 'Production Stage', defaultOn: true  },
  { key: 'dd_comment_log',            label: 'DD Comment',       defaultOn: true  },
  { key: 'current_status',             label: 'DDD Status',       defaultOn: true  },
  { key: 'delay_response_comment',    label: 'PO Response',      defaultOn: true  },
  { key: 'ddd_reason',                 label: 'DDD Reason',       defaultOn: true  },
  { key: 'ddd_comment',               label: 'DDD Comment',      defaultOn: true  },
  { key: 'effective_delayed_due_date', label: 'Delayed DD',       defaultOn: true  },
  { key: 'countdown',                  label: 'CountDown',        defaultOn: true  },
  { key: 'dd_manager_name',            label: 'DD Manager',       defaultOn: true  },
  { key: 'days_same_status',           label: 'Days Same Status', defaultOn: true  },
  { key: 'effective_next_update',      label: 'Next Update',      defaultOn: true  },
  // Additional — OFF by default
  { key: 'due_date',                   label: 'Original DD',      defaultOn: false },
  { key: 'delivery_date',              label: 'DD Date',          defaultOn: false },
  { key: 'flags',                      label: 'Flags',            defaultOn: false },
  { key: 'supplier',                   label: 'Supplier',         defaultOn: false },
  { key: 'delivery_date_status',       label: 'Delivery Status',  defaultOn: false },
  { key: 'ddd_count',                  label: 'DDD Count',        defaultOn: false },
  { key: 'set_with',                   label: 'Set With',         defaultOn: false },
  { key: 'ordered_qty',                label: 'Ordered QTY',      defaultOn: false },
  { key: 'qty_received',               label: 'QTY Received',     defaultOn: false },
  { key: 'manual_rw',                  label: 'Manual RW',        defaultOn: false },
  { key: 'auto_rw',                    label: 'Auto RW',          defaultOn: false },
  { key: 'goods_received',             label: 'Goods Received',   defaultOn: false },
  { key: 'order_date',                 label: 'Order Date',       defaultOn: false },
  { key: 'drop',                       label: 'Drop',             defaultOn: false },
  { key: 'collection',                 label: 'Collection',       defaultOn: false },
  { key: 'pm_tags',                    label: 'PM Tags',          defaultOn: false },
  { key: 'bulk_fabric_approval',       label: 'Bulk Fabric',      defaultOn: false },
  { key: 'pps_receipt_date',           label: 'PPS Receipt Date', defaultOn: false },
  { key: 'po_type',                    label: 'Order Type',       defaultOn: false },
];

const DEFAULT_DDM_COLS = Object.fromEntries(DDM_ALL_COLS.map(c => [c.key, c.defaultOn]));

function loadDdmCols() {
  try {
    const saved = localStorage.getItem('ddmgr-opt-cols');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_DDM_COLS, ...parsed };
  } catch {
    return { ...DEFAULT_DDM_COLS };
  }
}

function ColumnPicker({ visibleCols, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hiddenCount = DDM_ALL_COLS.filter(c => !visibleCols[c.key]).length;
  const standardCols = DDM_ALL_COLS.filter(c => c.defaultOn);
  const additionalCols = DDM_ALL_COLS.filter(c => !c.defaultOn);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold rounded-[6px] border transition-colors ${hiddenCount > 0 ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`}
      >
        <Columns size={12} />
        {hiddenCount > 0 ? `Columns (${hiddenCount} hidden)` : 'Columns'}
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,.12)] z-50 w-56 overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto py-1">
            <div className="px-3 py-1.5 text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Standard</div>
            {standardCols.map(col => (
              <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#FFF0F7] cursor-pointer text-xs text-[#0A0A0A]">
                <input
                  type="checkbox"
                  checked={!!visibleCols[col.key]}
                  onChange={e => onChange({ ...visibleCols, [col.key]: e.target.checked })}
                  className="accent-[#E31B7F] w-3 h-3"
                />
                {col.label}
              </label>
            ))}
            <div className="border-t border-[#F0F0F0] my-1" />
            <div className="px-3 py-1.5 text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Additional</div>
            {additionalCols.map(col => (
              <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#FFF0F7] cursor-pointer text-xs text-[#0A0A0A]">
                <input
                  type="checkbox"
                  checked={!!visibleCols[col.key]}
                  onChange={e => onChange({ ...visibleCols, [col.key]: e.target.checked })}
                  className="accent-[#E31B7F] w-3 h-3"
                />
                {col.label}
              </label>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_DDM_COLS })}
              className="text-[11px] text-[#A3A3A3] hover:text-[#E31B7F] transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderManagerCell(po, key) {
  const v = po[key];
  switch (key) {
    case 'style_color':      return <span className="font-mono text-[12px]">{po.style_color}</span>;
    case 'effective_dd_status': return <DdStatusBadge status={po.effective_dd_status} />;
    case 'dd_comment_log':   return <DdCommentLog log={po.dd_comment_log} />;
    case 'current_status':   return <StatusBadge status={po.current_status} />;
    case 'delay_response_comment': return <span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.delay_response_comment}>{po.delay_response_comment || '—'}</span>;
    case 'ddd_reason':       return <ReasonTag reasons={po.ddd_reasons} reason={po.ddd_reason} />;
    case 'ddd_comment':      return <span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span>;
    case 'due_date':         return <span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span>;
    case 'effective_delayed_due_date': return po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>;
    case 'delivery_date':    return <span className="font-mono font-semibold">{fmtDate(po.delivery_date || po.due_date)}</span>;
    case 'countdown': {
      const cv = po.countdown;
      return <span className={`font-mono font-semibold ${cv < 0 ? 'text-red-500' : cv <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>{cv != null ? (cv > 0 ? `+${cv}` : cv) : '—'}</span>;
    }
    case 'flags':            return v ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase ${v === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{v}</span> : <span className="text-[#A3A3A3]">—</span>;
    case 'supplier':         return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span>;
    case 'delivery_date_status': return <span className="text-[#525252] text-xs max-w-[160px] truncate inline-block" title={po.delivery_date_status ?? po.ddd_comment}>{deliveryDateStatusText(po)}</span>;
    case 'dd_manager_name':  return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span>;
    case 'ddd_count':        return <span className="font-mono">{po.ddd_count ?? 0}</span>;
    case 'set_with':         return <span className="font-mono text-xs text-[#A3A3A3]">{v || '—'}</span>;
    case 'ordered_qty':      return <span className="font-mono">{v ?? '—'}</span>;
    case 'qty_received':     return <span className="font-mono font-semibold">{v ?? 0}</span>;
    case 'manual_rw':
    case 'auto_rw':          return v ? <span className="font-mono font-semibold text-red-500">{Number(v).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>;
    case 'goods_received':
    case 'order_date':
    case 'pps_receipt_date': return <span className="font-mono text-[#A3A3A3]">{fmtDate(v)}</span>;
    case 'days_same_status': return <span className="font-mono">{v != null ? `${v}d` : '—'}</span>;
    case 'effective_next_update': return v ? <span className="font-mono text-xs">{fmtDate(v)}</span> : <span className="text-[#A3A3A3]">—</span>;
    case 'drop':             return <span className="font-mono text-[#A3A3A3] text-xs">{fmtDate(v)}</span>;
    case 'collection':       return <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{v || '—'}</span>;
    case 'pm_tags':          return <PmTagsPills label={po.pm_tags_label} />;
    case 'bulk_fabric_approval': return v === true
      ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Approved</span>
      : v === false
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">Pending</span>
        : <span className="text-[#A3A3A3]">—</span>;
    case 'po_type':          return <span className="font-mono text-xs text-[#525252]">{v || '—'}</span>;
    default:                 return <span className="font-mono text-xs text-[#525252]">{v ?? '—'}</span>;
  }
}

const PAGE_SIZE = 100;

export default function FollowUpTable({
  rows, role, filterStatus, onDecide, onLogDelay, onGeneralUpdate, onViewLogs, onInternalNote, onMarkUrgent, onFollowUp, loading,
  selectedRows = new Set(), onSelectRow, onSelectAll, onPoDetails,
  isRepScopeTable = false,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [ddmOptCols, setDdmOptCols] = useState(loadDdmCols);
  const [customFilters, setCustomFilters] = useState([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState(null);

  const customFilterColumns = CUSTOM_FILTER_COLUMNS[role] || CUSTOM_FILTER_COLUMNS.main_office;

  // Reset custom filters when role changes (column schema differs)
  useEffect(() => { setCustomFilters([]); }, [role]);

  useEffect(() => {
    setSortCol(null);
    setSortDir('asc');
    setVisibleCount(PAGE_SIZE);
  }, [role]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [rows.length]);

  function handleDdmColChange(next) {
    setDdmOptCols(next);
    try { localStorage.setItem('ddmgr-opt-cols', JSON.stringify(next)); } catch {}
  }

  const [colWidths, startResize] = useColResize({});

  function toggleExpand(poNumber) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber); else next.add(poNumber);
      return next;
    });
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const filteredRows = useMemo(() => {
    if (!customFilters.length) return rows;
    return rows.filter(r => evaluateCustomFilters(r, customFilters, customFilterColumns));
  }, [rows, customFilters, customFilterColumns]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => compareRows(a, b, sortCol, sortDir));
  }, [filteredRows, sortCol, sortDir]);

  const visibleRows = useMemo(() => sortedRows.slice(0, visibleCount), [sortedRows, visibleCount]);

  const allVisibleSelected = rows.length > 0 && rows.every(r => selectedRows.has(r.po_number));

  const thCls = "px-2 py-1.5 text-left text-[10px] font-bold text-[#525252] uppercase tracking-[.06em] whitespace-nowrap bg-[#F8F8F8] border-b border-[#E5E5E5] sticky top-0 z-10";
  const tdCls = "px-2 py-1.5 border-b border-[#E5E5E5] bg-white whitespace-nowrap text-[12px] align-middle";

  const thProps = { sortCol, sortDir, onSort: handleSort, onResizeStart: startResize, className: thCls };

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="flex items-center justify-center h-40 text-sm text-[#A3A3A3]">Loading PO data…</div>
      </div>
    );
  }

  if (rows.length === 0) {
    const isPending = filterStatus === 'HOLD' || filterStatus === undefined;
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="text-center py-16">
          {isPending ? (
            <>
              <div className="text-lg font-semibold text-[#0A0A0A] mb-2">All caught up ✦</div>
              <div className="text-sm text-[#525252]">No delay requests need your attention right now.</div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold text-[#0A0A0A] mb-2">Nothing matches your filters</div>
              <div className="text-sm text-[#525252]">Try adjusting or clearing the current filters.</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── DD Team Employee view ─────────────────────────────────────────────────
  if (role === 'dd_team_employee') {
    // 1 checkbox + 1 expand + 1 thumb + 1 PO + 31 data cols + 1 actions = 36
    const empColSpan = 36;
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className={thCls} style={{ width: 36, position: 'sticky', left: 0, zIndex: 30 }}>
                  <Checkbox checked={allVisibleSelected} onChange={() => onSelectAll?.(rows.map(r => r.po_number))} />
                </th>
                <th className={thCls} style={{ width: 36, position: 'sticky', left: 36, zIndex: 30 }}></th>
                <th className={thCls} style={{ width: 56, position: 'sticky', left: 72, zIndex: 30 }}></th>
                <Th {...thProps} col="po_number" width={colWidths['po_number'] || 140} style={{ position: 'sticky', left: 128, zIndex: 30 }}>PO Number</Th>
                <Th {...thProps} col="style_color" width={colWidths['style_color'] || 110}>Style Color</Th>
                <Th {...thProps} col="effective_dd_status" width={colWidths['effective_dd_status'] || 110} tooltip={TIPS.effective_dd_status}>Production Stage</Th>
                <Th {...thProps} col={null} width={colWidths['dd_comment_log'] || 170}>DD Comment</Th>
                <Th {...thProps} col="current_status" width={colWidths['current_status'] || 90} tooltip={TIPS.current_status}>DDD Status</Th>
                <Th {...thProps} col="delay_response_comment" width={colWidths['delay_response_comment'] || 140}>PO Response</Th>
                <Th {...thProps} col="ddd_reason" width={colWidths['ddd_reason'] || 120}>DDD Reason</Th>
                <Th {...thProps} col="ddd_comment" width={colWidths['ddd_comment'] || 160}>DDD Comment</Th>
                <Th {...thProps} col="due_date" width={colWidths['due_date'] || 85}>Original DD</Th>
                <Th {...thProps} col="effective_delayed_due_date" width={colWidths['effective_delayed_due_date'] || 85}>Delayed DD</Th>
                <Th {...thProps} col="delivery_date" width={colWidths['delivery_date'] || 85}>DD Date</Th>
                <Th {...thProps} col="countdown" width={colWidths['countdown'] || 80} tooltip={TIPS.countdown}>CountDown</Th>
                <Th {...thProps} col="flags" width={colWidths['flags'] || 70}>Flags</Th>
                <Th {...thProps} col="supplier" width={colWidths['supplier'] || 90}>Supplier</Th>
                <Th {...thProps} col="delivery_date_status" width={colWidths['delivery_date_status'] || 140}>Delivery Status</Th>
                <Th {...thProps} col="dd_manager_name" width={colWidths['dd_manager_name'] || 95}>DD Manager</Th>
                <Th {...thProps} col="ddd_count" width={colWidths['ddd_count'] || 70} tooltip={TIPS.ddd_count}>DDD Count</Th>
                <Th {...thProps} col="set_with" width={colWidths['set_with'] || 85}>Set With</Th>
                <Th {...thProps} col="ordered_qty" width={colWidths['ordered_qty'] || 80}>Ordered QTY</Th>
                <Th {...thProps} col="qty_received" width={colWidths['qty_received'] || 85}>QTY Received</Th>
                <Th {...thProps} col="manual_rw" width={colWidths['manual_rw'] || 75}>Manual RW</Th>
                <Th {...thProps} col="auto_rw" width={colWidths['auto_rw'] || 70}>Auto RW</Th>
                <Th {...thProps} col="goods_received" width={colWidths['goods_received'] || 95}>Goods Received</Th>
                <Th {...thProps} col="order_date" width={colWidths['order_date'] || 85}>Order Date</Th>
                <Th {...thProps} col="days_same_status" width={colWidths['days_same_status'] || 95} tooltip={TIPS.days_same_status}>Days Same Status</Th>
                <Th {...thProps} col="effective_next_update" width={colWidths['effective_next_update'] || 95}>Next Update</Th>
                <Th {...thProps} col="drop" width={colWidths['drop'] || 75}>Drop</Th>
                <Th {...thProps} col="collection" width={colWidths['collection'] || 90}>Collection</Th>
                <Th {...thProps} col="pm_tags" width={colWidths['pm_tags'] || 85} tooltip={TIPS.pm_tags}>PM Tags</Th>
                <Th {...thProps} col="bulk_fabric_approval" width={colWidths['bulk_fabric_approval'] || 110} tooltip={TIPS.bulk_fabric_approval}>Bulk Fabric</Th>
                <Th {...thProps} col="pps_receipt_date" width={colWidths['pps_receipt_date'] || 95} tooltip={TIPS.pps_receipt_date}>PPS Receipt Date</Th>
                <Th {...thProps} col="po_type" width={colWidths['po_type'] || 70}>Order Type</Th>
                <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(po => {
                const isExpanded = expanded.has(po.po_number);
                const isRejected = po.current_status === 'REJECTED';
                const rowBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                const actionBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                const countdown = po.countdown;

                return (
                  <React.Fragment key={po.po_number}>
                  <tr className="group cursor-pointer" onClick={() => onPoDetails?.(po)}>
                    <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 0, zIndex: 20 }} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                    </td>
                    <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 36, zIndex: 20 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleExpand(po.po_number)} className={`w-[18px] h-[18px] flex items-center justify-center text-[#525252] transition-transform ${isExpanded ? 'rotate-90 text-[#E31B7F]' : ''}`}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                    <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 72, zIndex: 20 }}><StyleThumbnail key={po.po_number} styleColor={po.style_color} imageUrl={po.product_image} size={40} /></td>
                    <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 128, zIndex: 20 }}><PoCell po={po} onLogsClick={onViewLogs} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><DdCommentLog log={po.dd_comment_log} /></td>
                    <td className={`${tdCls} ${rowBg}`}><StatusBadge status={po.current_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.delay_response_comment
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-blue-50 text-blue-600 max-w-[150px] truncate" title={po.delay_response_comment}>{po.delay_response_comment}</span>
                        : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><ReasonTag reasons={po.ddd_reasons} reason={po.ddd_reason} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="text-[#A3A3A3] truncate max-w-[180px] inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{fmtDate(po.delivery_date || po.due_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      <span className={`font-mono font-semibold ${countdown < 0 ? 'text-red-500' : countdown <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>
                        {countdown != null ? (countdown > 0 ? `+${countdown}` : countdown) : '—'}
                      </span>
                    </td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.flags ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span> : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="text-[#525252] text-xs max-w-[160px] truncate inline-block" title={po.delivery_date_status ?? po.ddd_comment}>{deliveryDateStatusText(po)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#A3A3A3]">{po.set_with || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ordered_qty ?? '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{po.qty_received ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.manual_rw ? <span className="font-mono font-semibold text-red-500">{Number(po.manual_rw).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}>{po.auto_rw ? <span className="font-mono font-semibold text-red-500">{Number(po.auto_rw).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.goods_received)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.order_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.days_same_status != null ? `${po.days_same_status}d` : '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_next_update ? <span className="font-mono">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3] text-xs">{fmtDate(po.drop)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.collection}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><PmTagsPills label={po.pm_tags_label} /></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.bulk_fabric_approval === true ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Approved</span> : po.bulk_fabric_approval === false ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">Pending</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.pps_receipt_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#525252]">{po.po_type || '—'}</span></td>
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionBg}`} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => onLogDelay(po)} className={`h-7 px-3 text-[11px] font-semibold rounded-[6px] transition-colors ${po.effective_delayed_due_date ? 'bg-white text-[#E31B7F] border border-[#E5E5E5] hover:bg-[#FFF0F7] hover:border-[#E31B7F]' : 'bg-[#E31B7F] text-white hover:bg-[#C21571]'}`}>
                          {po.effective_delayed_due_date ? 'Edit delay' : 'Report delay'}
                        </button>
                        <button onClick={() => onGeneralUpdate(po)} className="h-7 px-2.5 text-[11px] font-semibold rounded-[6px] bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:border-[#E31B7F] transition-colors">Update</button>
                        <button onClick={() => onViewLogs(po)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><Clock size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={empColSpan} className="p-0 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                        <div className="sticky left-0 px-6 py-4" style={{ width: 'calc(100vw - 96px)', maxWidth: 1100 }}>
                          <SubPoDestinationTable poNumber={po.po_number} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <LoadMoreFooter
          visible={visibleRows.length}
          total={sortedRows.length}
          onLoadMore={() => setVisibleCount(c => c + PAGE_SIZE)}
          onShowAll={() => setVisibleCount(sortedRows.length)}
          rightSlot={<FilterButton activeCount={customFilters.length} onClick={(rect) => { setFilterAnchor(rect); setFilterModalOpen(true); }} />}
        />
        {filterModalOpen && (
          <CustomFilterModal
            columns={customFilterColumns}
            rules={customFilters}
            onChange={setCustomFilters}
            onClose={() => setFilterModalOpen(false)}
            anchorRect={filterAnchor}
          />
        )}
      </div>
    );
  }

  // ─── DD Team Manager view ──────────────────────────────────────────────────
  if (role === 'dd_team_manager') {
    const colVis = (key) => !!ddmOptCols[key];
    const visibleDdmCols = DDM_ALL_COLS.filter(c => colVis(c.key));
    // 1 checkbox + 1 expand + 1 image + 1 PO Number + visible data cols + 1 actions
    const ddmColSpan = 4 + visibleDdmCols.length + 1;
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className={thCls} style={{ width: 36, position: 'sticky', left: 0, zIndex: 30 }}>
                  <Checkbox checked={allVisibleSelected} onChange={() => onSelectAll?.(rows.map(r => r.po_number))} />
                </th>
                <th className={thCls} style={{ width: 36, position: 'sticky', left: 36, zIndex: 30 }}></th>
                <th className={thCls} style={{ width: 56, position: 'sticky', left: 72, zIndex: 30 }}></th>
                <Th {...thProps} col="po_number" width={colWidths['po_number'] || 140} style={{ position: 'sticky', left: 128, zIndex: 30 }}>PO Number</Th>
                {DDM_ALL_COLS.map(col => colVis(col.key) && (
                  <Th key={col.key} {...thProps} col={col.key} width={colWidths[col.key] || 110} tooltip={TIPS[col.key]}>{col.label}</Th>
                ))}
                <th className={`${thCls} sticky right-0 z-30 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(po => {
                const isExpanded = expanded.has(po.po_number);
                const isRejected = po.current_status === 'REJECTED';
                const rowBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                const tdBase = `${tdCls} ${rowBg}`;
                const actionCellBase = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                return (
                  <React.Fragment key={po.po_number}>
                    <tr className="group cursor-pointer" onClick={() => onPoDetails?.(po)}>
                      <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 0, zIndex: 20 }} onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                      </td>
                      <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 36, zIndex: 20 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleExpand(po.po_number)} className={`w-[18px] h-[18px] flex items-center justify-center text-[#525252] transition-transform ${isExpanded ? 'rotate-90 text-[#E31B7F]' : ''}`}>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                      <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 72, zIndex: 20 }}>
                        <StyleThumbnail key={po.po_number} styleColor={po.style_color} imageUrl={po.product_image} size={40} />
                      </td>
                      <td className={`${tdCls} ${rowBg}`} style={{ position: 'sticky', left: 128, zIndex: 20 }}>
                        <PoCell po={po} onLogsClick={onViewLogs} />
                      </td>
                      {DDM_ALL_COLS.map(col => colVis(col.key) && (
                        <td key={col.key} className={tdBase}>{renderManagerCell(po, col.key)}</td>
                      ))}
                      <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionCellBase}`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => onLogDelay(po)} className={`h-7 px-2.5 text-[11px] font-semibold rounded-[6px] transition-colors ${po.effective_delayed_due_date ? 'bg-white text-[#E31B7F] border border-[#E5E5E5] hover:bg-[#FFF0F7] hover:border-[#E31B7F]' : 'bg-[#E31B7F] text-white hover:bg-[#C21571]'}`}>
                            {po.effective_delayed_due_date ? 'Edit delay' : 'Report delay'}
                          </button>
                          <button onClick={() => onGeneralUpdate(po)} className="h-7 px-2 text-[11px] font-semibold rounded-[6px] bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:border-[#E31B7F] transition-colors">Update</button>
                          <button onClick={() => onViewLogs(po)} title="View logs" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><Clock size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={ddmColSpan} className="p-0 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                          <div className="sticky left-0 px-6 py-4" style={{ width: 'calc(100vw - 96px)', maxWidth: 1100 }}>
                            <SubPoDestinationTable poNumber={po.po_number} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between text-[11px]">
          <ColumnPicker visibleCols={ddmOptCols} onChange={handleDdmColChange} />
          <div className="flex items-center gap-2">
            {visibleRows.length < sortedRows.length ? (
              <>
                <span className="text-[#525252]">
                  Showing <strong className="text-[#0A0A0A]">{visibleRows.length}</strong> of <strong className="text-[#0A0A0A]">{sortedRows.length}</strong>
                </span>
                <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white text-[#E31B7F] border border-[#E5E5E5] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors">Load more</button>
                <button onClick={() => setVisibleCount(sortedRows.length)} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] text-[#525252] hover:text-[#0A0A0A] hover:bg-white transition-colors">Show all ({sortedRows.length})</button>
              </>
            ) : (
              <span className="text-[#A3A3A3]">Showing all {sortedRows.length} row{sortedRows.length === 1 ? '' : 's'}</span>
            )}
            <FilterButton activeCount={customFilters.length} onClick={(rect) => { setFilterAnchor(rect); setFilterModalOpen(true); }} />
          </div>
        </div>
        {filterModalOpen && (
          <CustomFilterModal
            columns={customFilterColumns}
            rules={customFilters}
            onChange={setCustomFilters}
            onClose={() => setFilterModalOpen(false)}
            anchorRect={filterAnchor}
          />
        )}
      </div>
    );
  }

  // ─── Main Office view ───────────────────────────────────────────────────────
  // colVisible: for main_office, always true (manager handled above)
  const colVisible = (key) => role !== 'dd_team_manager' || !!ddmOptCols[key];

  // Additional cols visible for manager only
  const additionalCols = role === 'dd_team_manager'
    ? DDM_ALL_COLS.filter(c => !c.defaultOn && !!ddmOptCols[c.key])
    : [];

  // colSpan for the expand row.
  // Main Office (no thumb): 2 fixed (checkbox+expand) + 20 standard + hold_age + internal_note + 1 actions = 25 (+1 missing-sizes in Rep)
  const expandColSpan = role === 'dd_team_manager'
    ? 4 + DDM_ALL_COLS.filter(c => !!ddmOptCols[c.key]).length
    : (24 + (isRepScopeTable ? 1 : 0));

  function renderAdditionalTds(po, bg) {
    return additionalCols.map(col => {
      const v = po[col.key];
      let cell;
      switch (col.key) {
        case 'flags':
          cell = v ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase ${v === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{v}</span> : <span className="text-[#A3A3A3]">—</span>;
          break;
        case 'countdown':
          cell = <span className={`font-mono font-semibold ${v < 0 ? 'text-red-500' : v <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>{v != null ? (v > 0 ? `+${v}` : v) : '—'}</span>;
          break;
        case 'set_with':
          cell = <span className="font-mono text-xs text-[#A3A3A3]">{v || '—'}</span>;
          break;
        case 'ordered_qty':
        case 'qty_received':
          cell = <span className="font-mono">{v ?? '—'}</span>;
          break;
        case 'manual_rw':
        case 'auto_rw':
          cell = v ? <span className="font-mono font-semibold text-red-500">{Number(v).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>;
          break;
        case 'bulk_fabric_approval':
          cell = v === true
            ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Approved</span>
            : v === false
              ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">Pending</span>
              : <span className="text-[#A3A3A3]">—</span>;
          break;
        case 'pps_receipt_date':
        case 'goods_received':
        case 'order_date':
        case 'drop':
          cell = <span className="font-mono text-[#A3A3A3]">{fmtDate(v)}</span>;
          break;
        case 'days_same_status':
          cell = <span className="font-mono">{v != null ? `${v}d` : '—'}</span>;
          break;
        case 'collection':
          cell = <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{v || '—'}</span>;
          break;
        case 'po_type':
          cell = <span className="font-mono text-xs text-[#525252]">{v || '—'}</span>;
          break;
        default:
          cell = <span className="font-mono text-xs text-[#525252]">{v ?? '—'}</span>;
      }
      return <td key={col.key} className={`${tdCls} ${bg}`}>{cell}</td>;
    });
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
      {role === 'dd_team_manager' && (
        <div className="flex justify-end px-3 pt-2.5 pb-1 border-b border-[#F0F0F0]">
          <ColumnPicker visibleCols={ddmOptCols} onChange={handleDdmColChange} />
        </div>
      )}
      <div className="overflow-auto max-h-[calc(100vh-280px)]">
        <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className={thCls} style={{ width: 36 }}>
                <Checkbox checked={allVisibleSelected} onChange={() => onSelectAll?.(rows.map(r => r.po_number))} />
              </th>
              <th className={thCls} style={{ width: 36 }}></th>
              {role !== 'main_office' && <th className={thCls} style={{ width: 56 }}></th>}
              {colVisible('po_number') && <Th {...thProps} col="po_number" width={colWidths['po_number'] || 140}>PO Number</Th>}
              {colVisible('style_color') && <Th {...thProps} col="style_color" width={colWidths['style_color'] || 110}>Style Color</Th>}
              {colVisible('po_rank') && <Th {...thProps} col="po_rank" width={colWidths['po_rank'] || 60} tooltip={TIPS.po_rank}>Rank</Th>}
              {colVisible('effective_dd_status') && <Th {...thProps} col="effective_dd_status" width={colWidths['effective_dd_status'] || 110} tooltip={TIPS.effective_dd_status}>Production Stage</Th>}
              {colVisible('current_status') && <Th {...thProps} col="current_status" width={colWidths['current_status'] || 95} tooltip={TIPS.current_status}>DDD Status</Th>}
              {colVisible('priority') && <Th {...thProps} col="urgent_priority" width={colWidths['urgent_priority'] || 130} tooltip="Computed from urgent_reasons_base — see spec §3.3.2. MANUAL = marked by Main Office.">Urgent Priority</Th>}
              {role === 'main_office' && <Th {...thProps} col="inv_days" width={colWidths['inv_days'] || 70} tooltip="Inventory Days = (stock + air OTW) ÷ (virtual7d / 7)">IND</Th>}
              {colVisible('dd_manager_name') && <Th {...thProps} col="dd_manager_name" width={colWidths['dd_manager_name'] || 95}>DD Manager</Th>}
              {colVisible('supplier') && <Th {...thProps} col="supplier" width={colWidths['supplier'] || 90}>Supplier</Th>}
              {colVisible('delivery_date_status') && <Th {...thProps} col="delivery_date_status" width={colWidths['delivery_date_status'] || 140}>Delivery Status</Th>}
              {colVisible('due_date') && <Th {...thProps} col="due_date" width={colWidths['due_date'] || 80}>Due Date</Th>}
              {colVisible('effective_delayed_due_date') && <Th {...thProps} col="effective_delayed_due_date" width={colWidths['effective_delayed_due_date'] || 85}>Delayed DD</Th>}
              {colVisible('final_dd') && <Th {...thProps} col="final_dd" width={colWidths['final_dd'] || 80}>Final DD</Th>}
              {colVisible('effective_next_update') && <Th {...thProps} col="effective_next_update" width={colWidths['effective_next_update'] || 95}>Next Update</Th>}
              {colVisible('days_late_counting') && <Th {...thProps} col="days_late_counting" width={colWidths['days_late_counting'] || 75} tooltip={TIPS.days_late_counting}>Days Late</Th>}
              {colVisible('ddd_reason') && <Th {...thProps} col="ddd_reason" width={colWidths['ddd_reason'] || 120}>DD Reason</Th>}
              {colVisible('ddd_comment') && <Th {...thProps} col="ddd_comment" width={colWidths['ddd_comment'] || 160}>DDD Comment</Th>}
              {colVisible('dd_comment_log') && <Th {...thProps} col={null} width={colWidths['dd_comment_log'] || 170}>DD Comment</Th>}
              {role === 'main_office' && <Th {...thProps} col="hold_age_days" width={colWidths['hold_age_days'] || 80} tooltip={TIPS.hold_age_days}>HOLD Age</Th>}
              {colVisible('delay_response_comment') && <Th {...thProps} col="delay_response_comment" width={colWidths['delay_response_comment'] || 130}>Delay Response</Th>}
              {role === 'main_office' && <Th {...thProps} col="internal_note" width={colWidths['internal_note'] || 150}>Last Comment (internal)</Th>}
              {colVisible('ddd_count') && <Th {...thProps} col="ddd_count" width={colWidths['ddd_count'] || 70} tooltip={TIPS.ddd_count}>DDD Count</Th>}
              {colVisible('pm_tags') && <Th {...thProps} col="pm_tags" width={colWidths['pm_tags'] || 110} tooltip={TIPS.pm_tags}>PM Tags</Th>}
              {role === 'main_office' && isRepScopeTable && <Th {...thProps} col={null} width={colWidths['missing_sizes'] || 110} tooltip="Sizes missing for repeat orders">Missing Sizes</Th>}
              {additionalCols.map(col => (
                <Th key={col.key} {...thProps} col={col.key} width={colWidths[col.key] || 110}>{col.label}</Th>
              ))}
              <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(po => {
              const isExpanded = expanded.has(po.po_number);
              const isRejected = po.current_status === 'REJECTED';
              const rowBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
              const tdBase = `${tdCls} ${rowBg}`;
              const actionCellBase = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';

              return (
                <React.Fragment key={po.po_number}>
                  <tr className="group cursor-pointer" onClick={() => onPoDetails?.(po)}>
                    <td className={`${tdBase} w-9`} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                    </td>
                    <td className={`${tdBase} w-9`} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleExpand(po.po_number)} className={`w-[18px] h-[18px] flex items-center justify-center text-[#525252] transition-transform ${isExpanded ? 'rotate-90 text-[#E31B7F]' : ''}`}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                    {role !== 'main_office' && <td className={tdBase}><StyleThumbnail key={po.po_number} styleColor={po.style_color} imageUrl={po.product_image} size={40} /></td>}
                    {colVisible('po_number') && <td className={tdBase}><PoCell po={po} onLogsClick={onViewLogs} /></td>}
                    {colVisible('style_color') && <td className={tdBase}><span className="font-mono text-[12px]">{po.style_color}</span></td>}
                    {colVisible('po_rank') && <td className={tdBase}><span className="font-mono font-semibold">{po.po_rank ?? '—'}</span></td>}
                    {colVisible('effective_dd_status') && <td className={tdBase}><DdStatusBadge status={po.effective_dd_status} /></td>}
                    {colVisible('current_status') && <td className={tdBase}><StatusBadge status={po.current_status} /></td>}
                    {colVisible('priority') && <td className={tdBase}><PriorityBadge priority={po.urgent_priority || po.urgency_reason_raw || po.priority} /></td>}
                    {role === 'main_office' && (
                      <td className={tdBase}>
                        {po.inv_days == null ? <span className="text-[#A3A3A3]">—</span> :
                          po.inv_days >= 9999 ? <span className="font-mono text-[#A3A3A3]">∞</span> :
                          <span className={`font-mono font-semibold ${po.inv_days < 5 ? 'text-red-500' : po.inv_days < 14 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>{po.inv_days}d</span>
                        }
                      </td>
                    )}
                    {colVisible('dd_manager_name') && <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span></td>}
                    {colVisible('supplier') && <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>}
                    {colVisible('delivery_date_status') && <td className={tdBase}><span className="text-[#525252] text-xs max-w-[160px] truncate inline-block" title={po.delivery_date_status ?? po.ddd_comment}>{deliveryDateStatusText(po)}</span></td>}
                    {colVisible('due_date') && <td className={tdBase}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>}
                    {colVisible('effective_delayed_due_date') && <td className={tdBase}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>}
                    {colVisible('final_dd') && <td className={tdBase}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>}
                    {colVisible('effective_next_update') && <td className={tdBase}>{po.effective_next_update ? <span className="font-mono text-xs">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>}
                    {colVisible('days_late_counting') && <td className={tdBase}><DaysCell value={po.days_late_counting} /></td>}
                    {colVisible('ddd_reason') && <td className={tdBase}><ReasonTag reasons={po.ddd_reasons} reason={po.ddd_reason} /></td>}
                    {colVisible('ddd_comment') && <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>}
                    {colVisible('dd_comment_log') && <td className={tdBase}><DdCommentLog log={po.dd_comment_log} /></td>}
                    {role === 'main_office' && (
                      <td className={tdBase}>
                        {po.hold_age_days != null ? (
                          <span className={`font-mono font-semibold ${po.hold_age_days > 0 ? 'text-red-500' : 'text-[#A3A3A3]'}`}>
                            {po.hold_age_days <= 0 ? 'Today' : `${po.hold_age_days}d ago`}
                          </span>
                        ) : <span className="text-[#A3A3A3]">—</span>}
                      </td>
                    )}
                    {colVisible('delay_response_comment') && <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.delay_response_comment}>{po.delay_response_comment || '—'}</span></td>}
                    {role === 'main_office' && <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.internal_note}>{po.internal_note || '—'}</span></td>}
                    {colVisible('ddd_count') && <td className={tdBase}><span className="font-mono">{po.ddd_count ?? 0}</span></td>}
                    {colVisible('pm_tags') && <td className={tdBase}><PmTagsPills label={po.pm_tags_label} /></td>}
                    {role === 'main_office' && isRepScopeTable && (
                      <td className={tdBase}>
                        {Array.isArray(po.missing_sizes) && po.missing_sizes.length > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {po.missing_sizes.map(s => (
                              <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded-[0.5rem] text-[10px] font-bold uppercase bg-purple-50 text-purple-600 border border-purple-200">{s}</span>
                            ))}
                          </div>
                        ) : <span className="text-[#A3A3A3]">—</span>}
                      </td>
                    )}
                    {renderAdditionalTds(po, rowBg)}
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionCellBase}`} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {role === 'main_office' ? (
                          <>
                            {po.last_ddd_update_id && (
                              <button
                                onClick={() => onDecide(po, null)}
                                title="Respond to DD delay"
                                className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"
                              >
                                <MessageSquare size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => onFollowUp?.(po)}
                              title="Follow up next update"
                              className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"
                            >
                              <Calendar size={14} />
                            </button>
                            <button onClick={() => onInternalNote(po)} title="Internal note" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><StickyNote size={14} /></button>
                            {!po.marked_urgent && (
                              <button
                                onClick={() => onMarkUrgent?.(po)}
                                title="Mark as urgent"
                                className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"
                              >
                                <Zap size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button onClick={() => onLogDelay(po)} className={`h-7 px-2.5 text-[11px] font-semibold rounded-[6px] transition-colors ${po.effective_delayed_due_date ? 'bg-white text-[#E31B7F] border border-[#E5E5E5] hover:bg-[#FFF0F7] hover:border-[#E31B7F]' : 'bg-[#E31B7F] text-white hover:bg-[#C21571]'}`}>
                              {po.effective_delayed_due_date ? 'Edit delay' : 'Report delay'}
                            </button>
                            <button onClick={() => onGeneralUpdate(po)} className="h-7 px-2 text-[11px] font-semibold rounded-[6px] bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:border-[#E31B7F] transition-colors">Update</button>
                          </>
                        )}
                        <button onClick={() => onViewLogs(po)} title="View logs" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><Clock size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={expandColSpan} className="p-0 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                        <div className="sticky left-0 px-6 py-4" style={{ width: 'calc(100vw - 96px)', maxWidth: 1100 }}>
                          <SubPoDestinationTable poNumber={po.po_number} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <LoadMoreFooter
        visible={visibleRows.length}
        total={sortedRows.length}
        onLoadMore={() => setVisibleCount(c => c + PAGE_SIZE)}
        onShowAll={() => setVisibleCount(sortedRows.length)}
        rightSlot={<FilterButton activeCount={customFilters.length} onClick={(rect) => { setFilterAnchor(rect); setFilterModalOpen(true); }} />}
      />
      {filterModalOpen && (
        <CustomFilterModal
          columns={customFilterColumns}
          rules={customFilters}
          onChange={setCustomFilters}
          onClose={() => setFilterModalOpen(false)}
          anchorRect={filterAnchor}
        />
      )}
    </div>
  );
}