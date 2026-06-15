import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  MAY_BE_URGENT_RULES,
  defaultMayBeUrgentSettings,
} from '@/lib/mayBeUrgentRules';

export default function MayBeUrgentSettingsModal({ settings, onChange, onClose }) {
  const [local, setLocal] = useState(settings);

  // Keep local state in sync if parent settings change while open.
  useEffect(() => { setLocal(settings); }, [settings]);

  function toggleRule(id) {
    setLocal(prev => ({ ...prev, enabled: { ...prev.enabled, [id]: !prev.enabled[id] } }));
  }

  function setThreshold(key, value) {
    setLocal(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onChange(local);
    onClose();
  }

  function handleReset() {
    setLocal(defaultMayBeUrgentSettings());
  }

  const enabledCount = Object.values(local.enabled).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,.20)] w-full max-w-[560px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">
              <AlertTriangle size={18} strokeWidth={2.25} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-[#0A0A0A] leading-tight">"May be urgent" rules</h2>
              <p className="text-[12px] text-[#525252] mt-1 leading-snug">
                Configure which conditions surface the small orange warning icon next to a PO Number.
                A PO is flagged when it is <strong>not</strong> already urgent / marked urgent and matches any enabled rule.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#A3A3A3] hover:bg-[#F8F8F8] hover:text-[#0A0A0A] transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Rules */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {MAY_BE_URGENT_RULES.map(rule => {
            const enabled = !!local.enabled[rule.id];
            return (
              <div
                key={rule.id}
                className={`border rounded-[10px] p-3.5 transition-colors ${enabled ? 'border-[#FFE5F2] bg-[#FFF8FB]' : 'border-[#E5E5E5] bg-white'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${enabled ? 'bg-[#E31B7F]' : 'bg-[#D4D4D4]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0A0A0A] leading-tight">{rule.label}</div>
                    <div className="text-[11.5px] text-[#525252] mt-1 leading-snug">{rule.description}</div>

                    {/* Threshold input */}
                    {rule.threshold && (
                      <div className={`mt-2.5 flex items-center gap-2 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-[11px] font-semibold text-[#525252]">{rule.threshold.label}</label>
                        <input
                          type="number"
                          min={rule.threshold.min}
                          max={rule.threshold.max}
                          value={local[rule.threshold.key] ?? rule.threshold.defaultValue}
                          onChange={e => setThreshold(rule.threshold.key, Number(e.target.value))}
                          className="h-7 w-20 px-2 border border-[#D4D4D4] rounded-[6px] text-xs font-mono font-semibold text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
                        />
                        {rule.threshold.suffix && (
                          <span className="text-[11px] text-[#A3A3A3] font-mono">{rule.threshold.suffix}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E5E5] flex items-center justify-between gap-3 bg-[#FAFAFA] rounded-b-[14px]">
          <button
            onClick={handleReset}
            className="h-8 px-3 flex items-center gap-1.5 text-xs font-semibold text-[#525252] hover:text-[#0A0A0A] hover:bg-white rounded-[6px] transition-colors"
          >
            <RotateCcw size={12} /> Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#A3A3A3]">{enabledCount} of {MAY_BE_URGENT_RULES.length} rules enabled</span>
            <button
              onClick={onClose}
              className="h-8 px-4 text-xs font-semibold text-[#525252] bg-white border border-[#E5E5E5] rounded-[8px] hover:bg-[#F8F8F8] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="h-8 px-4 text-xs font-semibold text-white bg-[#E31B7F] rounded-[8px] hover:bg-[#C21571] transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}