import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, X, ChevronDown } from 'lucide-react';
import { DD_STATUS_OPTIONS, DD_REASONS_BY_GROUP } from '@/lib/followUpConstants';

const ssTriggerCls = "h-8 px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors w-full flex items-center justify-between gap-1 cursor-pointer";

function SearchableSelect({ value, onChange, options, allLabel = 'All' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => !query || o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)} className={ssTriggerCls}>
        <span className={`truncate flex-1 text-left ${!value ? 'text-[#737373]' : ''}`}>{value || allLabel}</span>
        <ChevronDown size={11} className="flex-shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-[999] top-full left-0 mt-1 bg-white border border-[#D4D4D4] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,.12)] min-w-full w-max max-w-[240px] overflow-hidden">
          <div className="p-1.5 border-b border-[#E5E5E5]">
            <input
              autoFocus
              className="w-full h-7 px-2 text-xs border border-[#D4D4D4] rounded-[4px] focus:outline-none focus:border-[#E31B7F]"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[#FFF0F7] hover:text-[#E31B7F] ${!value ? 'text-[#E31B7F] font-semibold bg-[#FFF0F7]' : ''}`}
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}>{allLabel}</button>
            {filtered.map(o => (
              <button key={o} type="button"
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[#FFF0F7] hover:text-[#E31B7F] ${value === o ? 'text-[#E31B7F] font-semibold bg-[#FFF0F7]' : ''}`}
                onClick={() => { onChange(o); setOpen(false); setQuery(''); }}>{o}</button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-[#A3A3A3]">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-[.06em] pl-0.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-8 px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors";
const selectCls = "h-8 pl-2.5 pr-7 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white appearance-none cursor-pointer focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors";
const toggleCls = (active) => `h-8 px-3 rounded-[6px] text-xs font-semibold border transition-colors ${active ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'border-[#D4D4D4] text-[#525252] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`;

const CHIP_FORMATTERS = {
  po:             v => `PO: ${v}`,
  style:          v => `Style: ${v}`,
  status:         v => ({ HOLD: 'DDD: Pending', HANDLED: 'DDD: Handled', APPROVED: 'DDD: Approved', REJECTED: 'DDD: Rejected', ACKNOWLEDGED: 'DDD: Acknowledged', ACK_APPROVED: 'DDD: Acknowledged', AUTOMATICALLY: 'DDD: Auto' }[v] || `DDD: ${v}`),
  priority:       v => ({ URGENT: 'URGENT', Deadline: 'Deadline at risk', Normal: 'Normal', MISSING_SIZES: 'Missing sizes', Drop: 'Drop' }[v] || v),
  supplier:       v => `Supplier: ${v}`,
  ddManager:      v => `Mgr: ${v}`,
  ddStatus:       v => `DD Status: ${v}`,
  reason:         v => v,
  responsibility: v => ({ OTHER: 'Resp: Other', EDIKTED: 'Resp: Edikted', SUPPLIER: 'Resp: Supplier' }[v] || v),
  urgent:         _ => 'Urgent only',
  archive:        _ => 'Archive',
  collection:     v => `Collection: ${v}`,
  orderType:      v => `Type: ${v}`,
  flag:           v => ({ URGENT: 'Flag: URGENT', REVIEW: 'Flag: REVIEW', NONE: 'No flag' }[v] || v),
  nextUpdate:     v => `Next Upd: ${v}`,
  lateFuture:     v => ({ LATE: 'Late DD', FUTURE: 'Future DD' }[v] || v),
  poRank:         v => `Rank: ${v}`,
  delayResponse:  v => `Delay: ${v.length > 20 ? v.slice(0, 20) + '…' : v}`,
  deliveryStatus: v => `Delivery: ${v}`,
};

function ActiveChips({ filters, defaultFilters, onChange }) {
  const chips = [];
  for (const [key, fmt] of Object.entries(CHIP_FORMATTERS)) {
    const val = filters[key];
    if (val === undefined || val === null) continue;
    if (val === defaultFilters[key]) continue;
    if (val === '' || val === false) continue;
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
  advancedOpen, onAdvancedToggle,
}) {
  const setAdvancedOpen = onAdvancedToggle || (() => {});
  const defaultFilters = {
    po: '', style: '',
    status: 'ALL',
    priority: '', supplier: '', ddManager: '', ddStatus: '', reason: '',
    responsibility: '', urgent: false, archive: false, collection: '', orderType: '', flag: '',
    nextUpdate: '', lateFuture: '', poRank: '', delayResponse: '', deliveryStatus: '',
  };

  const set = (key, val) => onChange({ ...filters, [key]: val });

  // Order Type select — uses dynamic values from data; falls back to static if empty
  const orderTypeOptions = orderTypes.length > 0 ? orderTypes : ['Regular', 'ACC', 'CL'];

  if (role === 'dd_team_employee') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 flex flex-wrap gap-2 items-end shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <FilterField label="PO Number">
          <input className={inputCls} placeholder="Search…" value={filters.po} onChange={e => set('po', e.target.value)} />
        </FilterField>
        <FilterField label="Supplier">
          <SearchableSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} />
        </FilterField>
        <FilterField label="Style Color">
          <input className={inputCls} placeholder="Search…" value={filters.style} onChange={e => set('style', e.target.value)} />
        </FilterField>
        <FilterField label="Collection">
          <SearchableSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} />
        </FilterField>
        <FilterField label="DD Manager">
          <SearchableSelect value={filters.ddManager} onChange={v => set('ddManager', v)} options={ddManagers} />
        </FilterField>
        <FilterField label="Order Type">
          <SearchableSelect value={filters.orderType} onChange={v => set('orderType', v)} options={orderTypeOptions} allLabel="All types" />
        </FilterField>
        <FilterField label="Flag">
          <select className={selectCls} value={filters.flag} onChange={e => set('flag', e.target.value)}>
            <option value="">All</option>
            <option value="URGENT">URGENT</option>
            <option value="REVIEW">REVIEW</option>
            <option value="NONE">No flag</option>
          </select>
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
        <FilterField label="DD Status">
          <select className={selectCls} value={filters.ddStatus} onChange={e => set('ddStatus', e.target.value)}>
            <option value="">All</option>
            {DD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterField>
        <FilterField label="Next Update">
          <input type="date" className={inputCls} value={filters.nextUpdate || ''} onChange={e => set('nextUpdate', e.target.value)} />
        </FilterField>
        <button onClick={onReset} className="h-8 px-3 text-xs font-semibold text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-[6px] flex items-center gap-1.5 transition-colors ml-auto">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: 'repeat(4, minmax(140px,1fr)) auto auto' }}>
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
            <select className={selectCls} value={filters.priority} onChange={e => set('priority', e.target.value)}>
              <option value="">All</option>
              <option value="URGENT">URGENT</option>
              <option value="Deadline">Deadline at risk</option>
              <option value="Normal">Normal</option>
              <option value="MISSING_SIZES">Missing sizes</option>
              <option value="Drop">Drop</option>
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
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))' }}>
            <FilterField label="DD Manager">
              <SearchableSelect value={filters.ddManager} onChange={v => set('ddManager', v)} options={ddManagers} />
            </FilterField>
            <FilterField label="Supplier">
              <SearchableSelect value={filters.supplier} onChange={v => set('supplier', v)} options={suppliers} />
            </FilterField>
            <FilterField label="DD Status">
              <select className={selectCls} value={filters.ddStatus} onChange={e => set('ddStatus', e.target.value)}>
                <option value="">All</option>
                {DD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>
            <FilterField label="Reason">
              <select className={selectCls} value={filters.reason} onChange={e => set('reason', e.target.value)}>
                <option value="">All</option>
                {DD_REASONS_BY_GROUP.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.reasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
              </select>
            </FilterField>
            <FilterField label="Responsibility">
              <select className={selectCls} value={filters.responsibility} onChange={e => set('responsibility', e.target.value)}>
                <option value="">All</option>
                <option value="OTHER">Other</option>
                <option value="EDIKTED">Edikted</option>
                <option value="SUPPLIER">Supplier</option>
              </select>
            </FilterField>
            <FilterField label="Flag">
              <select className={selectCls} value={filters.flag} onChange={e => set('flag', e.target.value)}>
                <option value="">All</option>
                <option value="URGENT">URGENT</option>
                <option value="REVIEW">REVIEW</option>
                <option value="NONE">No flag</option>
              </select>
            </FilterField>
            <FilterField label="Late / Future DD">
              <select className={selectCls} value={filters.lateFuture} onChange={e => set('lateFuture', e.target.value)}>
                <option value="">All</option>
                <option value="LATE">Late</option>
                <option value="FUTURE">Future</option>
              </select>
            </FilterField>
            <FilterField label="PO Rank">
              <select className={selectCls} value={filters.poRank} onChange={e => set('poRank', e.target.value)}>
                <option value="">All</option>
                {['1', '2', '3', '4', '5'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FilterField>
            <FilterField label="Order Type">
              <SearchableSelect value={filters.orderType} onChange={v => set('orderType', v)} options={orderTypeOptions} allLabel="All types" />
            </FilterField>
            <FilterField label="Collection">
              <SearchableSelect value={filters.collection} onChange={v => set('collection', v)} options={collections} allLabel="All collections" />
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
          </div>
          <ActiveChips filters={filters} defaultFilters={defaultFilters} onChange={onChange} />
        </div>
      )}
    </>
  );
}
