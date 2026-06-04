import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';

/**
 * Date range picker — single calendar with range selection (like Notion/Linear).
 * Props:
 *  - fromVal, toVal: 'YYYY-MM-DD' strings or ''
 *  - onChange: ({ from, to }) => void
 */
export default function DateRangePicker({ fromVal, toVal, onChange, placeholder = 'Pick range' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const range = {
    from: fromVal ? parseISO(fromVal) : undefined,
    to: toVal ? parseISO(toVal) : undefined,
  };

  function handleSelect(r) {
    onChange({
      from: r?.from ? format(r.from, 'yyyy-MM-dd') : '',
      to:   r?.to   ? format(r.to,   'yyyy-MM-dd') : '',
    });
  }

  function clear(e) {
    e.stopPropagation();
    onChange({ from: '', to: '' });
  }

  const label = fromVal || toVal
    ? `${fromVal ? format(parseISO(fromVal), 'dd MMM') : '…'} → ${toVal ? format(parseISO(toVal), 'dd MMM') : '…'}`
    : placeholder;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-8 px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-medium text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 hover:border-[#E31B7F] transition-colors w-full flex items-center gap-1.5 cursor-pointer"
      >
        <CalendarIcon size={11} className="flex-shrink-0 opacity-60" />
        <span className={`truncate flex-1 text-left ${!fromVal && !toVal ? 'text-[#737373]' : ''}`}>{label}</span>
        {(fromVal || toVal) && (
          <button
            type="button"
            onClick={clear}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#FFE5F2] text-[#A3A3A3] hover:text-[#E31B7F]"
            title="Clear"
          >
            <X size={10} />
          </button>
        )}
      </button>
      {open && (
        <div className="absolute z-[999] top-full left-0 mt-1 bg-white border border-[#D4D4D4] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,.12)] p-2 date-range-popover">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={1}
          />
          <style>{`
            .date-range-popover .rdp-day_range_middle {
              background-color: #FFE5F2 !important;
              color: #0A0A0A !important;
              border-radius: 0 !important;
            }
            .date-range-popover .rdp-day_range_start,
            .date-range-popover .rdp-day_range_end {
              background-color: #E31B7F !important;
              color: white !important;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}