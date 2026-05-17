import React, { useState } from 'react';
import { Check, Info, X, Clock, MessageSquare, ChevronRight, FileText } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReasonTag from './ReasonTag';
import DdStatusBadge from './DdStatusBadge';
import PriorityBadge from './PriorityBadge';
import { fmtDate, ddmm, getResponsibility } from '@/lib/followUpConstants';

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

function PoCell({ po, onLogsClick }) {
  const isLate = po.late_future === 'LATE';
  const isFuture = po.late_future === 'FUTURE';
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onLogsClick(po)} className="font-mono font-semibold text-[#E31B7F] hover:underline text-[13px]">{po.po_number}</button>
      </div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200">URGENT</span>}
        {isLate && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200">LATE</span>}
        {isFuture && !po.urgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">FUTURE</span>}
      </div>
    </div>
  );
}

export default function FollowUpTable({ rows, role, onDecide, onLogDelay, onGeneralUpdate, onViewLogs, onInternalNote, loading }) {
  const [expanded, setExpanded] = useState(new Set());

  function toggleExpand(poNumber) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber); else next.add(poNumber);
      return next;
    });
  }

  const thCls = "px-3.5 py-3 text-left text-[11px] font-bold text-[#525252] uppercase tracking-[.08em] whitespace-nowrap bg-[#F8F8F8] border-b border-[#E5E5E5] sticky top-0 z-10";
  const tdCls = "px-3.5 py-3 border-b border-[#E5E5E5] bg-white whitespace-nowrap text-[13px] align-middle";

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="flex items-center justify-center h-40 text-sm text-[#A3A3A3]">Loading PO data…</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="text-center py-16">
          <div className="text-lg font-semibold text-[#0A0A0A] mb-2">All caught up ✦</div>
          <div className="text-sm text-[#525252]">No delay requests need your attention right now.</div>
        </div>
      </div>
    );
  }

  // DD Team Employee uses a completely different column layout
  if (role === 'dd_team_employee') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
          <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className={thCls}>PO Number</th>
                <th className={thCls}>Flags</th>
                <th className={thCls}>Supplier</th>
                <th className={thCls}>DD Manager</th>
                <th className={thCls}>Style Color</th>
                <th className={thCls}>Order Qty</th>
                <th className={thCls}>Qty Received</th>
                <th className={thCls}>Manual RW</th>
                <th className={thCls}>Auto RW</th>
                <th className={thCls}>Goods Received</th>
                <th className={thCls}>Order Date</th>
                <th className={thCls} title="Comment from latest Log/Edit Delay">DDD Comment</th>
                <th className={thCls}>DD Status</th>
                <th className={thCls} title="Stamped history of general update comments">DD Comment</th>
                <th className={thCls} title="Days in current status">Days Same Status</th>
                <th className={thCls}>Next Update</th>
                <th className={thCls}>DD Date</th>
                <th className={thCls}>Due Date</th>
                <th className={thCls}>Delayed DD</th>
                <th className={thCls}>DDD Status</th>
                <th className={thCls} title="Times Delayed DD was pushed">DDD Count</th>
                <th className={thCls} title="Days until Final DD">Countdown</th>
                <th className={thCls}>DD Reason</th>
                <th className={thCls}>Drop</th>
                <th className={thCls}>Collection</th>
                <th className={thCls}>PM Tags</th>
                <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(po => {
                const isRejected = po.current_status === 'REJECTED';
                const rowBg = isRejected ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-[#FFF0F7]';
                const actionBg = isRejected ? 'bg-red-50' : 'bg-white';
                const countdown = po.countdown;

                return (
                  <tr key={po.po_number} className="group">
                    <td className={`${tdCls} ${rowBg}`}><PoCell po={po} onLogsClick={onViewLogs} /></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      {po.flags ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${po.flags === 'URGENT' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>{po.flags}</span> : <span className="text-[#A3A3A3]">—</span>}
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ordered_qty ?? '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{po.qty_received ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_manual ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}>{po.qty_rw_auto ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">Yes</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.goods_received)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.order_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="text-[#A3A3A3] truncate max-w-[180px] inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><DdCommentLog log={po.dd_comment_log} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.days_same_status != null ? `${po.days_same_status}d` : '—'}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_next_update ? <span className="font-mono">{fmtDate(po.effective_next_update)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} ${rowBg}`}><StatusBadge status={po.current_status} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono">{po.ddd_count ?? 0}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>
                      <span className={`font-mono font-semibold ${countdown < 0 ? 'text-red-500' : countdown <= 3 ? 'text-[#525252]' : 'text-green-500'}`}>
                        {countdown > 0 ? `+${countdown}` : countdown}
                      </span>
                    </td>
                    <td className={`${tdCls} ${rowBg}`}><ReasonTag reason={po.ddd_reason} /></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="font-mono text-[#A3A3A3] text-xs">{fmtDate(po.drop)}</span></td>
                    <td className={`${tdCls} ${rowBg}`}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.collection}</span></td>
                    <td className={`${tdCls} ${rowBg}`}>{po.pm_tags ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-200">{po.pm_tags}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={`${tdCls} sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,.04)] ${actionBg} group-hover:bg-[#FFF0F7]`}>
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
      </div>
    );
  }

  // Main Office + DD Team Manager view
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
        <table className="border-collapse w-full text-[13px]" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              {role !== 'dd_team_manager' && <th className={thCls} style={{ width: 36 }}></th>}
              <th className={thCls} style={{ width: 36 }}></th>
              <th className={thCls}>PO Number</th>
              <th className={thCls}>Style Color</th>
              <th className={thCls}>PO Rank</th>
              <th className={thCls}>Current Status</th>
              <th className={thCls}>Priority</th>
              <th className={thCls}>DD Manager</th>
              <th className={thCls}>Supplier</th>
              <th className={thCls}>DD Status</th>
              <th className={thCls}>Due Date</th>
              <th className={thCls}>Delayed DD</th>
              <th className={thCls}>Final DD</th>
              <th className={thCls}>Days Late</th>
              <th className={thCls}>DD Reason</th>
              <th className={thCls} title="Latest DDD update comment">DDD Comment</th>
              <th className={thCls} title="General update comments history">DD Comment</th>
              {role === 'main_office' && <th className={thCls}>HOLD Age</th>}
              <th className={thCls}>Delay Response</th>
              {role === 'main_office' && <th className={thCls}>Last Comment (internal)</th>}
              <th className={thCls}>Next Update</th>
              <th className={thCls}>DDD Count</th>
              <th className={`${thCls} sticky right-0 z-20 shadow-[-4px_0_8px_rgba(0,0,0,.04)]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(po => {
              const isExpanded = expanded.has(po.po_number);
              const isRejected = po.current_status === 'REJECTED';
              const tdBase = `${tdCls} ${role === 'dd_team_manager' && isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'group-hover:bg-[#FFF0F7]'}`;
              const actionCellBase = role === 'dd_team_manager' && isRejected ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-[#FFF0F7]';

              return (
                <React.Fragment key={po.po_number}>
                  <tr className="group cursor-default">
                    {role !== 'dd_team_manager' && (
                      <td className={`${tdBase} w-9`}></td>
                    )}
                    <td className={`${tdBase} w-9`}>
                      <button onClick={() => toggleExpand(po.po_number)} className={`w-[18px] h-[18px] flex items-center justify-center text-[#525252] transition-transform ${isExpanded ? 'rotate-90 text-[#E31B7F]' : ''}`}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                    <td className={tdBase}><PoCell po={po} onLogsClick={onViewLogs} /></td>
                    <td className={tdBase}><span className="font-mono text-[12px]">{po.style_color}</span></td>
                    <td className={tdBase}><span className="font-mono font-semibold">{po.po_rank ?? '—'}</span></td>
                    <td className={tdBase}><StatusBadge status={po.current_status} /></td>
                    <td className={tdBase}><PriorityBadge priority={po.priority} /></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFF0F7] text-[#E31B7F]">{po.dd_manager_name || '—'}</span></td>
                    <td className={tdBase}><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">{po.supplier}</span></td>
                    <td className={tdBase}><DdStatusBadge status={po.effective_dd_status} /></td>
                    <td className={tdBase}><span className="font-mono text-[#A3A3A3]">{fmtDate(po.due_date)}</span></td>
                    <td className={tdBase}>{po.effective_delayed_due_date ? <span className="font-mono font-semibold">{fmtDate(po.effective_delayed_due_date)}</span> : <span className="text-[#A3A3A3]">—</span>}</td>
                    <td className={tdBase}><span className="font-mono font-semibold">{fmtDate(po.final_dd)}</span></td>
                    <td className={tdBase}><DaysCell value={po.days_late_counting} /></td>
                    <td className={tdBase}><ReasonTag reason={po.ddd_reason} /></td>
                    <td className={tdBase}><span className="text-[#A3A3A3] text-xs max-w-[180px] truncate inline-block" title={po.ddd_comment}>{po.ddd_comment || '—'}</span></td>
                    <td className={tdBase}><DdCommentLog log={po.dd_comment_log} /></td>
                    {role === 'main_office' && (
                      <td className={tdBase}>
                        {po.current_status === 'HOLD' && po.hold_age_days != null ? (
                          <span className={`font-mono font-semibold ${po.hold_age_days > 0 ? 'text-red-500' : 'text-[#A3A3A3]'}`}>
                            {po.hold_age_days === 0 ? 'Today' : `${po.hold_age_days}d ago`}
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
                            <button onClick={() => onDecide(po, 'APPROVED')}    title="Approved"     className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-green-50 hover:text-green-600 transition-colors"><Check size={15} /></button>
                            <button onClick={() => onDecide(po, 'ACKNOWLEDGED')} title="Acknowledged" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-teal-50 hover:text-teal-600 transition-colors"><Info size={15} /></button>
                            <button onClick={() => onDecide(po, 'REJECTED')}     title="Rejected"     className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-red-50 hover:text-red-500 transition-colors"><X size={15} /></button>
                            <button onClick={() => onInternalNote(po)}           title="Internal note" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><MessageSquare size={14} /></button>
                          </>
                        ) : (
                          <button onClick={() => onLogDelay(po)} className={`h-7 px-3 text-[11px] font-semibold rounded-[6px] transition-colors ${po.effective_delayed_due_date ? 'bg-white text-[#E31B7F] border border-[#E5E5E5] hover:bg-[#FFF0F7] hover:border-[#E31B7F]' : 'bg-[#E31B7F] text-white hover:bg-[#C21571]'}`}>
                            {po.effective_delayed_due_date ? 'Edit delay' : 'Report delay'}
                          </button>
                        )}
                        <button onClick={() => onViewLogs(po)} title="View logs" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors"><Clock size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={role === 'dd_team_manager' ? 22 : 23} className="p-0 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                        <div className="px-6 py-4">
                          <div className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] mb-2.5">📦 Sub-POs · per destination</div>
                          <div className="bg-white border border-[#E5E5E5] rounded-[8px] overflow-hidden">
                            <table className="border-collapse w-full text-xs">
                              <thead>
                                <tr>
                                  {['Destination', 'Priority', 'Ordered Qty', 'Qty Received'].map(h => (
                                    <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.08em] bg-[#F8F8F8] border-b border-[#E5E5E5]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="hover:bg-[#FFF0F7]">
                                  <td className="px-3.5 py-2.5 border-b border-[#E5E5E5]">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFF0F7] text-[#E31B7F] text-[11px] font-bold">UK</span>
                                  </td>
                                  <td className="px-3.5 py-2.5 border-b border-[#E5E5E5]"><PriorityBadge priority={po.priority} /></td>
                                  <td className="px-3.5 py-2.5 border-b border-[#E5E5E5] font-mono">{po.ordered_qty ?? '—'}</td>
                                  <td className="px-3.5 py-2.5 border-b border-[#E5E5E5] font-mono">{po.qty_received ?? 0}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
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
    </div>
  );
}