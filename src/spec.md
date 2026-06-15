# PO Follow-Up Tool — Specification
Version: 2.0  Status: Approved  Last updated: 2026-06-15

---

## Overview

Three roles access the Follow-Up screen, each with a different table layout and KPI dashboard:

| Role | Side Drawer (PO Details) | Column Picker | Sticky Left | KPI Dashboard |
|---|---|---|---|---|
| `main_office` | Yes | No (fixed columns) | First 2 + actions | `MainOfficeKpiGrid` (New/Rep toggle) |
| `dd_team_manager` | Yes | Yes (localStorage) | First 4 + actions | `KpiCards` |
| `dd_team_employee` | Yes | No (fixed columns) | First 4 + actions | `KpiCards` |

Sticky left columns include: **Checkbox**, **Expand chevron** (manager/employee), **Product Image** (manager/employee), **PO Number**.
**Actions column** is sticky right for all roles.

Role switcher is available to all users in the top header (`ALL_ROLES = ['main_office', 'dd_team_manager', 'dd_team_employee']`). Active role state is local to the page.

A mockup banner is shown at the very top of the page indicating preview-only data.

---

## Key Field Glossary

| Field name | Source | Notes |
|---|---|---|
| `delivery_date` | `pov.delivery_date` (SQL) | Warehouse delivery date — displayed as "DD Date" |
| `due_date` | `po.due_date` | Original contractual due date |
| `effective_delayed_due_date` | `ov.delayed_due_date \|\| po.delayed_due_date` | Active delayed due date |
| `effective_dd_status` | `ov.dd_status \|\| po.dd_status` | Production stage with override |
| `effective_next_update` | `ov.next_update_date \|\| po.next_update` | Next update date with override |
| `final_dd` | `effectiveDelayedDD \|\| due_date` | Used for countdown computation only |
| `countdown` | Computed: days until `final_dd` | Negative = past due |
| `current_status` | DDD flow | HOLD / APPROVED / REJECTED / ACKNOWLEDGED / AUTOMATICALLY |
| `urgent_priority` | `urgent_priority_per_po` CTE | Single closed-list value per PO (see §3.3.2). MANUAL when `marked_urgent=true`. Dedupes US-/UK- destination prefixes. |
| `urgency_reason_raw` | `po_urgent_status.reason` | Raw string aggregated from `po_urgent_status` rows; US-/UK- prefixes are stripped + deduped server-side |
| `pu_tag` | `style_color.pm_tags` contains the 'PU' pm_tag id | Boolean; renders the PU tag pill |
| `urgent_tagged` | `style_color.pm_tags` contains any 'urgent-*' pm_tag | Boolean |
| `needs_attention` | Computed in backend | True when PO is NOT urgent and NOT marked_urgent but matches `urgents_view` entry conditions (PU tag, urgent-* tag, "URGENT BEFORE CNY" PM tag, IND ≤ 30 for WR/R/SWIMR, O/SWIM order, collection_type_id=18 for O/R). Renders pulsing amber dot + "Needs Attention" badge. |
| `marked_urgent` | `po_overrides.marked_urgent` | Main Office override — forces `urgent_priority` to MANUAL |
| `marked_urgent_reason` | `po_overrides.marked_urgent_reason` | Optional free-text reason (max 200 chars) |
| `missing_sizes` | `dbt_marts.mart_repeats__sc_united_with_groups` | Array of missing size codes — Rep Orders only |
| `us_priority` / `uk_priority` | `dest_priority_per_po` CTE | Per-destination priority: BEST_SELLER / URGENT / NORMAL / null |
| `bno_high_low_otw` | `sub_bno_per_po` CTE | Boolean: US balance > 3000 with OTW < 50%, or UK balance > 1000 |
| `is_best_seller` | `bs_flag` CTE | Boolean derived from `po_urgent_status.reason ILIKE '%Best Seller%'` |
| `shipped_percent` | Computed | `(qty_sent_out / ordered_qty) * 100` |
| `inv_days` | `inv_per_po` CTE | **Sub-PO level**: MIN(Inv Days) across the PO's sub-PO destinations. Each sub_po → (style_color, destination) lookup in `edktd_history.repeats_sc_united_history` where destination is 'US' (Edikted) or 'UK' (EdiktedUK). The PO row shows the worst (lowest) IND across its sub_pos. |
| `shipping_methods` / `shipping_method_names` | `shipping_methods_per_po` CTE | Per-PO list of shipping method IDs and human-readable names |
| `late_future` | Computed | `'RECEIVED'` (qty_received ≥ ordered_qty) / `'LATE'` (final_dd < today) / `'FUTURE'` |
| `po_rank` | `po_rank_per_po` CTE | Min sub-PO rank for the PO — sub-POs ranked by destination + style_color + delayed/original DD |
| `pm_tags_label` | `pm_tags` join | Comma-separated string of PM tag labels |
| `dd_comment_log` | Aggregated `dd_updates` of type GENERAL_UPDATE | Array of `{date, text, id}` — used for "DD Comment" column |
| `set_with` | (not currently returned) | Backend CTE does not expose this field. UI shows '—'. |

---

## Backend — getFollowUpData

Source: `functions/getFollowUpData.js`. Returns `{ rows: [...], kpis: {...} }`.

### Inclusion criteria
- `po_view.po_status = 3` (Open) AND `po_view.done = false`.
- POs with any Base44 activity (override, DDD update, or GENERAL update) are always included.

### Key CTEs
- `bs_flag` — Best Seller PO numbers (from `po_urgent_status.reason ILIKE '%Best Seller%'`)
- `urgency_reason_per_po` — distinct comma-joined `po_urgent_status.reason` strings
- `pu_tag_id` — id of the 'PU' pm_tag
- `urgent_tagged_styles` — style_colors with any `urgent-*` pm_tag
- `sub_bno_per_po` — US/UK balance + OTW flags
- `shipping_methods_per_po` — IDs + names per PO
- `dest_priority_per_po` — US/UK priority (3=best seller, 2=urgent, 1=normal, 0=none)
- `manual_rw_per_po` — sum from `batch_lines.rw`
- `destinations_per_po` — array of destination names
- `sub_po_ranks` / `po_rank_per_po` — rank within destination + style_color
- `inv_per_style_dest` / `inv_per_po` — **sub-PO-level IND** keyed by (style_color, destination)
- `missing_per_style` — missing sizes from `mart_repeats__sc_united_with_groups`
- `urgent_priority_per_po` — closed-list computed priority (only when `urgent_reasons_base` table exists; otherwise null)

### Computed/derived fields on each row
- `effective_delayed_due_date`, `effective_dd_status`, `effective_next_update`, `final_dd`
- `days_late_counting` — days between original DD and effective delayed DD
- `countdown` — days from today to `final_dd`
- `hold_age_days` — days since latest DDD created_date (when status = HOLD)
- `days_same_status` — days since `ov.dd_status_changed_at`
- `late_future` — `'RECEIVED'` (fully received) / `'LATE'` / `'FUTURE'`
- `priority` — `urgency_reason_raw` (deduped) if present, else `'URGENT'` (when `po.urgent=true`), else `'Deadline'` (>3 days late), else `'Normal'`
- `urgent_priority` — `'MANUAL'` when `marked_urgent=true`, else the deduped `urgent_priority_per_po` value
- `urgency_reason_raw` — deduped (US-/UK- prefixes stripped, no duplicates)
- `needs_attention` — see Key Field Glossary
- `inv_days` — sub-PO level minimum

### KPIs returned
`{ new_pending, total_pending, urgent_pending, approved_today, rejected_today, acknowledged_today }` — computed from `dd_updates` and the set of urgent PO numbers.

---

## Filter State

Default filter state per role (defined in `DEFAULT_FILTERS(role)` in `pages/FollowUp.jsx`):

```js
{
  po: '',
  style: '',
  status: 'ALL',
  urgencyReason: [],        // multi-select on urgent_priority (or normalized urgency_reason_raw fallback)
  priorityUS: [],           // BEST_SELLER / URGENT / NORMAL
  priorityUK: [],           // BEST_SELLER / URGENT / NORMAL
  supplier: [],
  ddManager: [],
  ddStatus: [],
  archive: false,
  collection: [],
  orderType: [],
  nextUpdateFrom: '',
  nextUpdateTo: '',
  delayResponse: '',
  deliveryStatus: [],
  supplierRegion: 'CHINA',  // CHINA | US | ALL — default CHINA
  dropDateFrom: '',
  dropDateTo: '',
  finalDdFrom: '',
  finalDdTo: '',
  delayDaysMin: '',
  delayDaysMax: '',
  shippedPctMin: '',
  shippedPctMax: '',
  indMin: '',
  indMax: '',
  missingSizes: [],
  shippingMethod: [],       // shipping method NAMES
  lastUrgentComment: '',
  pmTags: [],               // strings matched against pm_tags_label tokens
  // Virtual filters driven by KPIs
  staleStatus: false,
  late7Plus: false,
  bestSeller: false,
  highBno: false,
  dropRisk: false,
}
```

### Urgency Reason matching

`matchUrgencyReason(row, token)` checks:
1. Direct equality: `row.urgent_priority === token` (preferred — closed-list value from §3.3.2)
2. Fallback: token is in `normalizeUrgencyReasons(row.urgency_reason_raw || row.priority)`

`normalizeUrgencyReasons(raw)`:
1. Splits on `,`, `;`, or `|`
2. Strips `US-` / `UK-` (and `–`/`:`) prefixes (case-insensitive)
3. Returns a `Set` of normalized category strings

### Supplier Region filter

`supplierRegion` scopes by supplier origin using `isUsSupplier(supplierName)`:
- `CHINA` — excludes US suppliers (default)
- `US` — includes only US suppliers
- `ALL` — no restriction

Applies to both the KPI grid and the table.

### Special collection tokens
`matchCollection(row, token)` supports:
- `CURRENT` — collection matches current month
- `CURRENT_AT_RISK` — current collection AND final_dd > (EOM − 5 days)
- `PREVIOUS` — `isPreviousCollection(collection)` returns true
- Any other string → case-insensitive substring match

### Special ddStatus tokens
`matchDdStatus(row, token)`:
- `EMPTY` / `'Empty status'` — null or `'Empty status'`
- `NOT_STARTED` — `NOT_STARTED_DD_STATUSES`
- `FABRIC_PPS_RISK` — `FABRIC_PPS_RISK_STATUSES`
- `REWORK_REPRO` — `REWORK_REPRO_STATUSES`
- `QC_OVER_3D` — `QC_STATUSES` AND `days_same_status > 3`
- Any other string → exact match

### Status filter values
`ALL` / `HOLD` (Pending) / `HANDLED` (any of APPROVED/REJECTED/ACKNOWLEDGED) / `ACK_APPROVED` (APPROVED or ACKNOWLEDGED) / `APPROVED` / `REJECTED` / `ACKNOWLEDGED` / `AUTOMATICALLY`.

### Archive
When `archive=true`, only rows with no `current_status` (PO never entered the HOLD workflow) are shown.

---

## Filter Toolbar Layout

### DD Team Employee + DD Team Manager — simplified inline strip

Single row, `repeat(auto-fill, minmax(150px,1fr))`, **9 controls + Reset**:

| Control | Filter key |
|---|---|
| PO Number text input | `po` |
| Supplier `MultiSelect` | `supplier` |
| Style Color text input | `style` |
| DD Manager `MultiSelect` | `ddManager` |
| Next Update `DateRangePicker` | `nextUpdateFrom`, `nextUpdateTo` |
| Production Stage `MultiSelect` | `ddStatus` |
| Supplier Region select (China/US/All) | `supplierRegion` |
| Collection `MultiSelect` | `collection` |
| PM Tags `MultiSelect` | `pmTags` |
| Reset button | — |

### Main Office — Primary bar + Advanced panel

**Primary bar** — grid `repeat(4, minmax(140px,1fr)) minmax(140px,180px) auto auto`:

| Slot | Control | Filter key |
|---|---|---|
| 1 | PO Number text input | `po` |
| 2 | Status select | `status` |
| 3 | Style Color text input | `style` |
| 4 | Urgent Priority `MultiSelect` (options from `urgencyReasonOptions`) | `urgencyReason` |
| 5 | Supplier Region select | `supplierRegion` |
| 6 | Advanced toggle button (`+ Advanced` / `− Hide`) | — |
| 7 | Reset button | — |

**Advanced panel** — `repeat(auto-fill, minmax(170px,1fr))` grid:

Categorical filters:
- DD Manager `MultiSelect`
- Supplier `MultiSelect`
- Production Stage `MultiSelect` (with `EMPTY` sentinel option)
- Order Type `MultiSelect`
- Collection `MultiSelect`
- US Priority `MultiSelect` (BEST_SELLER / URGENT / NORMAL)
- UK Priority `MultiSelect`
- Delay Response text input

Rep-scope-only categorical filters (`isRepScope = mainOfficeViewMode === 'Rep' || orderType = ['Rep']`):
- Missing Sizes `MultiSelect` (XS/S/M/L/XL/XXL from `SIZE_ORDER`)
- Shipping Method `MultiSelect`
- Last Urgent Comment text input

Range filters:
- Final DD `DateRangePicker`
- Drop Date `DateRangePicker` — **New scope only**
- Next Update `DateRangePicker`
- Delay Request (days) `RangeSlider` (0–120, suffix `d`)
- Shipped % `RangeSlider` (0–100, suffix `%`) — **New scope only**
- IND `RangeSlider` (0–60, suffix `d`) — **main_office only**

Toggle strip (dd_team_manager only): Archive `ToggleSwitch`.

Active filter chips appear below the advanced panel (Main Office only) — clicking a chip clears that filter.

---

## DD Team Employee — 36 Columns

No column picker. Side drawer (PO Details) opens on row click.

| # | Column Label | Field Key | Notes |
|---|---|---|---|
| 1 | *(checkbox)* | — | Sticky left, z-30 |
| 2 | *(expand chevron)* | — | Sticky left — opens `SubPoDestinationTable` |
| 3 | Product Image | `product_image` / `style_color` | Sticky left · `StyleThumbnail` |
| 4 | PO Number | `po_number` | Sticky left · `PoCell` with URGENT / NEEDS ATTENTION / RECEIVED / LATE / FUTURE badges |
| 5 | Style Color | `style_color` | |
| 6 | Production Stage | `effective_dd_status` | `DdStatusBadge` |
| 7 | DD Comment | `dd_comment_log` | Date + text log entries |
| 8 | DDD Status | `current_status` | `StatusBadge` |
| 9 | PO Response | `delay_response_comment` | Blue pill |
| 10 | DDD Reason | `ddd_reason` / `ddd_reasons` | `ReasonTag` |
| 11 | DDD Comment | `ddd_comment` | |
| 12 | Original DD | `due_date` | |
| 13 | Delayed DD | `effective_delayed_due_date` | |
| 14 | DD Date | `delivery_date \|\| due_date` | Warehouse date. NOT `final_dd` |
| 15 | CountDown | `countdown` | Red < 0, gray ≤ 3, green > 3 |
| 16 | Flags | `flags` | URGENT / REVIEW badge |
| 17 | Supplier | `supplier` | Teal pill |
| 18 | Delivery Status | `delivery_date_status` | Truncated to 60 chars |
| 19 | DD Manager | `dd_manager_name` | Pink pill |
| 20 | DDD Count | `ddd_count` | |
| 21 | Set With | `set_with` | **Not wired in backend — shows '—'** |
| 22 | Ordered QTY | `ordered_qty` | |
| 23 | QTY Received | `qty_received` | |
| 24 | Manual RW | `manual_rw` | |
| 25 | Auto RW | `auto_rw` | |
| 26 | Goods Received | `goods_received` | |
| 27 | Order Date | `order_date` | |
| 28 | Days Same Status | `days_same_status` | |
| 29 | Next Update | `effective_next_update` | |
| 30 | Drop | `drop` | |
| 31 | Collection | `collection` | Teal pill |
| 32 | PM Tags | `pm_tags_label` | `PmTagsPills` |
| 33 | Bulk Fabric | `bulk_fabric_approval` | Approved / Pending |
| 34 | PPS Receipt Date | `pps_receipt_date` | |
| 35 | Order Type | `po_type` | |
| 36 | Actions | — | Sticky right · Report/Edit delay, Update, Logs |

---

## DD Team Manager — Columns + Column Picker

Side drawer (PO Details). Column visibility stored in `localStorage` key `'ddmgr-opt-cols'`.
Defaults merged with saved state; **column order is always preserved** — toggling a column on shows it at its original position.

### Standard (`defaultOn: true`) — 12 columns

| Column Label | Field Key |
|---|---|
| Style Color | `style_color` |
| Production Stage | `effective_dd_status` |
| DD Comment | `dd_comment_log` |
| DDD Status | `current_status` |
| PO Response | `delay_response_comment` |
| DDD Reason | `ddd_reason` |
| DDD Comment | `ddd_comment` |
| Delayed DD | `effective_delayed_due_date` |
| CountDown | `countdown` |
| DD Manager | `dd_manager_name` |
| Days Same Status | `days_same_status` |
| Next Update | `effective_next_update` |

### Additional (`defaultOn: false`) — 19 columns

| Column Label | Field Key |
|---|---|
| Original DD | `due_date` |
| DD Date | `delivery_date` |
| Flags | `flags` |
| Supplier | `supplier` |
| Delivery Status | `delivery_date_status` |
| DDD Count | `ddd_count` |
| Set With | `set_with` (**not wired**) |
| Ordered QTY | `ordered_qty` |
| QTY Received | `qty_received` |
| Manual RW | `manual_rw` |
| Auto RW | `auto_rw` |
| Goods Received | `goods_received` |
| Order Date | `order_date` |
| Drop | `drop` |
| Collection | `collection` |
| PM Tags | `pm_tags` |
| Bulk Fabric | `bulk_fabric_approval` |
| PPS Receipt Date | `pps_receipt_date` |
| Order Type | `po_type` |

Sticky left (always visible): Checkbox · Expand chevron · Product Image · PO Number.
Sticky right (always visible): Actions (Report/Edit delay, Update, Logs).

Column picker shows two sections (**Standard** / **Additional**) and a "Reset to defaults" link.

---

## Main Office — Columns (Fixed)

Side drawer (PO Details). No column picker. Two scopes controlled by the New/Rep toggle in `MainOfficeKpiGrid`.

Key columns (both scopes):

| Column Label | Field Key | Notes |
|---|---|---|
| *(checkbox)* | — | |
| *(expand chevron)* | — | Opens `SubPoDestinationTable` |
| PO Number | `po_number` | With URGENT / NEEDS ATTENTION / RECEIVED / LATE / FUTURE badges |
| Style Color | `style_color` | |
| Rank | `po_rank` | Sub-PO rank within destination + style_color |
| Production Stage | `effective_dd_status` | `DdStatusBadge` |
| DDD Status | `current_status` | `StatusBadge` |
| Urgent Priority | `urgent_priority` | `PriorityBadge` |
| Urgency Reason | `urgency_reason_raw` | Orange pill (raw deduped reason, max 200ch truncated) |
| PU Tags | `pu_tag` | Amber "PU" pill when true |
| IND | `inv_days` | Color-coded: red < 5, amber < 14, gray otherwise |
| DD Manager | `dd_manager_name` | |
| Supplier | `supplier` | |
| Delivery Status | `delivery_date_status` | |
| Due Date | `due_date` | |
| Delayed DD | `effective_delayed_due_date` | |
| Final DD | `final_dd` | |
| Next Update | `effective_next_update` | |
| Days Late | `days_late_counting` | `DaysCell` (red > 3) |
| DD Reason | `ddd_reason` | `ReasonTag` |
| DDD Comment | `ddd_comment` | |
| DD Comment | `dd_comment_log` | |
| HOLD Age | `hold_age_days` | "Today" or "Nd ago" |
| Delay Response | `delay_response_comment` | |
| Last Comment (internal) | `internal_note` | |
| DDD Count | `ddd_count` | |
| PM Tags | `pm_tags_label` | `PmTagsPills` |
| **Missing Sizes** | `missing_sizes` | **Rep scope only** — purple badges |
| Actions | — | Sticky right · MessageSquare (respond) / Calendar (follow up) / StickyNote (internal note) / Zap (mark urgent) / Clock (logs) |

`isRepScopeTable = activeRole === 'main_office' && mainOfficeViewMode === 'Rep'`.

---

## Main Office KPI Dashboard — Three Zones

```
┌────────────────────────────────────────────────────────────────┐
│ ZONE 1 — MainOfficeKpiGrid (single zone, New/Rep toggle)       │
│ Toggle: [ New Orders | Rep Orders ]                            │
│ 11 clickable KPI cards in a 6-col × 2-row grid                 │
│ Sticky/collapsing strip when scrolled                          │
├────────────────────────────────────────────────────────────────┤
│ ZONE 2 — InsightsStrip (supplier/manager leaderboards)        │
├────────────────────────────────────────────────────────────────┤
│ ZONE 3 — FilterToolbar                                         │
└────────────────────────────────────────────────────────────────┘
```

### Zone 1 — MainOfficeKpiGrid

Component: `src/components/followup/MainOfficeKpiGrid.jsx`

Props:
- `rows` — all PO rows (pre-filter)
- `kpis` — server KPIs from `getFollowUpData`
- `viewMode` — `'New'` or `'Rep'`
- `onViewModeChange(mode)` — calls `handleMainOfficeViewModeChange` which resets filters to defaults and sets `orderType: [mode]`
- `supplierRegion` — `'CHINA'` | `'US'` | `'ALL'` (default `'CHINA'`)
- `activeOpKpi` — active card key (e.g. `'New:late'`)
- `onOpKpiClick(key, filters)` — applies a preset filter object to the table

**Sticky/collapse behaviour:** an IntersectionObserver sentinel collapses the grid into a horizontal-scrolling pill strip when scrolled past. A measured placeholder of the original height prevents scroll-jump flicker loops.

**KPI scoping:** all cards are scoped to the active `viewMode` (order type substring match — "new" / "rep") AND `supplierRegion` before counting.

#### Shared KPI cards (both views)

| ID | Label | Definition | Accent |
|----|-------|-----------|--------|
| `pending` | Pending | `current_status === 'HOLD'` | — |
| `late` | Late | `late_future === 'LATE'` | red |
| `not_updated` | Not Updated | `effective_next_update === today` AND no `dd_comment_log` entry from today | red (alwaysRed) |
| `current_col` | Current Collection | `late_future === 'LATE'` AND collection contains current month | amber |
| `will_miss` | Will miss collection | Current collection + LATE + `final_dd > EOM - 5 days` | red |
| `not_started` | Manufactured Not Started | `effective_dd_status` in `NOT_STARTED_DD_STATUSES` | amber |

The `urgents` card is **dropped on New view**, kept on **Rep view**.

#### New Orders — additional cards

| ID | Label | Definition | Accent |
|----|-------|-----------|--------|
| `fabric_pps_risk` | Fabric / PPS at Risk | `effective_dd_status` in `FABRIC_PPS_RISK_STATUSES` | red |
| `rework_repro` | Rework / Reproduction | `effective_dd_status` in `REWORK_REPRO_STATUSES` | red |
| `qc_over_3d` | QC > 3 days | `effective_dd_status` in `QC_STATUSES` AND `days_same_status > 3` | amber |
| `old_collection` | Old Collection | `isPreviousCollection(collection)` | amber |
| `drop_risk` | Drop Risk (< 7d) | `0 ≤ (drop − final_dd) < 7` | red |

Total New view: 6 shared (minus urgents) + 5 new-specific = **11 cards**.

#### Rep Orders — additional cards

| ID | Label | Definition | Accent |
|----|-------|-----------|--------|
| `urgents` | Urgents | `urgent === true` | red |
| `late_best_sellers` | Late Best Sellers | `is_best_seller === true` AND `late_future === 'LATE'` | red |
| `high_bno_low_otw` | High BNO - Low OTW | `bno_high_low_otw === true` | red |
| `empty_status` | Empty Status | `effective_dd_status` is null or `'Empty status'` | amber |
| `same_status_5d` | Same Status > 5D | `days_same_status > 5` | amber |

Total Rep view: 6 shared (with urgents) + 4 rep-specific = **11 cards**.

#### KPI preset filters (sample)

| KPI | Preset filters applied |
|---|---|
| `pending` | `orderType: [mode], status: 'HOLD'` |
| `late` | `orderType: [mode], lateFuture: ['LATE']` |
| `not_updated` | `orderType: [mode], nextUpdate: todayStr` (legacy key still passed; effective filter uses `nextUpdateFrom`/`To` chosen by KPI Cards handler) |
| `urgents` | `orderType: [mode], urgencyReason: ['Urgent']` |
| `current_col` | `orderType: [mode], collection: ['CURRENT'], lateFuture: ['LATE']` |
| `will_miss` | `orderType: [mode], collection: ['CURRENT_AT_RISK'], lateFuture: ['LATE']` |
| `not_started` | `orderType: [mode], ddStatus: ['NOT_STARTED']` |
| `fabric_pps_risk` / `rework_repro` / `qc_over_3d` | `ddStatus: ['FABRIC_PPS_RISK' / 'REWORK_REPRO' / 'QC_OVER_3D']` |
| `old_collection` | `collection: ['PREVIOUS']` |
| `drop_risk` | `dropRisk: true` |
| `late_best_sellers` | `priority: ['Best Seller'], lateFuture: ['LATE']` |
| `high_bno_low_otw` | `bnoHighLowOtw: true` |
| `empty_status` | `ddStatus: ['EMPTY']` |
| `same_status_5d` | `sameStatusOver5d: true` |

### Zone 2 — InsightsStrip

Component: `src/components/followup/InsightsStrip.jsx`. Collapsible leaderboard summary for supplier + manager performance. Opens `LeaderboardDrawer` for detailed rankings.

### Zone 3 — FilterToolbar

See "Filter Toolbar Layout" above.

---

## DD Team Manager / Employee KPI Dashboard

Component: `src/components/followup/KpiCards.jsx`.

Cards (manager & employee, varies by role):
- Pending / Total Pending / Urgent Pending (HOLD requests)
- Handled today (Approved / Rejected / Acknowledged)
- Not Updated — `effective_next_update === today` AND no log entry today
- Receiving Notice — `delivery_date_status` starts with "Receiving Notice"

Clicking a KPI applies a preset filter (see `handleKpiFilterClick` in `FollowUp.jsx`).

---

## Sub-PO Destination Table (expand row)

Component: `src/components/followup/SubPoDestinationTable.jsx`.

Shown when a row's expand chevron is clicked. Fetches per-destination breakdown via `getPoDetails`.

Columns: Destination (US/UK pill) · IND (per destination) · sizes (XS/S/M/L/XL/XXL) · Total · Shipping Method · Air OTW.

Destination labels are mapped: `Edikted` → `US` (pink), `EdiktedUK` → `UK` (blue).
IND color: red < 5, amber < 14, gray otherwise; `∞` for ≥ 9999.

---

## PO Details Drawer

Component: `src/components/followup/PoDetailsDrawer.jsx`. Opens on row click (Main Office and DD Team Manager).

Sub-blocks: HeroBlock · ProgressBlock · DelayBlock · MetaBlock · TimelineBlock · ReadinessBlock.

---

## Modals & Actions

### Row actions

**Main Office:**
- `MessageSquare` — Respond to DD delay (`DecisionModal`)
- `Calendar` — Follow up next update (`FollowUpNextUpdateModal`)
- `StickyNote` — Internal note (`InternalNoteModal`)
- `Zap` — Mark as urgent (toggles `marked_urgent` via `saveFollowUpAction` action_type `MARK_URGENT`; optimistic UI)
- `Clock` — View logs (`ActivityLogDrawer`)

**DD Team Manager / Employee:**
- Report delay / Edit delay (`LogDelayModal`)
- Update (`GeneralUpdateModal`)
- Clock — View logs (`ActivityLogDrawer`)

### Bulk action bar (floating, pink)

Visible when `selectedRows.size > 0`.

| Role | Actions |
|---|---|
| `main_office` | Respond · Follow up · Export · Clear |
| `dd_team_manager` / `dd_team_employee` | Report delay · Add update · Export · Clear |

### Modals
- `LogDelayModal` — single or bulk DDD update
- `GeneralUpdateModal` — single or bulk general update
- `DecisionModal` — single or bulk decision (APPROVED / REJECTED / ACKNOWLEDGED) with optional delay response comment
- `InternalNoteModal` — internal note (Main Office)
- `FollowUpNextUpdateModal` — set next update date (Main Office, single or bulk)
- `ActivityLogDrawer` — audit trail via `getPoActivityLog`

---

## Backend — saveFollowUpAction

Endpoint for all write actions. Supported `action_type` values:
- `DECISION` — write/update a DDD decision (APPROVED/REJECTED/ACKNOWLEDGED) + delay response comment
- `LOG_DELAY` — create/update a DDD_UPDATE
- `GENERAL_UPDATE` — create a GENERAL_UPDATE
- `INTERNAL_NOTE` — set `po_overrides.internal_note` (via latest DDD update)
- `FOLLOW_UP_NEXT_UPDATE` — set `po_overrides.next_update_date`
- `MARK_URGENT` — toggle `po_overrides.marked_urgent` + reason

Auto-approve logic: DDD updates that fall within a configurable threshold from original DD can be auto-approved (`AUTOMATICALLY` status).

---

## Backend — getPoDetails

Returns per-destination sub-PO breakdown for the expand row + drawer:
- `destinations[]` — `{ destination, sizes_by_size, shipping_method_names, air_otw, inv_days, ... }`
- Aggregate quantities and metadata for the PO Details drawer hero/progress/timeline blocks

---

## Backend — getPoActivityLog

Returns the audit trail for a PO (DDD updates, general updates, system events). Rendered in `ActivityLogDrawer`.

---

## Per-Table Custom Filter

Component: `src/components/followup/CustomFilterModal.jsx`.

A per-table advanced filter accessible from the table footer ("Filter" button). Supports multiple AND-combined rules across text / number / date / boolean operators. Rules persist for the duration of the session; cleared on role change.

Column schemas are defined per role in `FollowUpTable` (`CUSTOM_FILTER_COLUMNS`), with role-specific lists for Main Office / DD Team Manager / DD Team Employee.

---

## Active Filter Chip Formatters (Main Office advanced panel)

| Filter key | Chip format |
|---|---|
| `po` | `PO: {value}` |
| `style` | `Style: {value}` |
| `status` | `DDD: {label}` (mapped) |
| `urgencyReason` | `Urgent Priority: {N}` |
| `priorityUS` / `priorityUK` | `US Priority: {N}` / `UK Priority: {N}` |
| `supplier` | `Supplier: {N}` |
| `ddManager` | `Mgr: {N}` |
| `ddStatus` | `Production: {N}` |
| `archive` | `Archive` |
| `collection` | `Collection: {N}` |
| `orderType` | `Type: {values}` |
| `nextUpdateFrom` / `To` | `Next Upd ≥/≤ {date}` |
| `delayResponse` | `Delay: {truncated value}` |
| `deliveryStatus` | `Delivery: {N}` |
| `supplierRegion` | `Region: {label}` |
| `dropDateFrom` / `To` | `Drop ≥/≤ {date}` |
| `finalDdFrom` / `To` | `Final DD ≥/≤ {date}` |
| `delayDaysMin` / `Max` | `Delay ≥/≤ {N}d` |
| `shippedPctMin` / `Max` | `Shipped ≥/≤ {N}%` |
| `indMin` / `Max` | `IND ≥/≤ {N}d` |
| `missingSizes` | `Missing: {values}` |
| `shippingMethod` | `Shipping: {N}` |
| `lastUrgentComment` | `Comment: {truncated value}` |
| `pmTags` | `PM Tags: {N}` |

---

## CSV Export

`exportRowsToCSV(rows, filename)` exports the filtered (or selected) rows with columns:
PO Number, Style Color, Supplier, DD Manager, Status, Priority, Due Date, Delayed DD, Final DD, Days Late, DD Reason, DDD Comment, DD Status, Delivery Date Status, Response, Collection, Next Update, DDD Count.

---

## Role Persistence

- Active role is local component state; defaults: admin → `main_office`; otherwise first item from `user.roles[]` if set, else `user.role` if it matches a role, else `main_office`.
- DD Team Employee role auto-applies `ddManager: [user.full_name]` filter on activation and on KPI clicks.
- Main Office role auto-applies `orderType: [mainOfficeViewMode]` on activation and on view-mode change.

---

## Open Items

| # | Item |
|---|---|
| 1 | `set_with` — not currently returned by `getFollowUpData`. UI shows '—' in both the DD Team Manager column and the DD Team Employee table. |
| 2 | `urgent_priority_per_po` CTE depends on the optional `urgent_reasons_base` table; when absent, `urgent_priority` is null and the UI falls back to the normalized `urgency_reason_raw`. |
| 3 | Delivery Status default visibility for DD Manager — defaulted to **off** (additional column). |
| 4 | "Needs your attention" computation lives in JS (`computeNeedsAttention`) and uses fields fetched by the main SQL query rather than aliasing from `urgent_orders_base_mv`. Kept in sync with `urgents_view` WHERE conditions. |