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