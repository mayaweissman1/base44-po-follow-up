import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Check, Info, X, Clock, MessageSquare, ChevronRight, ChevronUp, ChevronDown, Columns } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReasonTag from './ReasonTag';
import DdStatusBadge from './DdStatusBadge';
import PriorityBadge from './PriorityBadge';
import { fmtDate, ddmm } from '@/lib/followUpConstants';
import PoSizeBreakdown from './PoSizeBreakdown';
import StyleThumbnail from './StyleThumbnail';
import PmTagsPills from './PmTagsPills';

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
        {po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200">URGENT</span>}
        {isReceived && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">RECEIVED</span>}
        {isLate && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">LATE</span>}
        {isFuture && !po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">FUTURE</span>}
      </div>
    </div>
  );
}

function LoadMoreFooter({ visible, total, onLoadMore, onShowAll }) {
  if (visible >= total) {
    return (
      <div className="px-4 py-2.5 text-[11px] text-[#A3A3A3] bg-[#FAFAFA] border-t border-[#E5E5E5] text-center">
        Showing all {total} row{total === 1 ? '' : 's'}
      </div>
    );
  }
  return (
    <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between text-[11px]">
      <span className="text-[#525252]">
        Showing <strong className="text-[#0A0A0A]">{visible}</strong> of <strong className="text-[#0A0A0A]">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button onClick={onLoadMore} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white text-[#E31B7F] border border-[#E5E5E5] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors">Load more</button>
        <button onClick={onShowAll} className="h-7 px-3 text-[11px] font-semibold rounded-[6px] text-[#525252] hover:text-[#0A0A0A] hover:bg-white transition-colors">Show all ({total})</button>
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

// ─── Sort helpers ──────────────────────────────────────────────────────────────
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

// ─── Resize hook ───────────────────────────────────────────────────────────────
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

// ─── SortableResizableTh ───────────────────────────────────────────────────────
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

// Column header tooltips
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

// ─── DD Manager optional columns ──────────────────────────────────────────────
const OPTIONAL_COLS_DDM = [
  { key: 'flags',               label: 'Flags' },
  { key: 'countdown',           label: 'Countdown' },
  { key: 'set_with',            label: 'Set With' },
  { key: 'ordered_qty',         label: 'Order Qty' },
  { key: 'qty_received',        label: 'Qty Received' },
  { key: 'qty_rw_manual',       label: 'Manual RW' },
  { key: 'qty_rw_auto',         label: 'Auto RW' },
  { key: 'bulk_fabric_approval',label: 'Bulk Fabric' },
  { key: 'pps_receipt_date',    label: 'PPS Received' },
  { key: 'goods_received',      label: 'Goods Received' },
  { key: 'order_date',          label: 'Order Date' },
  { key: 'days_same_status',    label: 'Days Same Status' },
  { key: 'drop',                label: 'Drop' },
  { key: 'collection',          label: 'Collection' },
  { key: 'type',                label: 'Type' },
];

function loadDdmCols() {
  try {
    const saved = localStorage.getItem('ddmgr-opt-cols');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
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

  const activeCount = OPTIONAL_COLS_DDM.filter(c => visibleCols[c.key]).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold rounded-[6px] border transition-colors ${activeCount > 0 ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`}
      >
        <Columns size={12} />
        Columns{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,.12)] z-50 w-52 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#E5E5E5] text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
            Optional columns
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {OPTIONAL_COLS_DDM.map(col => (
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
              onClick={() => onChange({})}
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

const PAGE_SIZE = 100;

export default function FollowUpTable({
  rows, role, filterStatus, onDecide, onLogDelay, onGeneralUpdate, onViewLogs, onInternalNote, loading,
  selectedRows = new Set(), onSelectRow, onSelectAll, onPoDetails,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [ddmOptCols, setDdmOptCols] = useState(loadDdmCols);

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

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => compareRows(a, b, sortCol, sortDir));
  }, [rows, sortCol, sortDir]);

  const visibleRows = useMemo(() => sortedRows.slice(0, visibleCount), [sortedRows, visibleCount]);

  const allVisibleSelected = rows.length > 0 && rows.every(r => selectedRows.has(r.po_number));

  const thCls = "px-3.5 py-3 text-left text-[11px] font-bold text-[#525252] uppercase tracking-[.08em] whitespace-nowrap bg-[#F8F8F8] border-b border-[#E5E5E5] sticky top-0 z-10";
  const tdCls = "px-3.5 py-3 border-b border-[#E5E5E5] bg-white whitespace-nowrap text-[13px] align-middle";

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
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className={thCls} style={{ width: 36 }}>
                  <Checkbox checked={allVisibleSelected} onChange={() => onSelectAll?.(rows.map(r => r.po_number))} />
                </th>
                <th className={thCls} style={{ width: 56 }}></th>
                <Th {...thProps} col="po_number" width={colWidths['po_number'] || 140}>PO Number</Th>
                <Th {...thProps} col="flags" width={colWidths['flags'] || 70}>Flags</Th>
                <Th {...thProps} col="supplier" width={colWidths['supplier'] || 90}>Supplier</Th>
                <Th {...thProps} col="dd_manager_name" width={colWidths['dd_manager_name'] || 95}>DD Manager</Th>
                <Th {...thProps} col="style_color" width={colWidths['style_color'] || 110}>Style Color</Th>
                <Th {...thProps} col="current_status" width={colWidths['current_status'] || 90} tooltip={TIPS.current_status}>DDD Status</Th>
                <Th {...thProps} col="due_date" width={colWidths['due_date'] || 85}>Original DD</Th>
                <Th {...thProps} col="effective_delayed_due_date" width={colWidths['effective_delayed_due_date'] || 85}>Delayed DD</Th>
                <Th {...thProps} col="final_dd" width={colWidths['final_dd'] || 85}>DD Date</Th>
                <Th {...thProps} col="ddd_count" width={colWidths['ddd_count'] || 70} tooltip={TIPS.ddd_count}>DDD Count</Th>
                <Th {...thProps} col="countdown" width={colWidths['countdown'] || 80} tooltip={TIPS.countdown}>Countdown</Th>
                <Th {...thProps} col="ddd_reason" width={colWidths['ddd_reason'] || 120}>DDD Reason</Th>
                <Th {...thProps} col="ddd_comment" width={colWidths['ddd_comment'] || 160}>DDD Comment</Th>
                <Th {...thProps} col="delay_response_comment" width={colWidths['delay_response_comment'] || 140}>MO Response</Th>
                <Th {...thProps} col="set_with" width={colWidths['set_with'] || 85}>Set With</Th>
                <Th {...thProps} col="ordered_qty" width={colWidths['ordered_qty'] || 80}>Order Qty</Th>
                <Th {...thProps} col="qty_received" width={colWidths['qty_received'] || 85}>Qty Received</Th>
                <Th {...thProps} col="qty_rw_manual" width={colWidths['qty_rw_manual'] || 75}>Manual RW</Th>
                <Th {...thProps} col="qty_rw_auto" width={colWidths['qty_rw_auto'] || 70}>Auto RW</Th>
                <Th {...thProps} col="bulk_fabric_approval" width={colWidths['bulk_fabric_approval'] || 110} tooltip={TIPS.bulk_fabric_approval}>Bulk Fabric</Th>
                <Th {...thProps} col="pps_receipt_date" width={colWidths['pps_receipt_date'] || 95} tooltip={TIPS.pps_receipt_date}>PPS Received</Th>
                <Th {...thProps} col="goods_received" width={colWidths['goods_received'] || 95}>Goods Received</Th>
                <Th {...thProps} col="order_date" width={colWidths['order_date'] || 85}>Order Date</Th>
                <Th {...thProps} col="effective_dd_status" width={colWidths['effective_dd_status'] || 110} tooltip={TIPS.effective_dd_status}>Production Stage</Th>
                <Th {...thProps} col={null} width={colWidths['dd_comment_log'] || 170}>DD Comment</Th>
                <Th {...thProps} col="days_same_status" width={colWidths['days_same_status'] || 95} tooltip={TIPS.days_same_status}>Days Same Status</Th>
                <Th {...thProps} col="effective_next_update" width={colWidths['effective_next_update'] || 95}>Next Update</Th>
                <Th {...thProps} col="drop" width={colWidths['drop'] || 75}>Drop</Th>
                <Th {...thProps} col="collection" width={colWidths['collection'] || 90}>Collection</Th>
                <Th {...thProps} col="pm_tags" width={colWidths['pm_tags'] || 85} tooltip={TIPS.pm_tags}>PM Tags</Th>
                <Th {...thProps} col="type" width={colWidths['type'] || 70}>Type</Th>
                <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(po => {
                const isRejected = po.current_status === 'REJECTED';
                const rowBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                const actionBg = isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';
                const countdown = po.countdown;

                return (
                  <tr key={po.po_number} className="group cursor-pointer" onClick={() => onPoDetails?.(po)}>
                    <td className={`${tdCls} ${rowBg}`} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><StyleThumbnail key={po.po_number} styleColor={po.style_color} imageUrl={po.product_image} size={40} /></td>
                    <td className={`${tdCls} ${rowBg}`}><PoCell po={po} onLogsClick={onViewLogs} /></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.flags ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span> : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><StatusBadge status={po.current_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      <span className={`font-mono font-semibold ${countdown < 0 ? 'text-red-500' : countdown <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>
                        {countdown != null ? (countdown > 0 ? `+${countdown}` : countdown) : '—'}
                      </span>
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><ReasonTag reasons={po.ddd_reasons} reason={po.ddd_reason} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="text-[#A3A3A3] truncate max-w-[180px] inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.delay_response_comment
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-blue-50 text-blue-600 max-w-[150px] truncate" title={po.delay_response_comment}>{po.delay_response_comment}</span>
                        : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#A3A3A3]">{po.set_with || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ordered_qty ?? '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{po.qty_received ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_manual ? <span className="font-mono font-semibold text-red-500">{Number(po.qty_rw_manual).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_auto ? <span className="font-mono font-semibold text-red-500">{Number(po.qty_rw_auto).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}>{po.bulk_fabric_approval === true ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Approved</span> : po.bulk_fabric_approval === false ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">Pending</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.pps_receipt_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.goods_received)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.order_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><DdCommentLog log={po.dd_comment_log} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.days_same_status != null ? `${po.days_same_status}d` : '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_next_update ? <span className="font-mono">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3] text-xs">{fmtDate(po.drop)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.collection}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><PmTagsPills label={po.pm_tags_label} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#525252]">{po.type || '—'}</span></td>
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
        />
      </div>
    );
  }

  // ─── Main Office + DD Team Manager view ────────────────────────────────────
  const optVisible = role === 'dd_team_manager' ? ddmOptCols : {};
  const optCols = OPTIONAL_COLS_DDM.filter(c => optVisible[c.key]);
  // colSpan: checkbox + chevron + thumb + 20 always-shown cols + optional + role-specific
  const baseColCount = role === 'dd_team_manager' ? 24 : 26;
  const expandColSpan = baseColCount + optCols.length;

  function renderOptTd(po, bg) {
    return optCols.map(col => {
      const v = po[col.key];
      let cell;
      switch (col.key) {
        case 'flags':
          cell = v ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase ${v === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{v}</span> : <span className="text-[#A3A3A3]">—</span>;
          break;
        case 'countdown':
          cell = <span className={`font-mono font-semibold ${v < 0 ? 'text-red-500' : v <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>{v != null ? (v > 0 ? `+${v}` : v) : '—'}</span>;
          break;
        case 'qty_rw_manual':
        case 'qty_rw_auto':
          cell = v ? <span className="font-mono font-semibold text-red-500">{Number(v).toLocaleString()}</span> : <span className="text-[#A3A3A3]">—</span>;
          break;
        case 'bulk_fabric_approval':
          cell = v === true ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Approved</span>
            : v === false ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.65rem] text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">Pending</span>
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
              <th className={thCls} style={{ width: 56 }}></th>
              <Th {...thProps} col="po_number"                     width={colWidths['po_number'] || 140}>PO Number</Th>
              <Th {...thProps} col="style_color"                   width={colWidths['style_color'] || 110}>Style Color</Th>
              <Th {...thProps} col="po_rank"                       width={colWidths['po_rank'] || 60}  tooltip={TIPS.po_rank}>Rank</Th>
              <Th {...thProps} col="effective_dd_status"           width={colWidths['effective_dd_status'] || 110} tooltip={TIPS.effective_dd_status}>Production Stage</Th>
              <Th {...thProps} col="current_status"                width={colWidths['current_status'] || 95}  tooltip={TIPS.current_status}>DDD Status</Th>
              <Th {...thProps} col="priority"                      width={colWidths['priority'] || 85}  tooltip={TIPS.priority}>Priority</Th>
              <Th {...thProps} col="dd_manager_name"               width={colWidths['dd_manager_name'] || 95}>DD Manager</Th>
              <Th {...thProps} col="supplier"                      width={colWidths['supplier'] || 90}>Supplier</Th>
              <Th {...thProps} col="delivery_date_status"          width={colWidths['delivery_date_status'] || 140}>Delivery Status</Th>
              <Th {...thProps} col="due_date"                      width={colWidths['due_date'] || 80}>Due Date</Th>
              <Th {...thProps} col="effective_delayed_due_date"    width={colWidths['effective_delayed_due_date'] || 85}>Delayed DD</Th>
              <Th {...thProps} col="final_dd"                      width={colWidths['final_dd'] || 80}>Final DD</Th>
              <Th {...thProps} col="effective_next_update"         width={colWidths['effective_next_update'] || 95}>Next Update</Th>
              <Th {...thProps} col="days_late_counting"            width={colWidths['days_late_counting'] || 75} tooltip={TIPS.days_late_counting}>Days Late</Th>
              <Th {...thProps} col="ddd_reason"                    width={colWidths['ddd_reason'] || 120}>DD Reason</Th>
              <Th {...thProps} col="ddd_comment"                   width={colWidths['ddd_comment'] || 160}>DDD Comment</Th>
              <Th {...thProps} col={null}                          width={colWidths['dd_comment_log'] || 170}>DD Comment</Th>
              {role === 'main_office' && <Th {...thProps} col="hold_age_days" width={colWidths['hold_age_days'] || 80} tooltip={TIPS.hold_age_days}>HOLD Age</Th>}
              <Th {...thProps} col="delay_response_comment"        width={colWidths['delay_response_comment'] || 130}>Delay Response</Th>
              {role === 'main_office' && <Th {...thProps} col="internal_note" width={colWidths['internal_note'] || 150}>Last Comment (internal)</Th>}
              <Th {...thProps} col="ddd_count"                     width={colWidths['ddd_count'] || 70}  tooltip={TIPS.ddd_count}>DDD Count</Th>
              <Th {...thProps} col="pm_tags"                       width={colWidths['pm_tags'] || 110} tooltip={TIPS.pm_tags}>PM Tags</Th>
              {optCols.map(col => (
                <Th key={col.key} {...thProps} col={col.key} width={colWidths[col.key] || 110}>{col.label}</Th>
              ))}
              <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(po => {
              const isExpanded = expanded.has(po.po_number);
              const isRejected = po.current_status === 'REJECTED';
              const tdBase = `${tdCls} ${isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]'}`;
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
                    <td className={tdBase}><StyleThumbnail key={po.po_number} styleColor={po.style_color} imageUrl={po.product_image} size={40} /></td>
                    <td className={tdBase}><PoCell po={po} onLogsClick={onViewLogs} /></td>
                    <td className={tdBase}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={tdBase}><span className="font-mono font-semibold">{po.po_rank ?? '—'}</span></td>
                    <td className={tdBase}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={tdBase}><StatusBadge status={po.current_status} /></td>
                    <td className={tdBase}><PriorityBadge priority={po.priority} /></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded-[0.65rem] text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={tdBase}><span className="text-[#525252] text-xs max-w-[160px] truncate inline-block" title={po.delivery_date_status ?? po.ddd_comment}>{deliveryDateStatusText(po)}</span></td>
                    <td className={tdBase}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={tdBase}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={tdBase}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>
                    <td className={tdBase}>{po.effective_next_update ? <span className="font-mono text-xs">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={tdBase}><DaysCell value={po.days_late_counting} /></td>
                    <td className={tdBase}><ReasonTag reasons={po.ddd_reasons} reason={po.ddd_reason} /></td>
                    <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={tdBase}><DdCommentLog log={po.dd_comment_log} /></td>
                    {role === 'main_office' && (
                      <td className={tdBase}>
                        {po.hold_age_days != null ? (
                          <span className={`font-mono font-semibold ${po.hold_age_days > 0 ? 'text-red-500' : 'text-[#A3A3A3]'}`}>
                            {po.hold_age_days <= 0 ? 'Today' : `${po.hold_age_days}d ago`}
                          </span>
                        ) : <span className="text-[#A3A3A3]">—</span>}
                      </td>
                    )}
                    <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.delay_response_comment}>{po.delay_response_comment || '—'}</span></td>
                    {role === 'main_office' && (
                      <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.internal_note}>{po.internal_note || '—'}</span></td>
                    )}
                    <td className={tdBase}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={tdBase}><PmTagsPills label={po.pm_tags_label} /></td>
                    {renderOptTd(po, isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]')}
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionCellBase}`} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {role === 'main_office' ? (
                          <>
                            <button onClick={() => onDecide(po, 'APPROVED')}     title="Approved"      className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-green-50 hover:text-green-600 transition-colors"><Check size={15} /></button>
                            <button onClick={() => onDecide(po, 'ACKNOWLEDGED')} title="Acknowledged"  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-teal-50 hover:text-teal-600 transition-colors"><Info size={15} /></button>
                            <button onClick={() => onDecide(po, 'REJECTED')}     title="Rejected"      className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-red-50 hover:text-red-500 transition-colors"><X size={15} /></button>
                            <button onClick={() => onInternalNote(po)}           title="Internal note" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><MessageSquare size={14} /></button>
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
                        <div className="sticky left-0 px-6 py-4" style={{ width: 'calc(100vw - 96px)', maxWidth: 900 }}>
                          <PoSizeBreakdown poNumber={po.po_number} />
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
      />
    </div>
  );
}
