import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  MAY_BE_URGENT_RULES,
  defaultMayBeUrgentSettings,
} from '@/lib/mayBeUrgentRules';

// Per-rule setting input — switches on rule.setting.kind:
//   - 'number'     → numeric threshold input
//   - 'text'       → free-text pattern input (supports * wildcard)
//   - 'collection' → name picker that resolves to the matching collection_type id
function RuleSettingInput({ setting, value, onChange, collectionTypes, loadingCollections }) {
  if (setting.kind === 'number') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-[#525252]">{setting.label}</label>
        <input
          type="number"
          min={setting.min}
          max={setting.max}
          value={value ?? setting.defaultValue}
          onChange={e => onChange(Number(e.target.value))}
          className="h-7 w-20 px-2 border border-[#D4D4D4] rounded-[6px] text-xs font-mono font-semibold text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
        />
        {setting.suffix && (
          <span className="text-[11px] text-[#A3A3A3] font-mono">{setting.suffix}</span>
        )}
      </div>
    );
  }
  if (setting.kind === 'text') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-[#525252] whitespace-nowrap">{setting.label}</label>
        <input
          type="text"
          value={value ?? setting.defaultValue}
          placeholder={setting.placeholder}
          onChange={e => onChange(e.target.value)}
          className="h-7 flex-1 max-w-[220px] px-2.5 border border-[#D4D4D4] rounded-[6px] text-xs font-mono text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10"
        />
        <span className="text-[10px] text-[#A3A3A3]">use * as wildcard</span>
      </div>
    );
  }
  if (setting.kind === 'collection') {
    const currentId = value ?? setting.defaultValue;
    return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-[#525252] whitespace-nowrap">{setting.label}</label>
        <select
          value={currentId}
          onChange={e => onChange(Number(e.target.value))}
          disabled={loadingCollections}
          className="h-7 px-2 pr-7 border border-[#D4D4D4] rounded-[6px] text-xs font-semibold text-[#0A0A0A] bg-white focus:outline-none focus:border-[#E31B7F] focus:ring-2 focus:ring-[#E31B7F]/10 disabled:opacity-50"
        >
          {loadingCollections ? (
            <option>Loading…</option>
          ) : collectionTypes.length === 0 ? (
            // Fallback option when the lookup hasn't loaded yet — keep the
            // current id selectable so the value isn't lost.
            <option value={currentId}>{setting.defaultLabel} (id {currentId})</option>
          ) : (
            collectionTypes.map(ct => (
              <option key={ct.id} value={ct.id}>{ct.name} (id {ct.id})</option>
            ))
          )}
        </select>
      </div>
    );
  }
  return null;
}

export default function MayBeUrgentSettingsModal({ settings, onChange, onClose }) {
  const [local, setLocal] = useState(settings);
  const [collectionTypes, setCollectionTypes] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  useEffect(() => { setLocal(settings); }, [settings]);

  // Load collection types once when the modal opens so the "Special collection"
  // rule can show a name picker that resolves to the matching id.
  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke('lookupCollectionTypes', {}).then(res => {
      if (cancelled) return;
      setCollectionTypes(res.data?.collection_types || []);
      setLoadingCollections(false);
    });
    return () => { cancelled = true; };
  }, []);

  function toggleRule(id) {
    setLocal(prev => ({ ...prev, enabled: { ...prev.enabled, [id]: !prev.enabled[id] } }));
  }

  function setRuleValue(key, value) {
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

                    {/* Setting input */}
                    {rule.setting && (
                      <div className={`mt-2.5 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                        <RuleSettingInput
                          setting={rule.setting}
                          value={local[rule.setting.key]}
                          onChange={v => setRuleValue(rule.setting.key, v)}
                          collectionTypes={collectionTypes}
                          loadingCollections={loadingCollections}
                        />
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