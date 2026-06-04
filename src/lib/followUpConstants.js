export const STATUS_ENUM = {
  HOLD:          { name: 'HOLD',         badgeClass: 'badge-hold',     desc: 'Awaiting main office decision' },
  AUTOMATICALLY: { name: 'Auto-approved',badgeClass: 'badge-auto',     desc: 'Auto-approved (non-urgent, ≤ 3 days delay)' },
  APPROVED:      { name: 'Approved',     badgeClass: 'badge-approved', desc: 'Approved — delay is justified' },
  ACKNOWLEDGED:  { name: 'Acknowledged', badgeClass: 'badge-ack',      desc: 'Accepted — we have no other choice.' },
  REJECTED:      { name: 'Rejected',     badgeClass: 'badge-rejected', desc: 'Rejected — delay is not acceptable' },
};

export const REASON_TO_RESPONSIBILITY = {
  'Force Majeure': 'OTHER', 'DD Temporary': 'OTHER',
  'PPS Approval Late': 'EDIKTED', 'Fabric Approval Late': 'EDIKTED', 'QC Approval Late': 'EDIKTED',
  'Wrong Packing Materials': 'EDIKTED', 'Labels Arrive Late': 'EDIKTED',
  'QC Reproduction': 'SUPPLIER', 'QC ReWork': 'SUPPLIER', 'PPS Submission Late': 'SUPPLIER',
  'Fabric Issue': 'SUPPLIER', 'Production Capacity Issue': 'SUPPLIER',
  'Technical problem - washing': 'SUPPLIER', 'Technical problem - printing': 'SUPPLIER',
  'Technical problem - sewing / handmade': 'SUPPLIER', 'Packing Issue': 'SUPPLIER',
  'Special details late': 'SUPPLIER',
};

export const DD_REASONS_BY_GROUP = [
  { group: 'Other', reasons: ['Force Majeure', 'DD Temporary'] },
  { group: 'Edikted (our fault)', reasons: ['PPS Approval Late', 'Fabric Approval Late', 'QC Approval Late', 'Wrong Packing Materials', 'Labels Arrive Late'] },
  { group: 'Supplier (their fault)', reasons: ['QC Reproduction', 'QC ReWork', 'PPS Submission Late', 'Fabric Issue', 'Production Capacity Issue', 'Technical problem - washing', 'Technical problem - printing', 'Technical problem - sewing / handmade', 'Packing Issue', 'Special details late'] },
];

export const DD_STATUS_OPTIONS = [
  'Empty status',
  'Order Fabric',
  'PPS At Risk',
  'PPS Send To Approval - Pre Prod',
  'PPS Send To Approval - Post Prod',
  'Ready For Production',
  'In Production - Cutting',
  'In Production - Knitting',
  'In Production - Sewing',
  'In Production - Washing',
  'In Production - ACC',
  'Reproduction',
  'Supplier Self Inspection',
  'QC in factory',
  'QC in Office',
  'Under Packing in Factory',
  'Rework',
  'OTW to Office',
  'Partially Received',
  'Goods Received',
];

// Status-aware comment templates. Selecting a template pre-fills the comment textarea.
// [date], [X/Y], [date/hour] are placeholders the user fills in.
export const STATUS_COMMENT_TEMPLATES = {
  'In Production - ACC':            ['will finish on "[date]"'],
  'OTW to Office':                  [
    'will arrive on [date] - need qc in office',
    'will arrive on [date] before 6 pm - ready for shipment..',
    'will arrive on [date] after 6pm - ready for shipment..',
  ],
  'Rework':                         ['plan reqc on "[date]"'],
  'Ready For Production':           [
    'Will start production on [date]',
    'Will start cutting on [date]',
    'Under embroidering will start cutting on [date]',
    'Under printing will start cutting on [date]',
    'beads work, will start cutting on [date]',
  ],
  'Reproduction':                   ['will start production on "[date]"'],
  'Supplier Self Inspection':       ['BOOKED QC check on [date]'],
  'In Production - Sewing':         ['finish sewing on [date]'],
  'In Production - Washing':        ['finish washing on [date]'],
  'Under Packing in Factory':       ['will send the goods today', 'will send the goods tmr'],
  'QC in factory':                  ['results will be on [date/hour]'],
  'Partially Received':             ['received [X/Y] rest will arrive on [date]'],
  'Goods Received':                 ['received [X/Y] all arrived. no rest..'],
  'Order Fabric':                   ['fabric will arrive on [date]'],
  'In Production - Cutting':        ['will be ready for sewing on [date]'],
  'PPS Send To Approval - Pre Prod':['will arrive to LA on [date]', 'will arrive to main office on [date]', 'arrived on [date] waiting for approval'],
  'In Production - Knitting':       ['will finish knitting on [date]'],
  'PPS At Risk':                    ['PPS will be ready on [date]'],
  'PPS Send To Approval - Post Prod':['pps will arrive to the office on [date]'],
};

export const DELAY_RESPONSE_OPTIONS = [
  { key: 'SEND_VIA_EMAIL',  label: 'Please send via email' },
  { key: 'PUSH_XS_EARLIER', label: 'Push to send XS size earlier' },
  { key: 'PUSH_S_EARLIER',  label: 'Push to send S size earlier' },
  { key: 'PUSH_DD_UK',      label: 'Push to advance the DD for the UK qty' },
  { key: 'PUSH_DD_US',      label: 'Push to advance the DD for the US qty' },
  { key: 'SHORTEN_DD',      label: 'Push to shorten the DD' },
  { key: 'PARTIAL_QTY',     label: 'Push to send partial qty in advance' },
  { key: 'SEND_ON_DATE',    label: 'Push to send on [date]' },
  { key: 'OTHER',           label: 'Other…' },
];

export const DD_COMMENT_OPTIONS = [
  'On track', 'Awaiting supplier response', 'Sample sent', 'Sample approved',
  'Bulk fabric received', 'Production started', 'Quality check in progress',
  'Goods ready for shipment', 'Risk: possible delay', 'Other',
];

export const ROLE_DISPLAY = {
  dd_team_employee: 'DD Team Employee',
  dd_team_manager: 'DD Team Manager',
  main_office: 'Main Office',
};

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function ddmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

export function getResponsibility(reason) {
  return REASON_TO_RESPONSIBILITY[reason] || 'OTHER';
}

// DD statuses that count as "Manufactured Not Started"
// (production hasn't truly begun: empty status, fabric/PPS approval stages, etc.)
export const NOT_STARTED_DD_STATUSES = [
  'Empty status',
  'Fabric Send To Approval - Post Prod',
  'PPS Send To Approval - Pre Prod',
  'PPS Send To Approval - Post Prod',
  'Fabric At Risk',
  'Fabric in Process',
  'PPS At Risk',
  'Order Fabric',
  'Ready For Production',
];

// Statuses for "Fabric/PPS at Risk" KPI
export const FABRIC_PPS_RISK_STATUSES = [
  'Fabric Send To Approval - Post Prod',
  'PPS Send To Approval - Pre Prod',
  'PPS Send To Approval - Post Prod',
  'Fabric At Risk',
  'Fabric in Process',
  'PPS At Risk',
];

// Statuses for "Rework / Reproduction" KPI
export const REWORK_REPRO_STATUSES = ['Rework', 'Reproduction'];

// Statuses for "QC in Office / Factory" KPI
export const QC_STATUSES = ['QC in factory', 'QC in Office'];

// Returns true if the collection name refers to a month earlier than the current calendar month.
// Looks for YYYY-MM, MM-YYYY, MM/YY, MM-YY or month-short tokens in the collection string.
export function isPreviousCollection(collection) {
  if (!collection) return false;
  const c = String(collection).toLowerCase();
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12

  const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

  // Try YYYY-MM
  let m = c.match(/(20\d{2})[-/](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10);
    return y < curYear || (y === curYear && mo < curMonth);
  }
  // Try MM-YYYY
  m = c.match(/(\d{1,2})[-/](20\d{2})/);
  if (m) {
    const y = parseInt(m[2], 10), mo = parseInt(m[1], 10);
    return y < curYear || (y === curYear && mo < curMonth);
  }
  // Try MM/YY or MM-YY
  m = c.match(/(\d{1,2})[-/](\d{2})\b/);
  if (m) {
    const y = 2000 + parseInt(m[2], 10), mo = parseInt(m[1], 10);
    return y < curYear || (y === curYear && mo < curMonth);
  }
  // Try month-short name (assume current year)
  for (const [abbr, mo] of Object.entries(monthMap)) {
    if (c.includes(abbr)) {
      return mo < curMonth;
    }
  }
  return false;
}

// Standard size order for Missing Sizes display
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export function sortSizes(sizes) {
  if (!Array.isArray(sizes)) return [];
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(String(a).toUpperCase());
    const ib = SIZE_ORDER.indexOf(String(b).toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Build a stable key string for a missing-sizes combination (e.g. ["XS","S"] -> "XS+S")
export function missingSizesKey(sizes) {
  return sortSizes(sizes).join('+');
}

// US suppliers — all others are treated as China for the Supplier Region filter.
export const US_SUPPLIERS = ['LUCENTING', 'LUCENTINC', 'KILAT'];

export function isUsSupplier(supplierName) {
  if (!supplierName) return false;
  const s = String(supplierName).toUpperCase();
  return US_SUPPLIERS.some(us => s.includes(us));
}