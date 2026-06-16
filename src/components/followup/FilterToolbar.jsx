import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DD_STATUS_OPTIONS, SIZE_ORDER } from '@/lib/followUpConstants';
import MultiSelect from '@/components/followup/filters/MultiSelect';
import RangeSlider from '@/components/followup/filters/RangeSlider';
import DateRangePicker from '@/components/followup/filters/DateRangePicker';
import ToggleSwitch from '@/components/followup/filters/ToggleSwitch';

function FilterField({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <label className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] pl-0.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-8 px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors w-full";
const selectCls = "h-8 pl-2.5 pr-7 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white appearance-none cursor-pointer focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors w-full";

const PRIORITY_DEST_OPTIONS = [
  { value: 'BEST_SELLER', label: 'Best Seller' },
  { value: 'URGENT',      label: 'Urgent' },
  { value: 'NORMAL',      label: 'Normal' },
];

const CHIP_FORMATTERS = {
  po:                v => `PO: ${v}`,
  style:             v => `Style: ${v}`,
  status:            v => ({ HOLD: 'DDD: Pending', HANDLED: 'DDD: Handled', APPROVED: 'DDD: Approved', REJECTED: 'DDD: Rejected', ACKNOWLEDGED: 'DDD: Acknowledged', ACK_APPROVED: 'DDD: Acknowledged', AUTOMATICALLY: 'DDD: Auto' }[v] || `DDD: ${v}`),
  urgencyReason:     v => `Urgent Priority: ${v.length}`,
  priorityUS:        v => `US Priority: ${v.length}`,
  priorityUK:        v => `UK Priority: ${v.length}`,
  supplier:          v => `Supplier: ${v.length}`,
  ddManager:         v => Array.isArray(v) ? `Mgr: ${v.length}` : `Mgr: ${v}`,
  ddStatus:          v => `Production: ${v.length}`,
  urgent:            _ => 'Urgent only',
  archive:           _ => 'Archive',
  collection:        v => `Collection: ${v.length}`,
  orderType:         v => `Type: ${v.join(', ')}`,
  nextUpdateFrom:    v => `Next Upd ≥ ${v}`,
  nextUpdateTo:      v => `Next Upd ≤ ${v}`,
  delayResponse:     v => `Delay: ${v.length > 20 ? v.slice(0, 20) + '…' : v}`,
  deliveryStatus:    v => `Delivery: ${v.length}`,
  supplierRegion:    v => ({ US: 'Region: US', CHINA: 'Region: China', ALL: 'Region: All' }[v] || `Region: ${v}`),
  dropDateFrom:      v => `Drop ≥ ${v}`,
  dropDateTo:        v => `Drop ≤ ${v}`,
  finalDdFrom:       v => `Final DD ≥ ${v}`,
  finalDdTo:         v => `Final DD ≤ ${v}`,
  delayDaysMin:      v => `Delay ≥ ${v}d`,
  delayDaysMax:      v => `Delay ≤ ${v}d`,
  shippedPctMin:     v => `Shipped ≥ ${v}%`,
  shippedPctMax:     v => `Shipped ≤ ${v}%`,
  indMin:            v => `IND ≥ ${v}d`,
  indMax:            v => `IND ≤ ${v}d`,
  missingSizes:      v => `Missing: ${v.join(', ')}`,
  shippingMethod:    v => `Shipping: ${v.length}`,
  lastUrgentComment: v => `Comment: ${v.length > 20 ? v.slice(0, 20) + '…' : v}`,
  pmTags:            v => `PM Tags: ${v.length}`,
};

function isFilterActive(val, def) {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'boolean') return val === true;
  if (val === '' || val === null || val === undefined) return false;
  return val !== def;
}

function ActiveChips({ filters, defaultFilters, onChange }) {
  const chips = [];
  for (const [key, fmt] of Object.entries(CHIP_FORMATTERS)) {
    const val = filters[key];
    if (!isFilterActive(val, defaultFilters[key])) continue;
    chips.push({ key, label: fmt(val) });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#E5E5E5] mt-2">
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={() => onChange({ ...filters, [chip.key]: defaultFilters[chip.key] })}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0F7] text-[#E31B7F] border border-[#FFE5F2] hover:bg-[#FFE0EF] transition-colors"
        >
          {chip.label}
          <X size={9} />
        </button>
      ))}
    </div>
  );
}

export default function FilterToolbar({
  role, filters, onChange, onReset,
  suppliers, ddManagers, collections = [], orderTypes = [],
  shippingMethodOptions = [],
  urgencyReasonOptions = [],
  pmTagsOptions = [],
  mainOfficeViewMode,
  advancedOpen, onAdvancedToggle,
}) {
  const setAdvancedOpen = onAdvancedToggle || (() => {});
  const defaultFilters = {
    po: '', style: '',
    status: 'ALL',
    urgencyReason: [], priorityUS: [], priorityUK: [],
    supplier: [], ddManager: [], ddStatus: [],
    archive: false, collection: [], orderType: [],
    nextUpdateFrom: '', nextUpdateTo: '',
    delayResponse: '', deliveryStatus: [],
    supplierRegion: 'CHINA',
    dropDateFrom: '', dropDateTo: '',
    finalDdFrom: '', finalDdTo: '',
    delayDaysMin: '', delayDaysMax: '',
    shippedPctMin: '', shippedPctMax: '',
    indMin: '', indMax: '',
    missingSizes: [], shippingMethod: [],
    lastUrgentComment: '',
    pmTags: [],
  };

  const set = (key, val) => onChange({ ...filters, [key]: val });
  const setRange = (fromKey, toKey, { min: lo, max: hi }) =>
    onChange({ ...filters, [fromKey]: lo === '' ? '' : String(lo), [toKey]: hi === '' ? '' : String(hi) });

  const orderTypeOptions = orderTypes.length > 0 ? orderTypes : ['New', 'Rep'];
  const isNewScope = mainOfficeViewMode === 'New' ||
    (Array.isArray(filters.orderType) && filters.orderType.length === 1 && filters.orderType[0] === 'New');
  const isRepScope = mainOfficeViewMode === 'Rep' ||
    (Array.isArray(filters.orderType) && filters.orderType.length === 1 && filters.orderType[0] === 'Rep');

  const ddManagerValue = Array.isArray(filters.ddManager)
    ? filters.ddManager
    : (filters.ddManager ? [filters.ddManager] : []);

  // Production stage options + Empty status sentinel
  const productionStageOptions = [
    { value: 'EMPTY', label: 'Empty status' },
    ...DD_STATUS_OPTIONS.filter(s => s !== 'Empty status').map(s => ({ value: s, label: s })),
  ];

  // ── DD Team Employee + DD Team Manager: simplified inline strip ──
  // Exactly 8 filters: PO, Supplier, Style Color, DD Manager, Next Update (range),
  // Production Stage, Supplier Region (default China), Collection.
  if (role === 'dd_team_employee' || role === 'dd_team_manager') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 grid gap-2 items-end shadow-[0_1px_3px_rgba(0,0,0,.04)]"
           style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))' }}>
        <FilterField label="PO Number">
          <input className={inputCls} placeholder="Search…" value={filters.po} onChange={e => set('po', e.target.value)} />
        </FilterField>
        <FilterField label="Supplier">
          <MultiSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} placeholder="All suppliers" />
        </FilterField>
        <FilterField label="Style Color">
          <input className={inputCls} placeholder="Search…" value={filters.style} onChange={e => set('style', e.target.value)} />
        </FilterField>
        <FilterField label="DD Manager">
          <MultiSelect value={ddManagerValue} onChange={v => set('ddManager', v)} options={ddManagers} placeholder="All managers" />
        </FilterField>
        <FilterField label="Next Update">
          <DateRangePicker fromVal={filters.nextUpdateFrom} toVal={filters.nextUpdateTo} onChange={({ from, to }) => onChange({ ...filters, nextUpdateFrom: from, nextUpdateTo: to })} />
        </FilterField>
        <FilterField label="Production Stage">
          <MultiSelect value={filters.ddStatus} onChange={v => set('ddStatus', v)} options={productionStageOptions} placeholder="All stages" />
        </FilterField>
        <FilterField label="Supplier Region">
          <select className={selectCls} value={filters.supplierRegion || 'CHINA'} onChange={e => set('supplierRegion', e.target.value)}>
            <option value="CHINA">China</option>
            <option value="US">US</option>
            <option value="ALL">All</option>
          </select>
        </FilterField>
        <FilterField label="Order Status">
          <select className={selectCls} value={filters.orderState || 'OPEN'} onChange={e => set('orderState', e.target.value)}>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ALL">All</option>
          </select>
        </FilterField>
        <FilterField label="Collection">
          <MultiSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} placeholder="All collections" />
        </FilterField>
        <FilterField label="PM Tags">
          <MultiSelect value={filters.pmTags} onChange={v => set('pmTags', v)} options={pmTagsOptions} placeholder="All tags" />
        </FilterField>
        <button onClick={onReset} className="h-8 px-3 text-xs font-semibold text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-[6px] flex items-center gap-1.5 transition-colors self-end justify-center">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    );
  }

  // ── Main office / DD team manager ──
  return (
    <>
      {/* PRIMARY BAR — 4 main filters + region + advanced toggle + reset */}
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: 'repeat(4, minmax(140px,1fr)) minmax(130px,160px) minmax(120px,150px) auto auto' }}>
          <FilterField label="PO Number">
            <input className={inputCls} placeholder="Search…" value={filters.po} onChange={e => set('po', e.target.value)} />
          </FilterField>
          <FilterField label="Status">
            <select className={selectCls} value={filters.status} onChange={e => set('status', e.target.value)}>
              <option value="ALL">All</option>
              <option value="HOLD">Pending</option>
              <option value="HANDLED">Handled</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="AUTOMATICALLY">Auto-approved</option>
            </select>
          </FilterField>
          <FilterField label="Style Color">
            <input className={inputCls} placeholder="Search…" value={filters.style} onChange={e => set('style', e.target.value)} />
          </FilterField>
          <FilterField label="Urgent Priority">
            <MultiSelect
              value={filters.urgencyReason}
              onChange={v => set('urgencyReason', v)}
              options={urgencyReasonOptions}
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Supplier Region">
            <select className={selectCls} value={filters.supplierRegion || 'CHINA'} onChange={e => set('supplierRegion', e.target.value)}>
              <option value="CHINA">China</option>
              <option value="US">US</option>
              <option value="ALL">All</option>
            </select>
          </FilterField>
          <FilterField label="Order Status">
            <select className={selectCls} value={filters.orderState || 'OPEN'} onChange={e => set('orderState', e.target.value)}>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="ALL">All</option>
            </select>
          </FilterField>
          <button
            onClick={() => setAdvancedOpen(o => !o)}
            className={`h-8 px-3.5 rounded-[6px] text-xs font-semibold whitespace-nowrap transition-all ${advancedOpen ? 'bg-[#FFF0F7] text-[#E31B7F] border border-[#E31B7F]' : 'border border-dashed border-[#D4D4D4] text-[#525252] hover:border-[#E31B7F] hover:text-[#E31B7F] hover:bg-[#FFF0F7]'}`}
          >
            {advancedOpen ? '− Hide' : '+ Advanced'}
          </button>
          <button onClick={onReset} className="h-8 px-3 text-xs font-semibold text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-[6px] flex items-center gap-1.5 transition-colors">
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {advancedOpen && (
        <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))' }}>
            {/* ── CATEGORIES (row 1) ── */}
            <FilterField label="DD Manager">
              <MultiSelect value={ddManagerValue} onChange={v => set('ddManager', v)} options={ddManagers} placeholder="All managers" />
            </FilterField>
            <FilterField label="Supplier">
              <MultiSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} placeholder="All suppliers" />
            </FilterField>
            <FilterField label="Production Stage">
              <MultiSelect value={filters.ddStatus} onChange={v => set('ddStatus', v)} options={productionStageOptions} placeholder="All stages" />
            </FilterField>
            <FilterField label="Order Type">
              <MultiSelect value={filters.orderType} onChange={v => set('orderType', v)} options={orderTypeOptions} placeholder="All types" />
            </FilterField>
            <FilterField label="Collection">
              <MultiSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} placeholder="All collections" />
            </FilterField>
            <FilterField label="US Priority">
              <MultiSelect value={filters.priorityUS || []} onChange={v => set('priorityUS', v)} options={PRIORITY_DEST_OPTIONS} placeholder="All" />
            </FilterField>
            <FilterField label="UK Priority">
              <MultiSelect value={filters.priorityUK || []} onChange={v => set('priorityUK', v)} options={PRIORITY_DEST_OPTIONS} placeholder="All" />
            </FilterField>
            <FilterField label="Delay Response">
              <input className={inputCls} placeholder="Search…" value={filters.delayResponse} onChange={e => set('delayResponse', e.target.value)} />
            </FilterField>

            {/* REP-ONLY CATEGORY FILTERS */}
            {isRepScope && (
              <>
                <FilterField label="Missing Sizes">
                  <MultiSelect
                    value={filters.missingSizes}
                    onChange={v => set('missingSizes', v)}
                    options={SIZE_ORDER.map(s => ({ value: s, label: s }))}
                    placeholder="All sizes"
                  />
                </FilterField>
                <FilterField label="Shipping Method">
                  <MultiSelect
                    value={filters.shippingMethod}
                    onChange={v => set('shippingMethod', v)}
                    options={shippingMethodOptions}
                    placeholder="All methods"
                  />
                </FilterField>
                <FilterField label="Last Urgent Comment">
                  <input
                    className={inputCls}
                    placeholder="Search comment…"
                    value={filters.lastUrgentComment || ''}
                    onChange={e => set('lastUrgentComment', e.target.value)}
                  />
                </FilterField>
              </>
            )}

            {/* ── RANGES (row 2 — date + numeric) ── */}
            <FilterField label="Final DD">
              <DateRangePicker fromVal={filters.finalDdFrom} toVal={filters.finalDdTo}
                onChange={({ from, to }) => onChange({ ...filters, finalDdFrom: from, finalDdTo: to })} />
            </FilterField>
            {isNewScope && (
              <FilterField label="Drop Date">
                <DateRangePicker fromVal={filters.dropDateFrom} toVal={filters.dropDateTo}
                  onChange={({ from, to }) => onChange({ ...filters, dropDateFrom: from, dropDateTo: to })} />
              </FilterField>
            )}
            <FilterField label="Next Update">
              <DateRangePicker fromVal={filters.nextUpdateFrom} toVal={filters.nextUpdateTo}
                onChange={({ from, to }) => onChange({ ...filters, nextUpdateFrom: from, nextUpdateTo: to })} />
            </FilterField>
            <FilterField label="Delay Request (days)">
              <RangeSlider min={0} max={120} valueMin={filters.delayDaysMin} valueMax={filters.delayDaysMax}
                onChange={r => setRange('delayDaysMin', 'delayDaysMax', r)} suffix="d" />
            </FilterField>
            {isNewScope && (
              <FilterField label="Shipped %">
                <RangeSlider min={0} max={100} valueMin={filters.shippedPctMin} valueMax={filters.shippedPctMax}
                  onChange={r => setRange('shippedPctMin', 'shippedPctMax', r)} suffix="%" />
              </FilterField>
            )}
          </div>

          {/* TOGGLES STRIP — manager-only (urgent toggle removed) */}
          {role === 'dd_team_manager' && (
            <div className="flex flex-wrap items-center gap-5 pt-3 mt-3 border-t border-[#E5E5E5]">
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em]">Toggles</span>
              <ToggleSwitch label="Archive" checked={filters.archive} onChange={v => set('archive', v)} />
            </div>
          )}

          <ActiveChips filters={filters} defaultFilters={defaultFilters} onChange={onChange} />
        </div>
      )}
    </>
  );
}