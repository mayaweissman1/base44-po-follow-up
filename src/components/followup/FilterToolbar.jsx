import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DD_STATUS_OPTIONS, DD_REASONS_BY_GROUP } from '@/lib/followUpConstants';
import MultiSelect from '@/components/followup/filters/MultiSelect';

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
const toggleCls = (active) => `h-8 px-3 rounded-[6px] text-xs font-semibold border transition-colors ${active ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'border-[#D4D4D4] text-[#525252] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`;

// Reasons grouped for MultiSelect (flat list — group labels become disabled headers).
function reasonOptions() {
  const opts = [];
  for (const g of DD_REASONS_BY_GROUP) {
    for (const r of g.reasons) opts.push({ value: r, label: r });
  }
  return opts;
}

const PRIORITY_OPTIONS = [
  { value: 'URGENT',        label: 'URGENT' },
  { value: 'Deadline',      label: 'Deadline at risk' },
  { value: 'Normal',        label: 'Normal' },
  { value: 'MISSING_SIZES', label: 'Missing sizes' },
  { value: 'Drop',          label: 'Drop' },
];

const LATE_FUTURE_OPTIONS = [
  { value: 'LATE',   label: 'Late' },
  { value: 'FUTURE', label: 'Future' },
];

const PO_RANK_OPTIONS = ['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }));

// Format a chip label for active filters
const CHIP_FORMATTERS = {
  po:             v => `PO: ${v}`,
  style:          v => `Style: ${v}`,
  status:         v => ({ HOLD: 'DDD: Pending', HANDLED: 'DDD: Handled', APPROVED: 'DDD: Approved', REJECTED: 'DDD: Rejected', ACKNOWLEDGED: 'DDD: Acknowledged', ACK_APPROVED: 'DDD: Acknowledged', AUTOMATICALLY: 'DDD: Auto' }[v] || `DDD: ${v}`),
  priority:       v => `Priority: ${v.length}`,
  supplier:       v => `Supplier: ${v.length}`,
  ddManager:      v => `Mgr: ${v}`,
  ddStatus:       v => `Production: ${v.length}`,
  reason:         v => `Reason: ${v.length}`,
  urgent:         _ => 'Urgent only',
  archive:        _ => 'Archive',
  collection:     v => `Collection: ${v.length}`,
  orderType:      v => `Type: ${v.join(', ')}`,
  nextUpdate:     v => `Next Upd: ${v}`,
  lateFuture:     v => `DD: ${v.join(', ')}`,
  poRank:         v => `Rank: ${v.join(', ')}`,
  delayResponse:  v => `Delay: ${v.length > 20 ? v.slice(0, 20) + '…' : v}`,
  deliveryStatus: v => `Delivery: ${v.length}`,
  supplierRegion: v => ({ US: 'Region: US', CHINA: 'Region: China', ALL: 'Region: All' }[v] || `Region: ${v}`),
  shippedOver80:  _ => 'Shipped > 80%',
  dropDateFrom:   v => `Drop ≥ ${v}`,
  dropDateTo:     v => `Drop ≤ ${v}`,
  finalDdFrom:    v => `Final DD ≥ ${v}`,
  finalDdTo:      v => `Final DD ≤ ${v}`,
  delayDaysMin:   v => `Delay ≥ ${v}d`,
  delayDaysMax:   v => `Delay ≤ ${v}d`,
  missingSizes:   v => `Missing: ${v.join(', ')}`,
  priorityCombo:  v => `Combo: ${v.length}`,
  shippingMethod: v => `Shipping: ${v.join(', ')}`,
  indMax:         v => `IND ≤ ${v}d`,
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

// Compact dual date-range field
function DateRangeField({ label, fromVal, toVal, onFromChange, onToChange }) {
  return (
    <FilterField label={label}>
      <div className="flex items-center gap-1">
        <input type="date" className={inputCls} value={fromVal || ''} onChange={e => onFromChange(e.target.value)} title="From" />
        <span className="text-[#A3A3A3] text-xs">→</span>
        <input type="date" className={inputCls} value={toVal || ''} onChange={e => onToChange(e.target.value)} title="To" />
      </div>
    </FilterField>
  );
}

// Min/max numeric pair
function MinMaxField({ label, minVal, maxVal, onMinChange, onMaxChange, suffix = '' }) {
  return (
    <FilterField label={label}>
      <div className="flex items-center gap-1">
        <input type="number" min="0" placeholder="Min" className={inputCls} value={minVal} onChange={e => onMinChange(e.target.value)} />
        <span className="text-[#A3A3A3] text-xs">→</span>
        <input type="number" min="0" placeholder={`Max${suffix ? ' ' + suffix : ''}`} className={inputCls} value={maxVal} onChange={e => onMaxChange(e.target.value)} />
      </div>
    </FilterField>
  );
}

export default function FilterToolbar({
  role, filters, onChange, onReset,
  suppliers, ddManagers, collections = [], orderTypes = [],
  missingSizesOptions = [], priorityComboOptions = [], shippingMethodOptions = [],
  mainOfficeViewMode,
  advancedOpen, onAdvancedToggle,
}) {
  const setAdvancedOpen = onAdvancedToggle || (() => {});
  const defaultFilters = {
    po: '', style: '',
    status: 'ALL',
    priority: [], supplier: [], ddManager: '', ddStatus: [], reason: [],
    urgent: false, archive: false, collection: [], orderType: [],
    nextUpdate: '', lateFuture: [], poRank: [],
    delayResponse: '', deliveryStatus: [],
    supplierRegion: 'CHINA',
    shippedOver80: false,
    dropDateFrom: '', dropDateTo: '',
    finalDdFrom: '', finalDdTo: '',
    delayDaysMin: '', delayDaysMax: '',
    missingSizes: [], priorityCombo: [], shippingMethod: [],
    indMax: '',
  };

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const orderTypeOptions = orderTypes.length > 0 ? orderTypes : ['New', 'Rep'];
  // Active scope: this section only renders if exactly "New" is the active orderType.
  const isNewOnly = Array.isArray(filters.orderType) && filters.orderType.length === 1 && filters.orderType[0] === 'New';
  // Rep scope (for Rep-only filters: Missing Sizes, Priority Combo, Shipping Method)
  const isRepScope = mainOfficeViewMode === 'Rep' ||
    (Array.isArray(filters.orderType) && filters.orderType.length === 1 && filters.orderType[0] === 'Rep');

  // ── DD Team Employee: simplified inline strip ──
  if (role === 'dd_team_employee') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 grid gap-2 items-end shadow-[0_1px_3px_rgba(0,0,0,.04)]"
           style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))' }}>
        <FilterField label="PO Number">
          <input className={inputCls} placeholder="Search…" value={filters.po} onChange={e => set('po', e.target.value)} />
        </FilterField>
        <FilterField label="Supplier Region">
          <select className={selectCls} value={filters.supplierRegion || 'CHINA'} onChange={e => set('supplierRegion', e.target.value)}>
            <option value="CHINA">China</option>
            <option value="US">US</option>
            <option value="ALL">All</option>
          </select>
        </FilterField>
        <FilterField label="Supplier">
          <MultiSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} placeholder="All suppliers" />
        </FilterField>
        <FilterField label="Style Color">
          <input className={inputCls} placeholder="Search…" value={filters.style} onChange={e => set('style', e.target.value)} />
        </FilterField>
        <FilterField label="Collection">
          <MultiSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} placeholder="All collections" />
        </FilterField>
        <FilterField label="Order Type">
          <MultiSelect value={filters.orderType} onChange={v => set('orderType', v)} options={orderTypeOptions} placeholder="All types" />
        </FilterField>
        <FilterField label="DDD Status">
          <select className={selectCls} value={filters.status} onChange={e => set('status', e.target.value)}>
            <option value="ALL">All</option>
            <option value="HOLD">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
          </select>
        </FilterField>
        <FilterField label="Production Stage">
          <MultiSelect value={filters.ddStatus} onChange={v => set('ddStatus', v)} options={DD_STATUS_OPTIONS} placeholder="All stages" />
        </FilterField>
        <FilterField label="Next Update">
          <input type="date" className={inputCls} value={filters.nextUpdate || ''} onChange={e => set('nextUpdate', e.target.value)} />
        </FilterField>
        <DateRangeField label="Final DD" fromVal={filters.finalDdFrom} toVal={filters.finalDdTo} onFromChange={v => set('finalDdFrom', v)} onToChange={v => set('finalDdTo', v)} />
        <MinMaxField label="Delay Request (days)" minVal={filters.delayDaysMin} maxVal={filters.delayDaysMax} onMinChange={v => set('delayDaysMin', v)} onMaxChange={v => set('delayDaysMax', v)} />
        <button onClick={onReset} className="h-8 px-3 text-xs font-semibold text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-[6px] flex items-center gap-1.5 transition-colors self-end justify-center">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    );
  }

  // ── Main office / DD team manager ──
  return (
    <>
      {/* Compact bar */}
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: 'repeat(5, minmax(140px,1fr)) auto auto' }}>
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
          <FilterField label="Priority">
            <MultiSelect value={filters.priority} onChange={v => set('priority', v)} options={PRIORITY_OPTIONS} placeholder="All priorities" />
          </FilterField>
          <FilterField label="Supplier Region">
            <select className={selectCls} value={filters.supplierRegion || 'CHINA'} onChange={e => set('supplierRegion', e.target.value)}>
              <option value="CHINA">China</option>
              <option value="US">US</option>
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

      {/* Always-visible row: Final DD range + Delay days range (new) */}
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))' }}>
          <DateRangeField label="Final DD" fromVal={filters.finalDdFrom} toVal={filters.finalDdTo} onFromChange={v => set('finalDdFrom', v)} onToChange={v => set('finalDdTo', v)} />
          <MinMaxField label="Delay Request (days)" minVal={filters.delayDaysMin} maxVal={filters.delayDaysMax} onMinChange={v => set('delayDaysMin', v)} onMaxChange={v => set('delayDaysMax', v)} />
          {isNewOnly && (
            <>
              <DateRangeField label="Drop Date" fromVal={filters.dropDateFrom} toVal={filters.dropDateTo} onFromChange={v => set('dropDateFrom', v)} onToChange={v => set('dropDateTo', v)} />
              <FilterField label="Shipped > 80%">
                <button onClick={() => set('shippedOver80', !filters.shippedOver80)} className={toggleCls(filters.shippedOver80)}>
                  {filters.shippedOver80 ? 'Shipped > 80% ✓' : 'Shipped > 80%'}
                </button>
              </FilterField>
            </>
          )}
        </div>
      </div>

      {advancedOpen && (
        <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))' }}>
            <FilterField label="DD Manager">
              <select className={selectCls} value={filters.ddManager} onChange={e => set('ddManager', e.target.value)}>
                <option value="">All</option>
                {ddManagers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </FilterField>
            <FilterField label="Supplier">
              <MultiSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} placeholder="All suppliers" />
            </FilterField>
            <FilterField label="Production Stage">
              <MultiSelect value={filters.ddStatus} onChange={v => set('ddStatus', v)} options={DD_STATUS_OPTIONS} placeholder="All stages" />
            </FilterField>
            <FilterField label="Reason">
              <MultiSelect value={filters.reason} onChange={v => set('reason', v)} options={reasonOptions()} placeholder="All reasons" />
            </FilterField>
            <FilterField label="Late / Future DD">
              <MultiSelect value={filters.lateFuture} onChange={v => set('lateFuture', v)} options={LATE_FUTURE_OPTIONS} placeholder="All" />
            </FilterField>
            <FilterField label="PO Rank">
              <MultiSelect value={filters.poRank} onChange={v => set('poRank', v)} options={PO_RANK_OPTIONS} placeholder="All ranks" />
            </FilterField>
            <FilterField label="Order Type">
              <MultiSelect value={filters.orderType} onChange={v => set('orderType', v)} options={orderTypeOptions} placeholder="All types" />
            </FilterField>
            <FilterField label="Collection">
              <MultiSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} placeholder="All collections" />
            </FilterField>
            <FilterField label="Delay Response">
              <input className={inputCls} placeholder="Search…" value={filters.delayResponse} onChange={e => set('delayResponse', e.target.value)} />
            </FilterField>
            <FilterField label="Urgent">
              <button onClick={() => set('urgent', !filters.urgent)} className={toggleCls(filters.urgent)}>
                {filters.urgent ? 'Urgent only ✓' : 'Urgent only'}
              </button>
            </FilterField>
            {role === 'dd_team_manager' && (
              <FilterField label="Archive">
                <button
                  onClick={() => set('archive', !filters.archive)}
                  className={toggleCls(filters.archive)}
                  title="Show POs with no delay request history (never entered the HOLD workflow)"
                >
                  {filters.archive ? 'Archive ✓' : 'Archive'}
                </button>
              </FilterField>
            )}
            {isRepScope && (
              <>
                <FilterField label="Missing Sizes">
                  <MultiSelect value={filters.missingSizes} onChange={v => set('missingSizes', v)} options={missingSizesOptions} placeholder="All combos" />
                </FilterField>
                <FilterField label="Priority Combo">
                  <MultiSelect value={filters.priorityCombo} onChange={v => set('priorityCombo', v)} options={priorityComboOptions} placeholder="All combos" />
                </FilterField>
                <FilterField label="Shipping Method">
                  <MultiSelect value={filters.shippingMethod} onChange={v => set('shippingMethod', v)} options={shippingMethodOptions} placeholder="All methods" />
                </FilterField>
              </>
            )}
            {role === 'main_office' && (
              <FilterField label="IND (max days)">
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 7"
                  className={inputCls}
                  value={filters.indMax}
                  onChange={e => set('indMax', e.target.value)}
                  title="Show POs with inventory days ≤ N"
                />
              </FilterField>
            )}
          </div>
          <ActiveChips filters={filters} defaultFilters={defaultFilters} onChange={onChange} />
        </div>
      )}
    </>
  );
}