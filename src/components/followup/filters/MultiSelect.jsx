import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

/**
 * Generic multi-select dropdown.
 *
 * Props:
 *  - value: array of selected values
 *  - onChange: (next array) => void
 *  - options: array of { value, label } OR plain string array
 *  - placeholder: string shown when nothing is selected
 *  - searchable: boolean (default true)
 */
export default function MultiSelect({
  value = [],
  onChange,
  options = [],
  placeholder = 'All',
  searchable = true,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = normalized.filter(o =>
    !query || o.label.toLowerCase().includes(query.toLowerCase())
  );

  const selectedSet = new Set(value);

  function toggle(v) {
    if (selectedSet.has(v)) {
      onChange(value.filter(x => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  function clearAll(e) {
    e.stopPropagation();
    onChange([]);
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? (normalized.find(o => o.value === value[0])?.label || value[0])
      : `${value.length} selected`;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-8 px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors w-full flex items-center justify-between gap-1 cursor-pointer"
      >
        <span className={`truncate flex-1 text-left ${value.length === 0 ? 'text-[#737373]' : ''}`}>
          {label}
        </span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#FFE5F2] text-[#A3A3A3] hover:text-[#E31B7F]"
            title="Clear"
          >
            <X size={10} />
          </button>
        )}
        <ChevronDown size={11} className="flex-shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-[999] top-full left-0 mt-1 bg-white border border-[#D4D4D4] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,.12)] min-w-full w-max max-w-[280px] overflow-hidden">
          {searchable && normalized.length > 6 && (
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
          )}
          <div className="max-h-60 overflow-y-auto py-0.5">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#A3A3A3]">No matches</div>
            )}
            {filtered.map(o => {
              const checked = selectedSet.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[#FFF0F7] flex items-center gap-2 ${checked ? 'text-[#E31B7F] font-semibold bg-[#FFF0F7]/40' : 'text-[#0A0A0A]'}`}
                  onClick={() => toggle(o.value)}
                >
                  <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-[3px] border ${checked ? 'bg-[#E31B7F] border-[#E31B7F] text-white' : 'border-[#D4D4D4] bg-white'}`}>
                    {checked && <Check size={9} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="p-1.5 border-t border-[#E5E5E5] flex justify-between items-center">
              <span className="text-[10px] text-[#A3A3A3]">{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-semibold text-[#E31B7F] hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}