import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown, Type, Hash, Calendar, ToggleLeft } from 'lucide-react';

// Operator menus per column type
const OPERATORS = {
  text:    [
    { value: 'includes',         label: 'includes',         needsValue: true },
    { value: 'not_includes',     label: 'does not include', needsValue: true },
    { value: 'is',               label: 'is',               needsValue: true },
    { value: 'is_not',           label: 'is not',           needsValue: true },
    { value: 'is_empty',         label: 'is empty',         needsValue: false },
    { value: 'is_not_empty',     label: 'is not empty',     needsValue: false },
  ],
  number:  [
    { value: 'eq',           label: '=',          needsValue: true },
    { value: 'neq',          label: '≠',          needsValue: true },
    { value: 'gt',           label: '>',          needsValue: true },
    { value: 'gte',          label: '≥',          needsValue: true },
    { value: 'lt',           label: '<',          needsValue: true },
    { value: 'lte',          label: '≤',          needsValue: true },
    { value: 'is_empty',     label: 'is empty',   needsValue: false },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false },
  ],
  date:    [
    { value: 'eq',           label: 'is',           needsValue: true },
    { value: 'before',       label: 'before',       needsValue: true },
    { value: 'after',        label: 'after',        needsValue: true },
    { value: 'is_empty',     label: 'is empty',     needsValue: false },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false },
  ],
  boolean: [
    { value: 'is_true',  label: 'is true',  needsValue: false },
    { value: 'is_false', label: 'is false', needsValue: false },
  ],
};

const TYPE_ICON = {
  text:    <Type size={11} />,
  number:  <Hash size={11} />,
  date:    <Calendar size={11} />,
  boolean: <ToggleLeft size={11} />,
};

function emptyRule(columns) {
  const first = columns[0];
  const ops = OPERATORS[first?.type || 'text'];
  return {
    id: `r${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    field: first?.key || '',
    operator: ops[0].value,
    value: '',
  };
}

function Combo({ value, onChange, options, placeholder, className = '', renderOption }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-8 w-full pl-2.5 pr-7 flex items-center gap-1.5 text-xs font-medium text-[#0A0A0A] bg-white border rounded-[6px] hover:border-[#E31B7F] focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 transition-colors text-left ${open ? 'border-[#E31B7F] ring-2 ring-[#E31B7F]/10' : 'border-[#D4D4D4]'}`}
      >
        {selected ? (renderOption ? renderOption(selected) : <span className="truncate">{selected.label}</span>) : <span className="text-[#A3A3A3]">{placeholder}</span>}
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.12)] z-50 min-w-[180px] max-h-[260px] overflow-y-auto">
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between gap-2 transition-colors ${isSel ? 'bg-[#FFF0F7] text-[#E31B7F]' : 'text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}
              >
                {renderOption ? renderOption(opt) : <span className="truncate">{opt.label}</span>}
                {isSel && <span className="text-[#E31B7F]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CustomFilterModal({ columns, rules, onChange, onClose, anchorRect }) {
  const [draft, setDraft] = useState(() => (rules?.length ? rules : [emptyRule(columns)]));

  function updateRule(idx, patch) {
    setDraft(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, ...patch };
      // When field changes, reset operator/value to first valid for new type
      if (patch.field && patch.field !== r.field) {
        const col = columns.find(c => c.key === patch.field);
        const ops = OPERATORS[col?.type || 'text'];
        next.operator = ops[0].value;
        next.value = '';
      }
      return next;
    }));
  }

  function removeRule(idx) {
    setDraft(prev => prev.filter((_, i) => i !== idx));
  }

  function addRule() {
    setDraft(prev => [...prev, emptyRule(columns)]);
  }

  function handleClear() {
    setDraft([emptyRule(columns)]);
    onChange([]);
    onClose();
  }

  function handleApply() {
    // Drop rules that need a value but have empty one (except operators that don't need one)
    const cleaned = draft.filter(r => {
      const col = columns.find(c => c.key === r.field);
      const op = OPERATORS[col?.type || 'text'].find(o => o.value === r.operator);
      if (!op) return false;
      if (!op.needsValue) return true;
      return String(r.value ?? '').trim() !== '';
    });
    onChange(cleaned);
    onClose();
  }

  // Position modal above the anchor (filter button)
  const style = anchorRect
    ? { position: 'fixed', bottom: window.innerHeight - anchorRect.top + 8, right: window.innerWidth - anchorRect.right }
    : { position: 'fixed', bottom: 80, right: 32 };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={style}
        className="z-50 bg-white border border-[#E5E5E5] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,.12)] w-[640px] max-w-[calc(100vw-32px)] animate-scale-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <div className="text-[12px] font-bold text-[#0A0A0A] uppercase tracking-[.06em]">Custom filter</div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 max-h-[60vh] overflow-y-auto overflow-x-visible" style={{ overflow: 'visible' }}>
          {draft.map((rule, idx) => {
            const col = columns.find(c => c.key === rule.field);
            const type = col?.type || 'text';
            const ops = OPERATORS[type];
            const opMeta = ops.find(o => o.value === rule.operator) || ops[0];
            const colOptions = columns.map(c => ({ value: c.key, label: c.label, type: c.type }));

            return (
              <div key={rule.id} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#525252] w-12 flex-shrink-0">
                  {idx === 0 ? 'Where' : 'And'}
                </span>
                <Combo
                  value={rule.field}
                  onChange={v => updateRule(idx, { field: v })}
                  options={colOptions}
                  placeholder="Column"
                  className="w-[170px] flex-shrink-0"
                  renderOption={opt => (
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-[#A3A3A3] flex-shrink-0">{TYPE_ICON[opt.type] || TYPE_ICON.text}</span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                  )}
                />
                <Combo
                  value={rule.operator}
                  onChange={v => updateRule(idx, { operator: v })}
                  options={ops}
                  placeholder="Operator"
                  className="w-[140px] flex-shrink-0"
                />
                {opMeta.needsValue ? (
                  type === 'date' ? (
                    <input
                      type="date"
                      value={rule.value}
                      onChange={e => updateRule(idx, { value: e.target.value })}
                      className="h-8 px-2.5 flex-1 min-w-0 border border-[#E31B7F] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E31B7F]/10"
                    />
                  ) : (
                    <input
                      type={type === 'number' ? 'number' : 'text'}
                      value={rule.value}
                      onChange={e => updateRule(idx, { value: e.target.value })}
                      placeholder="Value"
                      className="h-8 px-2.5 flex-1 min-w-0 border border-[#E31B7F] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E31B7F]/10"
                    />
                  )
                ) : (
                  <div className="flex-1 min-w-0 h-8 px-2.5 flex items-center text-[11px] text-[#A3A3A3] italic">No value needed</div>
                )}
                <button
                  onClick={() => removeRule(idx)}
                  disabled={draft.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}

          <button
            onClick={addRule}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#525252] hover:text-[#E31B7F] transition-colors pt-1"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA] rounded-b-[12px]">
          <button
            onClick={handleClear}
            className="text-[12px] font-semibold text-[#E31B7F] hover:text-[#C21571] transition-colors"
          >
            Clear filters
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-3.5 text-xs font-semibold text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-[6px] hover:bg-white hover:border-[#D4D4D4] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="h-8 px-3.5 text-xs font-semibold text-white bg-[#E31B7F] rounded-[6px] hover:bg-[#C21571] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Pure filter evaluation — exported for use in the table ────────────────
export function evaluateCustomFilters(row, rules, columns) {
  if (!rules?.length) return true;
  for (const rule of rules) {
    const col = columns.find(c => c.key === rule.field);
    if (!col) continue;
    const raw = row[rule.field];
    const op = rule.operator;
    const val = rule.value;

    if (op === 'is_empty')     { if (!(raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0))) return false; continue; }
    if (op === 'is_not_empty') { if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return false; continue; }
    if (op === 'is_true')      { if (!raw) return false; continue; }
    if (op === 'is_false')     { if (raw) return false; continue; }

    if (col.type === 'text') {
      const s = String(raw ?? '').toLowerCase();
      const q = String(val ?? '').toLowerCase();
      if (op === 'includes'     && !s.includes(q)) return false;
      if (op === 'not_includes' &&  s.includes(q)) return false;
      if (op === 'is'           && s !== q) return false;
      if (op === 'is_not'       && s === q) return false;
    } else if (col.type === 'number') {
      const n = raw == null ? null : Number(raw);
      const q = Number(val);
      if (n == null || Number.isNaN(q)) return false;
      if (op === 'eq'  && !(n === q)) return false;
      if (op === 'neq' && !(n !== q)) return false;
      if (op === 'gt'  && !(n  >  q)) return false;
      if (op === 'gte' && !(n  >= q)) return false;
      if (op === 'lt'  && !(n  <  q)) return false;
      if (op === 'lte' && !(n  <= q)) return false;
    } else if (col.type === 'date') {
      const a = raw ? String(raw).slice(0, 10) : '';
      const b = val ? String(val).slice(0, 10) : '';
      if (!a) return false;
      if (op === 'eq'     && a !== b) return false;
      if (op === 'before' && !(a < b)) return false;
      if (op === 'after'  && !(a > b)) return false;
    }
  }
  return true;
}