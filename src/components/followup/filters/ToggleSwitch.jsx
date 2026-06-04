import React from 'react';

/**
 * iOS-style toggle. Compact.
 *  - label: string
 *  - checked: boolean
 *  - onChange: (next: boolean) => void
 */
export default function ToggleSwitch({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-[18px] w-[32px] flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-[#E31B7F]' : 'bg-[#D4D4D4]',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-[14px] w-[14px] bg-white rounded-full shadow transform transition-transform',
            checked ? 'translate-x-[16px]' : 'translate-x-[2px]',
          ].join(' ')}
        />
      </button>
      <span className="text-xs font-medium text-[#0A0A0A]">{label}</span>
    </label>
  );
}