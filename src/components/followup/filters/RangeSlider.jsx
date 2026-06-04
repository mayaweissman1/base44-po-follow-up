import React, { useRef, useEffect, useState } from 'react';

/**
 * Dual-handle range slider (CSS-only, no deps).
 * Props:
 *  - min, max: numeric bounds
 *  - step: numeric step (default 1)
 *  - valueMin, valueMax: current selection (numbers or '' for unset)
 *  - onChange: ({ min, max }) => void  — numbers (or null when at bounds)
 *  - suffix: optional unit suffix shown on bubbles ('d' / '%')
 */
export default function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  valueMin = '',
  valueMax = '',
  onChange,
  suffix = '',
}) {
  const trackRef = useRef(null);
  const [vMin, setVMin] = useState(valueMin === '' ? min : Number(valueMin));
  const [vMax, setVMax] = useState(valueMax === '' ? max : Number(valueMax));

  useEffect(() => {
    setVMin(valueMin === '' ? min : Number(valueMin));
    setVMax(valueMax === '' ? max : Number(valueMax));
  }, [valueMin, valueMax, min, max]);

  function commit(nextMin, nextMax) {
    const lo = Math.min(nextMin, nextMax);
    const hi = Math.max(nextMin, nextMax);
    onChange({
      min: lo === min ? '' : lo,
      max: hi === max ? '' : hi,
    });
  }

  const pctMin = ((vMin - min) / (max - min)) * 100;
  const pctMax = ((vMax - min) / (max - min)) * 100;

  return (
    <div className="w-full px-2 pt-4 pb-1">
      <div ref={trackRef} className="relative h-1 bg-[#E5E5E5] rounded-full">
        <div
          className="absolute h-1 bg-[#E31B7F] rounded-full"
          style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={vMin}
          onChange={e => {
            const n = Number(e.target.value);
            setVMin(n);
          }}
          onMouseUp={() => commit(vMin, vMax)}
          onTouchEnd={() => commit(vMin, vMax)}
          onKeyUp={() => commit(vMin, vMax)}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: vMin > max - 5 ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={vMax}
          onChange={e => {
            const n = Number(e.target.value);
            setVMax(n);
          }}
          onMouseUp={() => commit(vMin, vMax)}
          onTouchEnd={() => commit(vMin, vMax)}
          onKeyUp={() => commit(vMin, vMax)}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-[#525252]">
        <span>{vMin}{suffix}</span>
        <span>{vMax}{suffix}</span>
      </div>
      <style>{`
        .range-thumb {
          -webkit-appearance: none;
          height: 4px;
        }
        .range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: #E31B7F;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,.15);
          pointer-events: auto;
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #E31B7F;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,.15);
          pointer-events: auto;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}