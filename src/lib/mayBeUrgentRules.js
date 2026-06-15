// "May be urgent" — modular rule engine
// =====================================
// Each rule has an id, label, description, an optional threshold field, and an
// evaluator(row, settings) → boolean. The user can toggle rules on/off and tune
// thresholds via the settings modal; settings are stored in localStorage.

const STORAGE_KEY = 'may-be-urgent-settings';

// Rule definitions — adding a new rule means appending here and (if needed)
// exposing the underlying field from getFollowUpData.
export const MAY_BE_URGENT_RULES = [
  {
    id: 'pu_tag',
    label: 'PU tag on style color',
    description: 'The style color is tagged with the "PU" Product Management tag.',
    evaluate: (row) => row.pu_tag === true,
  },
  {
    id: 'urgent_pm_tag',
    label: 'Urgent-* PM tag',
    description: 'The style color has any PM tag starting with "urgent-".',
    evaluate: (row) => row.urgent_tagged === true,
  },
  {
    id: 'urgent_before_cny',
    label: '"URGENT BEFORE CNY" PM tag',
    description: 'The PO has the "URGENT BEFORE CNY" PM tag attached.',
    evaluate: (row) => !!(row.pm_tags_label && /urgent before cny/i.test(row.pm_tags_label)),
  },
  {
    id: 'low_ind_repeats',
    label: 'Low inventory days (Repeats: WR / R / SWIMR)',
    description: 'A repeat order whose minimum Inventory Days across destinations is at or below the threshold.',
    threshold: {
      key: 'lowIndRepeatsMax',
      label: 'Inv Days ≤',
      defaultValue: 30,
      min: 0,
      max: 365,
      suffix: 'd',
    },
    evaluate: (row, s) => {
      const prefix = (row.po_type_prefix || row.po_type || '').toUpperCase();
      const isRepeat = ['WR', 'R', 'SWIMR'].some(t => prefix.includes(t));
      if (!isRepeat) return false;
      if (row.inv_days == null) return false;
      return Number(row.inv_days) <= Number(s.lowIndRepeatsMax ?? 30);
    },
  },
  {
    id: 'o_swim_order',
    label: 'New "O" / SWIM order',
    description: 'The PO is a new O or SWIM order — these are flagged as needing attention by default.',
    evaluate: (row) => {
      const prefix = (row.po_type_prefix || row.po_type || '').toUpperCase();
      return prefix.includes('O') || prefix.includes('SWIM');
    },
  },
  {
    id: 'collection_18',
    label: 'Special collection (id 18) with O / R orders',
    description: 'PO belongs to collection_type_id = 18 AND is an O or R order.',
    evaluate: (row) => {
      if (row.collection_type_id !== 18) return false;
      const prefix = (row.po_type_prefix || row.po_type || '').toUpperCase();
      return prefix === 'O' || prefix === 'R' || prefix.includes('O') || prefix.includes('R');
    },
  },
];

// Defaults: every rule ON, thresholds at their default values.
export function defaultMayBeUrgentSettings() {
  const enabled = {};
  const thresholds = {};
  for (const r of MAY_BE_URGENT_RULES) {
    enabled[r.id] = true;
    if (r.threshold) thresholds[r.threshold.key] = r.threshold.defaultValue;
  }
  return { enabled, ...thresholds };
}

export function loadMayBeUrgentSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultMayBeUrgentSettings();
    const parsed = JSON.parse(saved);
    // Merge with defaults so new rules added later are enabled by default.
    const defaults = defaultMayBeUrgentSettings();
    return {
      ...defaults,
      ...parsed,
      enabled: { ...defaults.enabled, ...(parsed.enabled || {}) },
    };
  } catch {
    return defaultMayBeUrgentSettings();
  }
}

export function saveMayBeUrgentSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

// Evaluate a row against the active rules. Returns the matched rules so the
// tooltip can list what triggered the "may be urgent" hint.
export function evaluateMayBeUrgent(row, settings) {
  // Already urgent or manually marked — never "may be urgent".
  if (row.urgent === true || row.marked_urgent === true) {
    return { mayBeUrgent: false, matchedRules: [] };
  }
  const matched = [];
  for (const rule of MAY_BE_URGENT_RULES) {
    if (!settings.enabled[rule.id]) continue;
    if (rule.evaluate(row, settings)) matched.push(rule);
  }
  return { mayBeUrgent: matched.length > 0, matchedRules: matched };
}