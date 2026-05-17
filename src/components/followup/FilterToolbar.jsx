import React from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { DD_STATUS_OPTIONS, DD_REASONS_BY_GROUP } from '@/lib/followUpConstants';

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

export default function FilterToolbar({ role, filters, onChange, onReset, suppliers, ddManagers, advancedOpen, onAdvancedToggle }) {
  const setAdvancedOpen = onAdvancedToggle || (() => {});

  const set = (key, val) => onChange({ ...filters, [key]: val });

  if (role === 'dd_team_employee') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-3 mb-4 flex flex-wrap gap-2 items-end shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <FilterField label="PO Number">
          <input className={inputCls} placeholder="Search…" value={filters.po} onChange={e => set('po', e.target.value)} />
        </FilterField>
        <FilterField label="Supplier">
          <select className={selectCls} value={filters.supplier} onChange={e => set('supplier', e.target.value)}>
            <option value="">All</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterField>
        <FilterField label="Style Color">
          <input className={inputCls} placeholder="Search…" value={filters.style} onChange={e => set('style', e.target.value)} />
        </FilterField>
        <FilterField label="Collection">
          <input className={inputCls} placeholder="Search…" value={filters.collection} onChange={e => set('collection', e.target.value)} />
        </FilterField>
        <FilterField label="DD Manager">
          <select className={selectCls} value={filters.ddManager} onChange={e => set('ddManager', e.target.value)}>
            <option value="">All</option>
            {ddManagers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterField>
        <FilterField label="Order Type">
          <select className={selectCls} value={filters.orderType} onChange={e => set('orderType', e.target.value)}>
            <option value="">All</option>
            <option value="Regular">Regular</option>
            <option value="ACC">ACC</option>
            <option value="CL">CL</option>
          </select>
        </FilterField>
        <FilterField label="Flag">
          <select className={selectCls} value={filters.flag} onChange={e => set('flag', e.target.value)}>
            <option value="">All</option>
            <option value="URGENT">URGENT</option>
            <option value="REVIEW">REVIEW</option>
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
              <option value="HOLD">Pending</option>
              <option value="HANDLED">Handled</option>
              <option value="ALL">All</option>
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
              <select className={selectCls} value={filters.ddManager} onChange={e => set('ddManager', e.target.value)}>
                <option value="">All</option>
                {ddManagers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>
            <FilterField label="Supplier">
              <select className={selectCls} value={filters.supplier} onChange={e => set('supplier', e.target.value)}>
                <option value="">All</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
            <FilterField label="Urgent">
              <button
                onClick={() => set('urgent', !filters.urgent)}
                className={`h-8 px-3 rounded-[6px] text-xs font-semibold border transition-colors ${filters.urgent ? 'bg-[#FFF0F7] text-[#E31B7F] border-[#E31B7F]' : 'border-[#D4D4D4] text-[#525252] hover:border-[#E31B7F] hover:text-[#E31B7F]'}`}
              >
                {filters.urgent ? 'Urgent only ✓' : 'Urgent only'}
              </button>
            </FilterField>
          </div>
        </div>
      )}
    </>
  );
}