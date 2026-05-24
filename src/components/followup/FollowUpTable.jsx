import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Check, Info, X, Clock, MessageSquare, ChevronRight, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReasonTag from './ReasonTag';
import DdStatusBadge from './DdStatusBadge';
import PriorityBadge from './PriorityBadge';
import { fmtDate, ddmm } from '@/lib/followUpConstants';
import PoSizeBreakdown from './PoSizeBreakdown';

function DaysCell({ value }) {
  if (value === null || value === undefined) return <span className="font-mono text-[#A3A3A3]">0</span>;
  const cls = value <= 0 ? 'text-green-500' : value <= 3 ? 'text-[#525252]' : 'text-red-500';
  return <span className={`font-mono font-semibold ${cls}`}>{value > 0 ? `+${value}` : value}</span>;
}

function DdCommentLog({ log }) {
  if (!log || log.length === 0) return <span className="text-[#A3A3A3]">—</span>;
  return (
    <div className="max-w-[200px]">
      {log.map((e, i) => (
        <div key={i} className="text-[11px] truncate leading-snug" title={e.text}>
          <span className="font-mono opacity-60">{ddmm(e.date)}</span> — {e.text}
        </div>
      ))}
    </div>
  );
}

function PoCell({ po, onLogsClick, onDetailsClick }) {
  const isLate = po.late_future === 'LATE';
  const isFuture = po.late_future === 'FUTURE';
  const isReceived = po.late_future === 'RECEIVED';
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onLogsClick(po)} className="font-mono font-semibold text-[#E31B7F] hover:underline text-[13px]">{po.po_number}</button>
        {onDetailsClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onDetailsClick(po); }}
            title="PO details"
            className="w-5 h-5 flex items-center justify-center rounded text-[#A3A3A3] hover:text-[#E31B7F] hover:bg-[#FFF0F7] transition-colors flex-shrink-0"
          >
            <FileText size={11} />
          </button>
        )}
      </div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200">URGENT</span>}
        {isReceived && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">RECEIVED</span>}
        {isLate && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">LATE</span>}
        {isFuture && !po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">FUTURE</span>}
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
        <button
          onClick={onLoadMore}
          className="h-7 px-3 text-[11px] font-semibold rounded-[6px] bg-white text-[#E31B7F] border border-[#E5E5E5] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors"
        >
          Load more
        </button>
        <button
          onClick={onShowAll}
          className="h-7 px-3 text-[11px] font-semibold rounded-[6px] text-[#525252] hover:text-[#0A0A0A] hover:bg-white transition-colors"
        >
          Show all ({total})
        </button>
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
function Th({ col, sortCol, sortDir, onSort, width, onResizeStart, className, children, style = {} }) {
  const isActive = sortCol === col;
  return (
    <th
      className={`${className} relative select-none`}
      style={{ minWidth: width || 80, ...style }}
      onClick={col ? () => onSort(col) : undefined}
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

const PAGE_SIZE = 100;

export default function FollowUpTable({
  rows, role, filterStatus, onDecide, onLogDelay, onGeneralUpdate, onViewLogs, onInternalNote, loading,
  selectedRows = new Set(), onSelectRow, onSelectAll, onPoDetails,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset sort and pagination when role changes
  useEffect(() => {
    setSortCol(null);
    setSortDir('asc');
    setVisibleCount(PAGE_SIZE);
  }, [role]);

  // Reset pagination when filtered rows change (filter applied)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [rows.length]);

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
  const hasMore = sortedRows.length > visibleCount;

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
                <Th {...thProps} col="po_number" width={colWidths['po_number'] || 160}>PO Number</Th>
                <Th {...thProps} col="flags" width={colWidths['flags'] || 80}>Flags</Th>
                <Th {...thProps} col="supplier" width={colWidths['supplier'] || 100}>Supplier</Th>
                <Th {...thProps} col="dd_manager_name" width={colWidths['dd_manager_name'] || 100}>DD Manager</Th>
                <Th {...thProps} col="style_color" width={colWidths['style_color'] || 120}>Style Color</Th>
                <Th {...thProps} col="current_status" width={colWidths['current_status'] || 100}>DDD Status</Th>
                <Th {...thProps} col="due_date" width={colWidths['due_date'] || 100}>Original DD</Th>
                <Th {...thProps} col="effective_delayed_due_date" width={colWidths['effective_delayed_due_date'] || 100}>Delayed DD</Th>
                <Th {...thProps} col="ddd_count" width={colWidths['ddd_count'] || 80}>DDD Count</Th>
                <Th {...thProps} col="countdown" width={colWidths['countdown'] || 90}>Countdown</Th>
                <Th {...thProps} col="ddd_reason" width={colWidths['ddd_reason'] || 140}>DDD Reason</Th>
                <Th {...thProps} col="ddd_comment" width={colWidths['ddd_comment'] || 180}>DDD Comment</Th>
                <Th {...thProps} col="set_with" width={colWidths['set_with'] || 100}>Set With</Th>
                <Th {...thProps} col="ordered_qty" width={colWidths['ordered_qty'] || 90}>Order Qty</Th>
                <Th {...thProps} col="qty_received" width={colWidths['qty_received'] || 100}>Qty Received</Th>
                <Th {...thProps} col="qty_rw_manual" width={colWidths['qty_rw_manual'] || 90}>Manual RW</Th>
                <Th {...thProps} col="qty_rw_auto" width={colWidths['qty_rw_auto'] || 80}>Auto RW</Th>
                <Th {...thProps} col="goods_received" width={colWidths['goods_received'] || 110}>Goods Received</Th>
                <Th {...thProps} col="order_date" width={colWidths['order_date'] || 100}>Order Date</Th>
                <Th {...thProps} col="effective_dd_status" width={colWidths['effective_dd_status'] || 120}>DD Status</Th>
                <Th {...thProps} col={null} width={colWidths['dd_comment_log'] || 180}>DD Comment</Th>
                <Th {...thProps} col="days_same_status" width={colWidths['days_same_status'] || 110}>Days Same Status</Th>
                <Th {...thProps} col="effective_next_update" width={colWidths['effective_next_update'] || 110}>Next Update</Th>
                <Th {...thProps} col="drop" width={colWidths['drop'] || 90}>Drop</Th>
                <Th {...thProps} col="collection" width={colWidths['collection'] || 100}>Collection</Th>
                <Th {...thProps} col="pm_tags" width={colWidths['pm_tags'] || 90}>PM Tags</Th>
                <Th {...thProps} col="type" width={colWidths['type'] || 80}>Type</Th>
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
                  <tr key={po.po_number} className="group">
                    <td className={`${tdCls} ${rowBg}`}>
                      <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><PoCell po={po} onLogsClick={onViewLogs} onDetailsClick={onPoDetails} /></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.flags ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span> : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><StatusBadge status={po.current_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      <span className={`font-mono font-semibold ${countdown < 0 ? 'text-red-500' : countdown <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>
                        {countdown != null ? (countdown > 0 ? `+${countdown}` : countdown) : '—'}
                      </span>
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><ReasonTag reason={po.ddd_reason} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="text-[#A3A3A3] truncate max-w-[180px] inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#A3A3A3]">{po.set_with || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ordered_qty ?? '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{po.qty_received ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_manual ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_auto ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.goods_received)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.order_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><DdCommentLog log={po.dd_comment_log} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.days_same_status != null ? `${po.days_same_status}d` : '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_next_update ? <span className="font-mono">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3] text-xs">{fmtDate(po.drop)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.collection}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.pm_tags ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">{po.pm_tags}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-xs text-[#525252]">{po.type || '—'}</span></td>
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionBg}`}>
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
  // Column counts (for sub-PO expand colSpan):
  //   main_office:     checkbox + chevron + 19 always-shown + HOLD Age + Last Comment = 24
  //   dd_team_manager: chevron + 19 always-shown = 21
  const expandColSpan = role === 'dd_team_manager' ? 22 : 24;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
      <div className="overflow-auto max-h-[calc(100vh-280px)]">
        <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className={thCls} style={{ width: 36 }}>
                <Checkbox checked={allVisibleSelected} onChange={() => onSelectAll?.(rows.map(r => r.po_number))} />
              </th>
              <th className={thCls} style={{ width: 36 }}></th>
              <Th {...thProps} col="po_number"                     width={colWidths['po_number'] || 170}>PO Number</Th>
              <Th {...thProps} col="style_color"                   width={colWidths['style_color'] || 130}>Style Color</Th>
              <Th {...thProps} col="po_rank"                       width={colWidths['po_rank'] || 80}>PO Rank</Th>
              <Th {...thProps} col="current_status"                width={colWidths['current_status'] || 120}>Current Status</Th>
              <Th {...thProps} col="priority"                      width={colWidths['priority'] || 100}>Priority</Th>
              <Th {...thProps} col="dd_manager_name"               width={colWidths['dd_manager_name'] || 110}>DD Manager</Th>
              <Th {...thProps} col="supplier"                      width={colWidths['supplier'] || 100}>Supplier</Th>
              <Th {...thProps} col="effective_dd_status"           width={colWidths['effective_dd_status'] || 130}>DD Status</Th>
              <Th {...thProps} col="delivery_date_status"          width={colWidths['delivery_date_status'] || 170}>Delivery Date Status</Th>
              <Th {...thProps} col="due_date"                      width={colWidths['due_date'] || 95}>Due Date</Th>
              <Th {...thProps} col="effective_delayed_due_date"    width={colWidths['effective_delayed_due_date'] || 100}>Delayed DD</Th>
              <Th {...thProps} col="final_dd"                      width={colWidths['final_dd'] || 90}>Final DD</Th>
              <Th {...thProps} col="days_late_counting"            width={colWidths['days_late_counting'] || 90}>Days Late</Th>
              <Th {...thProps} col="ddd_reason"                    width={colWidths['ddd_reason'] || 140}>DD Reason</Th>
              <Th {...thProps} col="ddd_comment"                   width={colWidths['ddd_comment'] || 180}>DDD Comment</Th>
              <Th {...thProps} col={null}                          width={colWidths['dd_comment_log'] || 190}>DD Comment</Th>
              {role === 'main_office' && <Th {...thProps} col="hold_age_days" width={colWidths['hold_age_days'] || 95}>HOLD Age</Th>}
              <Th {...thProps} col="delay_response_comment"        width={colWidths['delay_response_comment'] || 150}>Delay Response</Th>
              {role === 'main_office' && <Th {...thProps} col="internal_note" width={colWidths['internal_note'] || 170}>Last Comment (internal)</Th>}
              <Th {...thProps} col="effective_next_update"         width={colWidths['effective_next_update'] || 110}>Next Update</Th>
              <Th {...thProps} col="ddd_count"                     width={colWidths['ddd_count'] || 90}>DDD Count</Th>
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
                  <tr className="group cursor-default">
                    <td className={`${tdBase} w-9`}>
                      <Checkbox checked={selectedRows.has(po.po_number)} onChange={() => onSelectRow?.(po.po_number)} />
                    </td>
                    <td className={`${tdBase} w-9`}>
                      <button onClick={() => toggleExpand(po.po_number)} className={`w-[18px] h-[18px] flex items-center justify-center text-[#525252] transition-transform ${isExpanded ? 'rotate-90 text-[#E31B7F]' : ''}`}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                    <td className={tdBase}><PoCell po={po} onLogsClick={onViewLogs} onDetailsClick={onPoDetails} /></td>
                    <td className={tdBase}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={tdBase}><span className="font-mono font-semibold">{po.po_rank ?? '—'}</span></td>
                    <td className={tdBase}><StatusBadge status={po.current_status} /></td>
                    <td className={tdBase}><PriorityBadge priority={po.priority} /></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={tdBase}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={tdBase}><span className="text-[#525252] text-xs max-w-[160px] truncate inline-block" title={po.delivery_date_status ?? po.ddd_comment}>{deliveryDateStatusText(po)}</span></td>
                    <td className={tdBase}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={tdBase}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={tdBase}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>
                    <td className={tdBase}><DaysCell value={po.days_late_counting} /></td>
                    <td className={tdBase}><ReasonTag reason={po.ddd_reason} /></td>
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
                    <td className={tdBase}>{po.effective_next_update ? <span className="font-mono text-xs">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={tdBase}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionCellBase}`}>
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