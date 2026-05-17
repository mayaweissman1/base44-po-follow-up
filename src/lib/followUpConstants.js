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
  'Empty status', 'Ready For Production', 'In Production - Sewing', 'In Production - ACC', 'Rework', 'OTW to Office',
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