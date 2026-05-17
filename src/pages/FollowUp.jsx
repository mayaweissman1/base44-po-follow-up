import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_DISPLAY, REASON_TO_RESPONSIBILITY } from '@/lib/followUpConstants';
import KpiCards from '@/components/followup/KpiCards';
import StatsRow from '@/components/followup/StatsRow';
import FilterToolbar from '@/components/followup/FilterToolbar';
import FollowUpTable from '@/components/followup/FollowUpTable';
import LogDelayModal from '@/components/followup/LogDelayModal';
import GeneralUpdateModal from '@/components/followup/GeneralUpdateModal';
import DecisionModal from '@/components/followup/DecisionModal';
import InternalNoteModal from '@/components/followup/InternalNoteModal';
import ActivityLogDrawer from '@/components/followup/ActivityLogDrawer';

const DEFAULT_FILTERS = (role) => ({
  po: '',
  style: '',
  status: role === 'main_office' ? 'HOLD' : 'ALL',
  priority: '',
  supplier: '',
  ddManager: '',
  ddStatus: '',
  reason: '',
  responsibility: '',
  urgent: false,
  collection: '',
  orderType: '',
  flag: '',
});

function passesFilters(row, filters, role) {
  const { po, style, status, priority, supplier, ddManager, ddStatus, reason, responsibility, urgent, collection, orderType, flag } = filters;

  if (po && !row.po_number.toLowerCase().includes(po.toLowerCase())) return false;
  if (style && !row.style_color.toLowerCase().includes(style.toLowerCase())) return false;
  if (supplier && row.supplier !== supplier) return false;
  if (ddManager && row.dd_manager_name !== ddManager) return false;
  if (collection && !row.collection.toLowerCase().includes(collection.toLowerCase())) return false;
  if (orderType) {
    const t = row.po_number.endsWith('-CL') ? 'CL' : row.po_number.endsWith('-AC') ? 'ACC' : 'Regular';
    if (t !== orderType) return false;
  }
  if (flag) {
    if (flag === 'URGENT' && row.flags !== 'URGENT') return false;
    if (flag === 'REVIEW' && row.flags !== 'REVIEW') return false;
  }
  if (urgent && !row.urgent) return false;
  if (ddStatus && row.effective_dd_status !== ddStatus) return false;
  if (reason && row.ddd_reason !== reason) return false;
  if (responsibility && REASON_TO_RESPONSIBILITY[row.ddd_reason] !== responsibility) return false;

  if (priority) {
    if (priority === 'URGENT' && row.priority !== 'URGENT') return false;
    if (priority === 'Deadline' && !(row.priority || '').includes('Deadline')) return false;
    if (priority === 'Normal' && row.priority !== 'Normal') return false;
  }

  if (status === 'HOLD' && row.current_status !== 'HOLD') return false;
  else if (status === 'HANDLED' && !['APPROVED', 'REJECTED', 'ACKNOWLEDGED'].includes(row.current_status)) return false;
  else if (status === 'ALL') { /* show all */ }
  else if (['APPROVED', 'REJECTED', 'ACKNOWLEDGED', 'AUTOMATICALLY'].includes(status) && row.current_status !== status) return false;

  return true;
}

export default function FollowUp() {
  const { user } = useAuth();
  const scrollAreaRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const userRole = user?.role || 'main_office';
  const [activeRole, setActiveRole] = useState(userRole || 'main_office');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS(activeRole));
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);

  // Modals
  const [logDelayPo, setLogDelayPo] = useState(null);
  const [generalUpdatePo, setGeneralUpdatePo] = useState(null);
  const [decisionState, setDecisionState] = useState(null);
  const [internalNotePo, setInternalNotePo] = useState(null);
  const [logsDrawerPo, setLogsDrawerPo] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const payload = {};
    if (activeRole === 'dd_team_employee' && user?.dd_employee_id) {
      payload.dd_employee_id = user.dd_employee_id;
    }
    const res = await base44.functions.invoke('getFollowUpData', payload);
    if (res.data?.rows) {
      setRows(res.data.rows);
      setKpis(res.data.kpis || {});
    }
    setLoading(false);
  }, [activeRole, user?.dd_employee_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    function onScroll() {
      setScrolled(el.scrollTop > 60);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS(activeRole));
    setActiveKpiFilter(null);
  }, [activeRole]);

  function handleKpiFilterClick(filterKey) {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null);
      setFilters(f => ({ ...f, status: activeRole === 'main_office' ? 'HOLD' : 'ALL', urgent: false }));
      return;
    }
    setActiveKpiFilter(filterKey);
    const overrides = {
      new_pending:       { status: 'HOLD' },
      total_pending:     { status: 'HOLD' },
      urgent_pending:    { status: 'HOLD', urgent: true },
      approved_today:    { status: 'APPROVED' },
      rejected_today:    { status: 'REJECTED' },
      acknowledged_today:{ status: 'ACKNOWLEDGED' },
    };
    setFilters(f => ({ ...DEFAULT_FILTERS(activeRole), ...(overrides[filterKey] || {}) }));
  }

  const filteredRows = rows.filter(r => passesFilters(r, filters, activeRole));
  const suppliers = [...new Set(rows.map(r => r.supplier).filter(Boolean))].sort();
  const ddManagers = [...new Set(rows.map(r => r.dd_manager_name).filter(Boolean))].sort();

  function onActionSaved() {
    setLogDelayPo(null);
    setGeneralUpdatePo(null);
    setDecisionState(null);
    setInternalNotePo(null);
    loadData();
  }

  const allRoles = ['main_office', 'dd_team_manager', 'dd_team_employee'];

  return (
    <div className="h-screen flex flex-col bg-[#F8F8F8] overflow-hidden">

      {/* Fixed header — never scrolls */}
      <div className="flex-shrink-0 bg-[#F8F8F8] px-7 pt-6 pb-0 z-40">

        {/* Title + buttons */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#0A0A0A] leading-tight">Follow Up</h1>
            <div className="text-[13px] text-[#525252] mt-0.5">
              Working as <strong>{ROLE_DISPLAY[activeRole] || activeRole}</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative z-50">
              <button
                onClick={() => setShowRoleDropdown(o => !o)}
                className="h-8 pl-3 pr-2.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors"
              >
                <span>{ROLE_DISPLAY[activeRole]}</span>
                <ChevronDown size={12} />
              </button>
              {showRoleDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.08)] z-50 min-w-[180px] overflow-hidden">
                  {allRoles.map(r => (
                    <button
                      key={r}
                      onClick={() => { setActiveRole(r); setShowRoleDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${activeRole === r ? 'bg-[#FFF0F7] text-[#E31B7F] font-semibold' : 'text-[#0A0A0A] hover:bg-[#F8F8F8]'}`}
                    >
                      {ROLE_DISPLAY[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="h-8 px-3.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <KpiCards
          role={activeRole}
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterClick={handleKpiFilterClick}
          scrolled={scrolled}
        />

        {/* Stats Row — hidden when scrolled */}
        {!scrolled && activeRole === 'main_office' && rows.length > 0 && (
          <StatsRow rows={rows} />
        )}

        {/* Filter Toolbar — always in fixed header */}
        <FilterToolbar
          role={activeRole}
          filters={filters}
          onChange={setFilters}
          onReset={() => { setFilters(DEFAULT_FILTERS(activeRole)); setActiveKpiFilter(null); }}
          suppliers={suppliers}
          ddManagers={ddManagers}
        />
      </div>

      {/* Scrollable area — table only */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-7 pb-6">
        <FollowUpTable
          rows={filteredRows}
          role={activeRole}
          loading={loading}
          onDecide={(po, decision) => setDecisionState({ po, decision })}
          onLogDelay={po => setLogDelayPo(po)}
          onGeneralUpdate={po => setGeneralUpdatePo(po)}
          onViewLogs={po => setLogsDrawerPo(po)}
          onInternalNote={po => setInternalNotePo(po)}
        />
      </div>

      {/* Modals */}
      {logDelayPo && (
        <LogDelayModal
          po={logDelayPo}
          onClose={() => setLogDelayPo(null)}
          onSaved={onActionSaved}
          currentUser={user}
        />
      )}
      {generalUpdatePo && (
        <GeneralUpdateModal
          po={generalUpdatePo}
          onClose={() => setGeneralUpdatePo(null)}
          onSaved={onActionSaved}
        />
      )}
      {decisionState && (
        <DecisionModal
          po={decisionState.po}
          decision={decisionState.decision}
          onClose={() => setDecisionState(null)}
          onSaved={onActionSaved}
        />
      )}
      {internalNotePo && (
        <InternalNoteModal
          po={internalNotePo}
          onClose={() => setInternalNotePo(null)}
          onSaved={onActionSaved}
        />
      )}
      {logsDrawerPo && (
        <ActivityLogDrawer
          po={logsDrawerPo}
          userRole={activeRole}
          onClose={() => setLogsDrawerPo(null)}
        />
      )}

      {showRoleDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowRoleDropdown(false)} />}
    </div>
  );
}