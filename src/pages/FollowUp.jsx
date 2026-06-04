import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronDown, Download, LogOut, User as UserIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ROLE_DISPLAY,
  NOT_STARTED_DD_STATUSES,
  FABRIC_PPS_RISK_STATUSES,
  REWORK_REPRO_STATUSES,
  QC_STATUSES,
  isUsSupplier,
  isPreviousCollection,
} from '@/lib/followUpConstants';
import KpiCards from '@/components/followup/KpiCards';
import FilterToolbar from '@/components/followup/FilterToolbar';
import FollowUpTable from '@/components/followup/FollowUpTable';
import LogDelayModal from '@/components/followup/LogDelayModal';
import GeneralUpdateModal from '@/components/followup/GeneralUpdateModal';
import DecisionModal from '@/components/followup/DecisionModal';
import InternalNoteModal from '@/components/followup/InternalNoteModal';
import ActivityLogDrawer from '@/components/followup/ActivityLogDrawer';
import PoDetailsDrawer from '@/components/followup/PoDetailsDrawer';
import BulkActionBar from '@/components/followup/BulkActionBar';
import OperationalKpisStrip from '@/components/followup/OperationalKpisStrip';
import MainOfficeKpiGrid from '@/components/followup/MainOfficeKpiGrid';
import InsightsStrip from '@/components/followup/InsightsStrip';

const ALL_ROLES = ['main_office', 'dd_team_manager', 'dd_team_employee'];

// Filters are arrays where multi-select makes sense. Empty array = no filter.
// Single-value filters: status (radio), supplierRegion, free-text inputs, toggles, date ranges.
const DEFAULT_FILTERS = (role) => ({
  po: '',
  style: '',
  status: 'ALL',
  urgencyReason: [],  // raw urgency_reason values from po_urgent_status (e.g. "Best Seller New", "US-SIZES INV DAYS")
  priorityUS: [],     // BEST_SELLER / URGENT / NORMAL — per US destination
  priorityUK: [],     // BEST_SELLER / URGENT / NORMAL — per UK destination
  supplier: [],
  ddManager: [],      // multi-select
  ddStatus: [],
  archive: false,
  collection: [],
  orderType: [],
  nextUpdateFrom: '',
  nextUpdateTo: '',
  delayResponse: '',
  deliveryStatus: [],
  supplierRegion: 'CHINA', // CHINA | US | ALL — default to China
  // Date ranges
  dropDateFrom: '',
  dropDateTo: '',
  finalDdFrom: '',
  finalDdTo: '',
  // Numeric ranges
  delayDaysMin: '',
  delayDaysMax: '',
  shippedPctMin: '',
  shippedPctMax: '',
  indMin: '',
  indMax: '',
  // Rep-view filters
  missingSizes: [],   // array of size codes (XS / S / M / L / XL / XXL)
  shippingMethod: [], // array of shipping method NAMES (text from shipment_methods table)
  lastUrgentComment: '',
  // Virtual filters driven by KPIs
  staleStatus: false,
  late7Plus: false,
  bestSeller: false,
  highBno: false,
  dropRisk: false,
});

function isCurrentCollectionRow(r) {
  if (!r.collection) return false;
  const now = new Date();
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(2);
  const c = r.collection.toLowerCase();
  return (
    c.includes(`${yyyy}-${mm}`) ||
    c.includes(`${mm}-${yyyy}`) ||
    c.includes(`${mm}/${yy}`) ||
    c.includes(`${mm}-${yy}`) ||
    c.includes(monthShort)
  );
}

// Helper: is array filter active?
const has = (arr) => Array.isArray(arr) && arr.length > 0;

// Normalize a raw urgency_reason string into a set of canonical categories:
// - Splits on comma/semicolon/pipe (e.g. "UK-O Order,US-O Order" → ["O Order"])
// - Strips US-/UK- destination prefixes so US & UK variants collapse to one category
// - Returns a Set of normalized tokens
function normalizeUrgencyReasons(raw) {
  if (!raw) return new Set();
  const parts = String(raw).split(/[,;|]+/);
  const out = new Set();
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const stripped = t.replace(/^(US|UK)\s*[-–:]\s*/i, '').trim();
    if (stripped) out.add(stripped);
  }
  return out;
}

// Helper: does row match urgency-reason token? Matches if ANY of the row's
// normalized urgency categories equals the selected token.
function matchUrgencyReason(row, p) {
  const raw = row.urgency_reason_raw || row.priority || '';
  const cats = normalizeUrgencyReasons(raw);
  return cats.has(p);
}

// Helper: does row match a collection token (CURRENT, CURRENT_AT_RISK, PREVIOUS, or literal)?
function matchCollection(row, token) {
  if (token === 'CURRENT') return isCurrentCollectionRow(row);
  if (token === 'CURRENT_AT_RISK') {
    if (!isCurrentCollectionRow(row)) return false;
    if (!row.final_dd) return false;
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cutoff = new Date(eom); cutoff.setDate(eom.getDate() - 5);
    return new Date(row.final_dd) > cutoff;
  }
  if (token === 'PREVIOUS') return isPreviousCollection(row.collection);
  return row.collection?.toLowerCase().includes(token.toLowerCase());
}

// Helper: does row match a ddStatus token (EMPTY, NOT_STARTED, FABRIC_PPS_RISK, REWORK_REPRO, QC_OVER_3D, or literal)?
function matchDdStatus(row, token) {
  if (token === 'EMPTY' || token === 'Empty status') {
    return !row.effective_dd_status || row.effective_dd_status === 'Empty status';
  }
  if (token === 'NOT_STARTED') {
    return NOT_STARTED_DD_STATUSES.includes(row.effective_dd_status || 'Empty status');
  }
  if (token === 'FABRIC_PPS_RISK') return FABRIC_PPS_RISK_STATUSES.includes(row.effective_dd_status);
  if (token === 'REWORK_REPRO')    return REWORK_REPRO_STATUSES.includes(row.effective_dd_status);
  if (token === 'QC_OVER_3D')      return QC_STATUSES.includes(row.effective_dd_status) && (row.days_same_status ?? 0) > 3;
  return row.effective_dd_status === token;
}

// Helper: does row match an order type token (New/Rep substring or literal)?
function matchOrderType(row, token) {
  const t = (row.po_type || '').toLowerCase();
  if (token === 'New') return t.includes('new');
  if (token === 'Rep') return t.includes('rep');
  return row.po_type === token;
}

function passesFilters(row, filters, role) {
  const {
    po, style, status, urgencyReason, supplier, ddManager, ddStatus,
    archive, collection, orderType,
    nextUpdateFrom, nextUpdateTo,
    delayResponse, deliveryStatus,
    dropDateFrom, dropDateTo, finalDdFrom, finalDdTo,
    delayDaysMin, delayDaysMax,
    shippedPctMin, shippedPctMax,
    indMin, indMax,
  } = filters;

  if (po && !row.po_number?.toLowerCase().includes(po.toLowerCase())) return false;
  if (style && !row.style_color?.toLowerCase().includes(style.toLowerCase())) return false;
  if (has(supplier) && !supplier.includes(row.supplier)) return false;
  // ddManager is now multi-select (array). Legacy single string still supported.
  if (Array.isArray(ddManager)) {
    if (ddManager.length > 0 && !ddManager.includes(row.dd_manager_name)) return false;
  } else if (ddManager && row.dd_manager_name !== ddManager) return false;
  if (has(collection) && !collection.some(c => matchCollection(row, c))) return false;
  if (has(orderType) && !orderType.some(t => matchOrderType(row, t))) return false;

  // Supplier region (default CHINA)
  if (filters.supplierRegion && filters.supplierRegion !== 'ALL') {
    const isUs = isUsSupplier(row.supplier);
    if (filters.supplierRegion === 'US' && !isUs) return false;
    if (filters.supplierRegion === 'CHINA' && isUs) return false;
  }

  if (filters.staleStatus && !((row.days_same_status ?? 0) > 5)) return false;
  if (filters.late7Plus && !((row.days_late_counting ?? 0) > 7)) return false;
  if (filters.bestSeller && !row.is_best_seller) return false;
  if (filters.highBno && !row.bno_high_low_otw) return false;

  if (has(ddStatus) && !ddStatus.some(s => matchDdStatus(row, s))) return false;

  if (filters.dropRisk) {
    if (!row.final_dd || !row.drop) return false;
    const diff = (new Date(row.drop) - new Date(row.final_dd)) / 86400000;
    if (!(diff >= 0 && diff < 7)) return false;
  }

  if (nextUpdateFrom && (!row.effective_next_update || row.effective_next_update.slice(0, 10) < nextUpdateFrom)) return false;
  if (nextUpdateTo   && (!row.effective_next_update || row.effective_next_update.slice(0, 10) > nextUpdateTo))   return false;
  if (delayResponse && !row.delay_response_comment?.toLowerCase().includes(delayResponse.toLowerCase())) return false;
  if (has(deliveryStatus) && !deliveryStatus.some(s => row.delivery_date_status?.toLowerCase().startsWith(s.toLowerCase()))) return false;

  // late_future filter (LATE / FUTURE / RECEIVED) — used by KPI presets
  if (has(filters.lateFuture) && !filters.lateFuture.includes(row.late_future)) return false;
  if (filters.bnoHighLowOtw && !row.bno_high_low_otw) return false;
  if (filters.sameStatusOver5d && !((row.days_same_status ?? 0) > 5)) return false;

  // Urgency Reason — text equality on raw value (or computed priority fallback)
  if (has(urgencyReason) && !urgencyReason.some(p => matchUrgencyReason(row, p))) return false;

  // Date ranges
  if (dropDateFrom && (!row.drop || row.drop.slice(0, 10) < dropDateFrom)) return false;
  if (dropDateTo   && (!row.drop || row.drop.slice(0, 10) > dropDateTo))   return false;
  if (finalDdFrom  && (!row.final_dd || row.final_dd.slice(0, 10) < finalDdFrom)) return false;
  if (finalDdTo    && (!row.final_dd || row.final_dd.slice(0, 10) > finalDdTo))   return false;

  // Numeric ranges (treat 0 as a meaningful low bound — only skip when empty string)
  if (delayDaysMin !== '' && delayDaysMin != null && (row.days_late_counting ?? 0) < Number(delayDaysMin)) return false;
  if (delayDaysMax !== '' && delayDaysMax != null && (row.days_late_counting ?? 0) > Number(delayDaysMax)) return false;
  if (shippedPctMin !== '' && shippedPctMin != null && (row.shipped_percent ?? 0) < Number(shippedPctMin)) return false;
  if (shippedPctMax !== '' && shippedPctMax != null && (row.shipped_percent ?? 0) > Number(shippedPctMax)) return false;
  if (indMin !== '' && indMin != null) {
    if (row.inv_days == null) return false;
    if (Number(row.inv_days) < Number(indMin)) return false;
  }
  if (indMax !== '' && indMax != null) {
    if (row.inv_days == null) return false;
    if (Number(row.inv_days) > Number(indMax)) return false;
  }

  // Rep-view: Missing sizes — match if any selected size is in the row's missing list
  if (has(filters.missingSizes)) {
    const ms = (row.missing_sizes || []).map(s => String(s).toUpperCase());
    if (!filters.missingSizes.some(s => ms.includes(String(s).toUpperCase()))) return false;
  }
  // Shipping method — by NAME (text from shipment_methods table)
  if (has(filters.shippingMethod)) {
    const names = row.shipping_method_names || [];
    if (!filters.shippingMethod.some(m => names.includes(m))) return false;
  }

  // Last Urgent Comment
  if (filters.lastUrgentComment) {
    const log = row.dd_comment_log || [];
    const latest = log[0]?.text || '';
    if (!latest.toLowerCase().includes(filters.lastUrgentComment.toLowerCase())) return false;
  }

  // Priority by destination — uses dest-specific tag from backend (us_priority / uk_priority)
  if (has(filters.priorityUS)) {
    if (!row.us_priority) return false;
    if (!filters.priorityUS.includes(row.us_priority)) return false;
  }
  if (has(filters.priorityUK)) {
    if (!row.uk_priority) return false;
    if (!filters.priorityUK.includes(row.uk_priority)) return false;
  }

  // Archive toggle: POs that never entered the HOLD workflow (no delay request logged)
  if (archive) return !row.current_status;

  if (status === 'HOLD') { if (row.current_status !== 'HOLD') return false; }
  else if (status === 'HANDLED') { if (!['APPROVED', 'REJECTED', 'ACKNOWLEDGED'].includes(row.current_status)) return false; }
  else if (status === 'ACK_APPROVED') { if (!['APPROVED', 'ACKNOWLEDGED'].includes(row.current_status)) return false; }
  else if (status === 'ALL') { /* show all */ }
  else if (['APPROVED', 'REJECTED', 'ACKNOWLEDGED', 'AUTOMATICALLY'].includes(status) && row.current_status !== status) return false;

  return true;
}

function exportRowsToCSV(exportRows, filename = 'follow-up.csv') {
  const cols = [
    ['po_number', 'PO Number'], ['style_color', 'Style Color'], ['supplier', 'Supplier'],
    ['dd_manager_name', 'DD Manager'], ['current_status', 'Status'], ['priority', 'Priority'],
    ['due_date', 'Due Date'], ['effective_delayed_due_date', 'Delayed DD'], ['final_dd', 'Final DD'],
    ['days_late_counting', 'Days Late'], ['ddd_reason', 'DD Reason'], ['ddd_comment', 'DDD Comment'],
    ['effective_dd_status', 'DD Status'], ['delivery_date_status', 'Delivery Date Status'],
    ['delay_response_comment', 'Response'], ['collection', 'Collection'],
    ['effective_next_update', 'Next Update'], ['ddd_count', 'DDD Count'],
  ];
  const header = cols.map(([, l]) => `"${l}"`).join(',');
  const body = exportRows.map(r => cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FollowUp() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Roles available to this user: admin sees all, others see their assigned roles.
  // Falls back to legacy single `role` value if `roles` array isn't set yet.
  const availableRoles = ALL_ROLES;
  const [activeRole, setActiveRole] = useState(() => {
    if (isAdmin) return 'main_office';
    if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles[0];
    if (ALL_ROLES.includes(user?.role)) return user.role;
    return 'main_office';
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Keep activeRole in sync when availableRoles changes (only when truly invalid)
  useEffect(() => {
    if (availableRoles.length > 0 && !availableRoles.includes(activeRole)) {
      setActiveRole(availableRoles[0]);
    }
  }, [availableRoles, activeRole]);

  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS(activeRole));
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);
  const [activeOpKpi, setActiveOpKpi] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mainOfficeViewMode, setMainOfficeViewMode] = useState('New'); // 'New' | 'Rep'

  function handleMainOfficeViewModeChange(mode) {
    setMainOfficeViewMode(mode);
    setActiveOpKpi(null);
    setActiveKpiFilter(null);
    // Auto-apply order type filter so the table reflects the active view
    setFilters(prev => ({ ...DEFAULT_FILTERS(activeRole), orderType: [mode] }));
  }

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [logDelayPo, setLogDelayPo] = useState(null);
  const [generalUpdatePo, setGeneralUpdatePo] = useState(null);
  const [decisionState, setDecisionState] = useState(null);
  const [internalNotePo, setInternalNotePo] = useState(null);
  const [logsDrawerPo, setLogsDrawerPo] = useState(null);
  const [bulkLogDelayPOs, setBulkLogDelayPOs] = useState(null);
  const [bulkGeneralUpdatePOs, setBulkGeneralUpdatePOs] = useState(null);
  const [detailsPo, setDetailsPo] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await base44.functions.invoke('getFollowUpData', {});
    if (res.data?.rows) {
      const seen = new Set();
      const uniqueRows = res.data.rows.filter(r => {
        if (seen.has(r.po_number)) return false;
        seen.add(r.po_number);
        return true;
      });
      setRows(uniqueRows);
      setKpis(res.data.kpis || {});
    }
    setLoading(false);
  }, [activeRole]);

  useEffect(() => { loadData(); }, [loadData]);

  // When switching to DD employee role, pre-fill the DD Manager filter with the current user's name
  useEffect(() => {
    const base = DEFAULT_FILTERS(activeRole);
    if (activeRole === 'dd_team_employee' && user?.full_name) {
      base.ddManager = [user.full_name];
    }
    if (activeRole === 'main_office') {
      base.orderType = [mainOfficeViewMode];
    }
    setFilters(base);
    setActiveKpiFilter(null);
    setSelectedRows(new Set());
  }, [activeRole, user?.full_name, mainOfficeViewMode]);

  function handleKpiFilterClick(filterKey) {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null);
      const base = DEFAULT_FILTERS(activeRole);
      if (activeRole === 'dd_team_employee' && user?.full_name) base.ddManager = [user.full_name];
      setFilters(base);
      return;
    }
    setActiveOpKpi(null);
    setActiveKpiFilter(filterKey);
    // For employee KPIs, always scope to logged-in user
    const empScope = activeRole === 'dd_team_employee' && user?.full_name
      ? { ddManager: [user.full_name] }
      : {};
    const todayIso = new Date().toISOString().slice(0, 10);
    const overrides = {
      new_pending:        { status: 'HOLD' },
      total_pending:      { status: 'HOLD' },
      urgent_pending:     { status: 'HOLD' },
      approved_today:     { status: 'APPROVED' },
      rejected_today:     { status: 'REJECTED' },
      acknowledged_today: { status: 'ACK_APPROVED' },
      not_updated:        { status: 'ALL', nextUpdateFrom: todayIso, nextUpdateTo: todayIso },
      emp_pending:        { status: 'HOLD' },
      emp_acknowledged:   { status: 'ACK_APPROVED' },
      emp_rejected:       { status: 'REJECTED' },
      emp_received_upd:   { status: 'ALL', deliveryStatus: ['Receiving Notice'] },
      mgr_received_upd:   { status: 'ALL', deliveryStatus: ['Receiving Notice'] },
    };
    setFilters({ ...DEFAULT_FILTERS(activeRole), ...empScope, ...(overrides[filterKey] || {}) });
  }

  function handleOpKpiClick(key, presetFilters) {
    if (activeOpKpi === key) {
      setActiveOpKpi(null);
      setFilters(DEFAULT_FILTERS(activeRole));
      return;
    }
    setActiveKpiFilter(null);
    setActiveOpKpi(key);
    setFilters({ ...DEFAULT_FILTERS(activeRole), ...(presetFilters || {}) });
  }

  function handleSelectRow(poNumber) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber); else next.add(poNumber);
      return next;
    });
  }

  function handleSelectAll(poNumbers) {
    const allSelected = poNumbers.length > 0 && poNumbers.every(p => selectedRows.has(p));
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allSelected) poNumbers.forEach(p => next.delete(p));
      else poNumbers.forEach(p => next.add(p));
      return next;
    });
  }

  function handleBulkDecision(decision) {
    const selectedPOs = filteredRows.filter(r => selectedRows.has(r.po_number));
    if (!selectedPOs.length) return;
    setDecisionState({ po: null, decision, posBulk: selectedPOs });
  }

  function onActionSaved() {
    setLogDelayPo(null);
    setGeneralUpdatePo(null);
    setDecisionState(null);
    setInternalNotePo(null);
    setBulkLogDelayPOs(null);
    setBulkGeneralUpdatePOs(null);
    setSelectedRows(new Set());
    loadData();
  }

  const filteredRows = useMemo(
    () => rows.filter(r => passesFilters(r, filters, activeRole)),
    [rows, filters, activeRole]
  );
  const { suppliers, ddManagers, collections, orderTypes, shippingMethodOptions, urgencyReasonOptions } = useMemo(() => {
    const sup = new Set(), mgr = new Set(), col = new Set(), types = new Set();
    const smSet = new Set();
    const urgMap = new Map(); // urgency_reason raw value -> count
    for (const r of rows) {
      if (r.supplier) sup.add(r.supplier);
      if (r.dd_manager_name) mgr.add(r.dd_manager_name);
      if (r.collection && (r.po_type || '').toLowerCase().includes('new')) col.add(r.collection);
      if (r.po_type) types.add(r.po_type);

      // Urgency reason — normalize to canonical categories (strip US-/UK- prefixes
      // and split on comma/semicolon/pipe), then count POs per category. A PO with
      // multiple categories increments each category once.
      const urgRaw = r.urgency_reason_raw || r.priority;
      if (urgRaw) {
        for (const cat of normalizeUrgencyReasons(urgRaw)) {
          urgMap.set(cat, (urgMap.get(cat) || 0) + 1);
        }
      }

      // Rep-view shipping method names
      const isRep = (r.po_type || '').toLowerCase().includes('rep');
      if (isRep) {
        for (const m of (r.shipping_method_names || [])) smSet.add(m);
      }
    }
    return {
      suppliers: [...sup].sort(),
      ddManagers: [...mgr].sort(),
      collections: [...col].sort(),
      orderTypes: [...types].sort(),
      shippingMethodOptions: [...smSet].sort(),
      urgencyReasonOptions: [...urgMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    };
  }, [rows]);

  // Augment server KPIs with client-computed values
  const displayKpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // "Not Updated": next_update_date = today but no dd_updates row created today
    // We approximate: effective_next_update = today AND dd_comment_log has no entry from today
    const notUpdated = rows.filter(r => {
      if (r.effective_next_update?.slice(0, 10) !== today) return false;
      const log = r.dd_comment_log || [];
      return !log.some(e => e.date?.slice(0, 10) === today);
    }).length;

    // DD Employee KPIs — scoped to the logged-in user's POs (not the filter state)
    const scopedRows = activeRole === 'dd_team_employee'
      ? rows.filter(r => !user?.full_name || r.dd_manager_name === user.full_name)
      : rows;

    const empPending      = scopedRows.filter(r => r.current_status === 'HOLD').length;
    const empAcknowledged = scopedRows.filter(r => ['APPROVED', 'ACKNOWLEDGED'].includes(r.current_status)).length;
    const empRejected     = scopedRows.filter(r => r.current_status === 'REJECTED').length;
    const empReceivedUpd  = scopedRows.filter(r =>
      r.delivery_date_status?.toLowerCase().startsWith('receiving notice')
    ).length;
    const mgrReceivedUpd  = rows.filter(r =>
      r.delivery_date_status?.toLowerCase().startsWith('receiving notice')
    ).length;

    return {
      ...kpis,
      not_updated:        notUpdated,
      emp_pending:        empPending,
      emp_acknowledged:   empAcknowledged,
      emp_rejected:       empRejected,
      emp_received_upd:   empReceivedUpd,
      mgr_received_upd:   mgrReceivedUpd,
    };
  }, [rows, kpis, activeRole, filters.ddManager]);
  const showRoleSwitcher = true;

  return (
    <div className="min-h-screen bg-[#F8F8F8]">

      {/* Mockup banner */}
      <div className="bg-[#FFF0F7] border-b border-[#FFCCDE] text-[#E31B7F] text-[12px] font-semibold text-center px-4 py-2 tracking-wide">
        ⚠️ This is a mockup — data and actions are for preview purposes only.
      </div>

      <div className="px-7 pt-6 pb-0">

        {/* Title + buttons */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#0A0A0A] leading-tight">Follow Up</h1>
            <div className="text-[13px] text-[#525252] mt-0.5">
              Working as <strong>{ROLE_DISPLAY[activeRole] || activeRole}</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showRoleSwitcher && (
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
                    {availableRoles.map(r => (
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
            )}
            <button
              onClick={() => exportRowsToCSV(filteredRows)}
              className="h-8 px-3.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] transition-colors"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="h-8 px-3.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {/* User menu */}
            <div className="relative z-50">
              <button
                onClick={() => setShowUserMenu(o => !o)}
                className="h-8 pl-2.5 pr-2.5 flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[8px] hover:border-[#E31B7F] hover:bg-[#FFF0F7] transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-[#FFE5F2] text-[#E31B7F] flex items-center justify-center text-[10px] font-bold">
                  {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user?.full_name || user?.email}</span>
                <ChevronDown size={12} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.08)] z-50 min-w-[220px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E5E5]">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#0A0A0A]">
                      <UserIcon size={12} /> {user?.full_name || '—'}
                    </div>
                    <div className="text-[11px] text-[#525252] mt-0.5 truncate">{user?.email}</div>
                    <div className="text-[10px] text-[#A3A3A3] mt-1 uppercase tracking-wide">{user?.role}</div>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#FFF0F7] hover:text-[#E31B7F] transition-colors flex items-center gap-2"
                  >
                    <LogOut size={12} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {activeRole === 'main_office' ? (
          <MainOfficeKpiGrid
            rows={rows}
            kpis={displayKpis}
            activeOpKpi={activeOpKpi}
            onOpKpiClick={handleOpKpiClick}
            viewMode={mainOfficeViewMode}
            onViewModeChange={handleMainOfficeViewModeChange}
            supplierRegion={filters.supplierRegion || 'CHINA'}
          />
        ) : (
          <KpiCards
            role={activeRole}
            kpis={displayKpis}
            rows={rows}
            activeFilter={activeKpiFilter}
            onFilterClick={handleKpiFilterClick}
          />
        )}

        {/* Zone 3 — Insights strip (main_office only) */}
        {activeRole === 'main_office' && rows.length > 0 && (
          <InsightsStrip rows={rows} />
        )}

        {/* Filter Toolbar */}
        <FilterToolbar
          role={activeRole}
          filters={filters}
          onChange={setFilters}
          onReset={() => {
            const base = DEFAULT_FILTERS(activeRole);
            if (activeRole === 'dd_team_employee' && user?.full_name) base.ddManager = [user.full_name];
            setFilters(base);
            setActiveKpiFilter(null);
            setActiveOpKpi(null);
          }}
          suppliers={suppliers}
          ddManagers={ddManagers}
          collections={collections}
          orderTypes={orderTypes}
          shippingMethodOptions={shippingMethodOptions}
          urgencyReasonOptions={urgencyReasonOptions}
          mainOfficeViewMode={mainOfficeViewMode}
          advancedOpen={advancedOpen}
          onAdvancedToggle={setAdvancedOpen}
        />
      </div>

      {/* Table area */}
      <div className="px-7 pb-6">
        <FollowUpTable
          rows={filteredRows}
          role={activeRole}
          loading={loading}
          filterStatus={filters.status}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onPoDetails={activeRole !== 'dd_team_employee' ? po => setDetailsPo(po) : undefined}
          onDecide={(po, decision) => setDecisionState({ po, decision })}
          onLogDelay={po => setLogDelayPo(po)}
          onGeneralUpdate={po => setGeneralUpdatePo(po)}
          onViewLogs={po => setLogsDrawerPo(po)}
          onInternalNote={po => setInternalNotePo(po)}
          isRepScopeTable={activeRole === 'main_office' && mainOfficeViewMode === 'Rep'}
        />
      </div>

      <BulkActionBar
        count={selectedRows.size}
        role={activeRole}
        onApproveAll={() => handleBulkDecision('APPROVED')}
        onAcknowledgeAll={() => handleBulkDecision('ACKNOWLEDGED')}
        onRejectAll={() => handleBulkDecision('REJECTED')}
        onBulkLogDelay={() => setBulkLogDelayPOs(filteredRows.filter(r => selectedRows.has(r.po_number)))}
        onBulkGeneralUpdate={() => setBulkGeneralUpdatePOs(filteredRows.filter(r => selectedRows.has(r.po_number)))}
        onExport={() => exportRowsToCSV(filteredRows.filter(r => selectedRows.has(r.po_number)), 'selected-pos.csv')}
        onClear={() => setSelectedRows(new Set())}
      />

      {logDelayPo && (
        <LogDelayModal
          po={logDelayPo}
          posBulk={null}
          onClose={() => setLogDelayPo(null)}
          onSaved={onActionSaved}
          currentUser={user}
        />
      )}
      {generalUpdatePo && (
        <GeneralUpdateModal
          po={generalUpdatePo}
          posBulk={null}
          onClose={() => setGeneralUpdatePo(null)}
          onSaved={onActionSaved}
        />
      )}
      {decisionState && (
        <DecisionModal
          po={decisionState.po}
          posBulk={decisionState.posBulk}
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
      {bulkLogDelayPOs && (
        <LogDelayModal
          po={null}
          posBulk={bulkLogDelayPOs}
          onClose={() => setBulkLogDelayPOs(null)}
          onSaved={onActionSaved}
          currentUser={user}
        />
      )}
      {bulkGeneralUpdatePOs && (
        <GeneralUpdateModal
          po={null}
          posBulk={bulkGeneralUpdatePOs}
          onClose={() => setBulkGeneralUpdatePOs(null)}
          onSaved={onActionSaved}
        />
      )}
      {detailsPo && (
        <PoDetailsDrawer
          po={detailsPo}
          onClose={() => setDetailsPo(null)}
        />
      )}

      {showRoleDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowRoleDropdown(false)} />}
      {showUserMenu && <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />}
    </div>
  );
}