# Edikted Follow-Up — Product Specification

**Version:** Current (June 2026)
**Stack:** React 18 + Vite + Tailwind + shadcn/ui · Base44 BaaS · External Postgres (Edikted DB via `EDIKTED_DB_URL`)
**Brand:** Edikted Pink (`#E31B7F`) · Inter (body/UI) · JetBrains Mono (numbers, codes, dates) · Pink-forward fashion-tech aesthetic

---

## 1. Purpose

A unified operations console for tracking purchase-order (PO) delivery health across Edikted's supply chain. The app answers three questions at a glance:

1. **What is late, urgent, or stuck?** → KPI grids surface problems immediately.
2. **What did the DD team say about it?** → Tables show the latest status, comment, delay request, and history.
3. **What should Main Office decide?** → HOLD requests sit in an actionable queue with Approve / Acknowledge / Reject buttons.

The same dataset feeds **three personas**, each with a tailored KPI grid, filter set, table layout, and action surface.

---

## 2. Roles & Permissions

### 2.1 Role list
| Role key | Display name | Granted to |
|---|---|---|
| `main_office` | Main Office | Decision-makers reviewing DD team requests |
| `dd_team_manager` | DD Team Manager | Manages the whole DD team — sees every PO |
| `dd_team_employee` | DD Team Employee | Owns a subset of POs — sees all but auto-filtered to own name |

Admins (User.role = `admin`) can switch role from the header dropdown (every role available). Non-admins see only the roles listed in their `User.roles[]` array (falls back to legacy single `User.role`).

### 2.2 Per-role differences (summary table)

| Capability | Main Office | DD Manager | DD Employee |
|---|---|---|---|
| KPI grid | `MainOfficeKpiGrid` (6×2 + New/Rep toggle + sticky-on-scroll) | `KpiCards` — 7 cards | `KpiCards` — 4 cards (scoped to user) |
| Insights strip | ✅ (suppliers + managers) | ❌ | ❌ |
| HOLDs Responsibility card | ✅ (in KPI grid) | ❌ | ❌ |
| Filter toolbar | Primary + Advanced (full set) | Simplified inline 9-field strip | Simplified inline 9-field strip |
| DD Manager filter default | empty | empty | pre-filled to logged-in user |
| Table layout | Main Office (26-ish cols, +1 missing-sizes in Rep) | Manager (4 fixed + 29 toggleable, picker persisted in localStorage) | Employee (4 fixed + 31 always-visible) |
| Row click → PO Details drawer | ✅ | ❌ (drawer disabled — `onPoDetails` not passed) | ❌ |
| Expandable sub-PO row | ❌ | ✅ | ✅ |
| Row actions | Approve / Acknowledge / Reject / Internal note / Logs | Report/Edit Delay / General Update / Logs | Report/Edit Delay / General Update / Logs |
| Bulk Action Bar | Approve All / Acknowledge All / Reject All / Export | Report Delay (bulk) / General Update (bulk) / Export | Report Delay (bulk) / General Update (bulk) / Export |
| Archive toggle | ❌ | ✅ (advanced filter panel) | ❌ |
| Last Comment (internal) column | ✅ | ❌ | ❌ |
| HOLD Age column | ✅ | ❌ | ❌ |
| IND (Inventory Days) column | ❌ *(moved to sub-PO row — see §10.6)* | ❌ | ❌ |
| PO Rank column | ✅ | ❌ | ❌ |
| Sub-PO row (2-line: per-destination data + actions) | ✅ | ✅ | ✅ |

---

## 3. Data Model

### 3.1 External source — Edikted DB (Postgres)
Most read-only PO data (style, supplier, quantities, dates, urgency, production stage, destinations, sizes, OTW, GFS, shipments) lives in Edikted's production Postgres. The backend joins ~10 tables in `getFollowUpData`:
`purchase_orders` · `po_urgent_status` · `po_types` · `suppliers` · `dd_managers` · `collections` · `shipment_methods` · `pm_tags` · `destinations`.

### 3.2 Base44 entities

**`dd_updates`** — append-only event log. Two types:

- **`DDD_UPDATE`** — a delay request:
  `previous_due_date`, `new_due_date`, `reason[]` (multi-select from `DD_REASONS_BY_GROUP`), `reason_other_text`, `responsibility` (derived), `ddd_comment`, `status` (HOLD / AUTOMATICALLY / APPROVED / ACKNOWLEDGED / REJECTED), `cumulative_delay_days`, `decision_at`, `decision_by_email`, `delay_response_comment`, `internal_note`.

- **`GENERAL_UPDATE`** — a status check-in:
  `dd_status`, `general_comment` (closed list `DD_COMMENT_OPTIONS` + Other), `general_comment_other_text`, `next_update_date`.

Common fields: `po_number`, `actor_email`, `type`.

**`po_overrides`** — one row per PO, read-cache of the latest effective state:
`delayed_due_date`, `dd_status`, `next_update_date`, `dd_status_changed_at`, `last_ddd_update_id`, `last_general_update_id`.

**`sub_po_notes`** *(new — supports sub-PO actions, see §10.6)* — one row per sub-PO, holds the DD team's internal annotations:
`sub_po_number`, `po_number`, `follow_up_date` (internal, not exposed to Main Office decisions), `internal_comment`, `marked_urgent` (boolean override on top of the source-system `urgent`), `marked_urgent_by_email`, `marked_urgent_at`, `last_updated_by_email`.

Sub-PO actions only **augment** the read-only Edikted DB data — they never write back to the source `sub_po_view`.

### 3.3 Status enum
Defined in `lib/followUpConstants.js → STATUS_ENUM`:
- `HOLD` — Awaiting main office decision (amber badge)
- `AUTOMATICALLY` — Auto-approved (non-urgent, ≤ 3 days delay; gray badge)
- `APPROVED` — Approved — delay justified (green badge)
- `ACKNOWLEDGED` — Accepted — no other choice (teal badge)
- `REJECTED` — Delay not acceptable (red badge)

### 3.3.1 Urgent flag — how the "URGENT" tag works today

Two independent boolean fields drive the "URGENT" pill that shows under PO Number today:

1. **`po_view.urgent`** — set in the source Edikted system on the **PO level**. Boolean.
2. **`sub_po_view.urgent`** — set on the **sub-PO level** (per destination). Boolean.

The PO-level pill shown in the table is `!!po.urgent` (the PO-level flag). Sub-PO–level urgency is currently only surfaced inside `getPoDetails` (used by `PoSizeBreakdown` to color the destination chip).

In addition, `po_urgent_status.reason` (free-text per PO) — values like `"Best Seller"`, `"URGENT"`, `"O Order"` — provides a richer *priority* signal that gets normalized into `us_priority` / `uk_priority` per destination. **The legacy "Urgency Reason" column (string-multi-value, e.g. `"US-Best Seller, UK-Sizes Inv Days"`) is being replaced by the computed `urgent_priority` field — see §3.3.2.**

**New (per §10.7):** Main Office can manually mark a whole PO as urgent (PO-level override). This writes to `po_overrides.marked_urgent` and forces `urgent_priority` to `"MANUAL"` regardless of the source-system computation.

### 3.3.2 Urgent Priority — new PO-level computed field (Main Office only)

The "Urgency Reason" column on the Main Office table is replaced by a single computed **`urgent_priority`** label per PO, derived in `getFollowUpData` from the `urgent_reasons_base` view (joined on `po_number`). The computation matches the canonical Edikted formula:

```sql
CASE
  WHEN urb.po_type IN ('WR','R','SWIMR')
       AND urb.open_quantity >= 1000
       AND urb.published >= (CURRENT_DATE - INTERVAL '45 days')
       AND urb.sc_ind <= 15                            THEN 'BEST SELLER NEW'
  WHEN urb.po_type IN ('WR','R','SWIMR')
       AND urb.open_quantity >= 1500
       AND urb.all_sales > 10000
       AND urb.sc_ind <= 15                            THEN 'BEST SELLER OLD'
  WHEN urb.po_type IN ('WR','R','SWIMR')
       AND urb.sku_min_ind <= 5                        THEN
         CASE WHEN urb.sku_max_ind <= 5 THEN 'SOLD OUT'
              ELSE 'MISSING SIZES' END
  WHEN urb.pu_tag = true                               THEN 'MANUAL'
  WHEN urb.urgent_tagged = true                        THEN urb.sc_pm_tags
  WHEN urb.po_type IN ('WR','R','SWIMR')               THEN 'URGENT'
  WHEN urb.po_type IN ('O','SWIM')                     THEN
         concat('Drop',
           CASE WHEN urb.special_collection IS NULL THEN ' '
                ELSE concat(' ', urb.special_collection, ' ') END,
           urb.drop_date)
  WHEN urb.days_in_risk_status > 5                     THEN 'Risk in Fabric/PPS'
  ELSE NULL
END AS urgent_priority
```

**Possible values & badge colors** (rendered by `PriorityBadge`):
| Value | Color | Trigger |
|---|---|---|
| `BEST SELLER NEW` | pink | Rep PO, ≥1000 open, published < 45d, SC IND ≤ 15 |
| `BEST SELLER OLD` | pink | Rep PO, ≥1500 open, > $10k sales, SC IND ≤ 15 |
| `SOLD OUT` | red | Rep PO, all SKUs at min ≤ 5 IND |
| `MISSING SIZES` | purple | Rep PO, some SKUs at min ≤ 5 IND |
| `MANUAL` | amber | PU tag = true (manual override from PU team or §10.7 PO mark) |
| `<pm_tags string>` | amber | `urgent_tagged = true` — shows the PM tag text directly |
| `URGENT` | amber | Rep PO, no other rule matched |
| `Drop [collection] [date]` | teal | Order PO ('O'/'SWIM'), shows the drop date |
| `Risk in Fabric/PPS` | red | Stuck > 5 days in risk status |
| `null` / empty | gray "Normal" | No rule matched |

**Scope:**
- **Main Office view only** — this column replaces "Urgency Reason" in the Main Office table.
- **DD Manager / DD Employee views**: unchanged — they continue to show `urgency_reason_raw` (per the existing column "Urgency Reason" in their layouts is NOT present today; they show `flags = URGENT/REVIEW` only).
- The filter toolbar's "Urgency Reason" multi-select is replaced by an **"Urgent Priority" multi-select** with the closed list above (Main Office filter only).

### 3.4 Auto-approval rule
At delay-request submission:
- If PO is non-urgent **AND** new_due_date is ≤ 3 days past previous due_date → status = `AUTOMATICALLY` (no Main Office decision needed).
- Otherwise → status = `HOLD` and lands in Main Office queue.

### 3.5 Responsibility derivation
Each delay reason maps to `OTHER` / `EDIKTED` / `SUPPLIER` (via `REASON_TO_RESPONSIBILITY`):
- **OTHER**: Force Majeure, DD Temporary
- **EDIKTED**: PPS Approval Late, Fabric Approval Late, QC Approval Late, Wrong Packing Materials, Labels Arrive Late
- **SUPPLIER**: QC Reproduction, QC ReWork, PPS Submission Late, Fabric Issue, Production Capacity Issue, Technical problem – washing / printing / sewing-handmade, Packing Issue, Special details late

When multiple reasons are selected, **worst-case wins: SUPPLIER > EDIKTED > OTHER**.

### 3.6 Production stages (DD Status)
Closed list of 20 stages (`DD_STATUS_OPTIONS`):
Empty status · Order Fabric · PPS At Risk · PPS Send To Approval – Pre Prod · PPS Send To Approval – Post Prod · Ready For Production · In Production – Cutting · In Production – Knitting · In Production – Sewing · In Production – Washing · In Production – ACC · Reproduction · Supplier Self Inspection · QC in factory · QC in Office · Under Packing in Factory · Rework · OTW to Office · Partially Received · Goods Received.

Grouped buckets used by KPIs and filters:
- **NOT_STARTED_DD_STATUSES** — production hasn't truly begun (empty/PPS/Fabric/Order Fabric/Ready For Production stages)
- **FABRIC_PPS_RISK_STATUSES** — Fabric/PPS approval risk stages
- **REWORK_REPRO_STATUSES** — Rework, Reproduction
- **QC_STATUSES** — QC in factory, QC in Office (used with > 3 days threshold)

---

## 4. Backend Functions

| Function | Purpose |
|---|---|
| `getFollowUpData` | Returns `{ rows, kpis }`. Joins Edikted DB + `po_overrides` + latest `dd_updates`. Computes ~25 virtual fields per row (see §5). Server-side KPI aggregation. |
| `getPoDetails` | Per-PO drawer data: full style/quantity/destination breakdown, OTW, GFS, replenishment, shipment methods. |
| `getPoActivityLog` | Full chronological update history for one PO (used by Activity drawer). |
| `saveFollowUpAction` | **Single write endpoint** for all mutations: `DDD_UPDATE`, `GENERAL_UPDATE`, `DECISION`, `INTERNAL_NOTE`. Supports single + bulk (frontend loops on the same endpoint). Updates `dd_updates` + `po_overrides` atomically. Records `actor_email`. |

All functions are user-scoped (`createClientFromRequest`). Frontend never touches Edikted DB directly.

---

## 5. Computed / Virtual Row Fields

The backend hydrates each row with derived fields that drive KPIs, filters, and table cells:

| Field | Description |
|---|---|
| `effective_dd_status` | overrides ▸ falls back to base PO data |
| `effective_delayed_due_date` | overrides ▸ falls back |
| `effective_next_update` | overrides ▸ falls back |
| `current_status` | latest DDD_UPDATE.status (null if PO never entered delay workflow) |
| `final_dd` | effective delayed DD or original due date, whichever is later |
| `days_late_counting` | final_dd vs. original due_date |
| `late_future` | `LATE` / `FUTURE` / `RECEIVED` |
| `countdown` | days from today to final_dd (negative = past due) |
| `days_same_status` | days since `dd_status_changed_at` |
| `hold_age_days` | days a HOLD has been awaiting decision (Main Office) |
| `urgency_reason_raw` | raw text from `po_urgent_status` table |
| `us_priority` / `uk_priority` | per-destination tag: BEST_SELLER / URGENT / NORMAL |
| `inv_days` | Inventory Days = (stock + air OTW) ÷ (virtual7d / 7) — **rendered on the sub-PO row (per destination), not on the PO row** |
| `air_otw` | Air OTW quantity — **rendered on the sub-PO row (per destination)** |
| `shipping_method_names` | Array of shipping method names — **rendered on the sub-PO row (per destination)** |
| `bno_high_low_otw` | boolean: demand high vs. OTW low |
| `is_best_seller`, `urgent` | flag booleans |
| `po_rank` | sub-PO order within same destination + style_color group, ranked by delayed/original DD |
| `dd_comment_log` | recent general updates as `[{date, text}]` |
| `pm_tags_label` | comma-joined PM tag tokens |
| `missing_sizes` | array of size codes still owed (Rep view) |
| `shipping_method_names` | array of method names from `shipment_methods` (Rep view) |
| `shipped_percent` | qty_received ÷ ordered_qty |
| `ddd_count` | how many times the delivery date has been changed |
| `delivery_date_status` | text from base PO data |

---

## 6. Page Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ Mockup banner — ⚠️ This is a mockup …                             │
├────────────────────────────────────────────────────────────────────┤
│ Title  "Follow Up"           [Role ▾] [Export] [Refresh] [User ▾] │
│ "Working as <Role>"                                               │
├────────────────────────────────────────────────────────────────────┤
│ ZONE 1 — KPIs (varies per role)                                   │
├────────────────────────────────────────────────────────────────────┤
│ ZONE 2 — Insights strip (Main Office only, collapsible)           │
├────────────────────────────────────────────────────────────────────┤
│ ZONE 3 — Filter toolbar (primary + advanced)                      │
├────────────────────────────────────────────────────────────────────┤
│ ZONE 4 — Data table (role-specific columns)                       │
│   Sticky header · Sticky left cluster · Sticky right Actions      │
│   Footer: row count · Load more · Show all · Custom Filter button │
└────────────────────────────────────────────────────────────────────┘
[BulkActionBar] — floating bottom bar when rows are selected
```

---

## 7. KPIs

### 7.1 Main Office — `MainOfficeKpiGrid`

**View mode toggle** at the top of the grid: **New** / **Rep**.
Switching modes auto-applies an `orderType` filter to the table — i.e. the KPIs and the table always stay in sync.

**Sticky behaviour**: when the user scrolls past the grid, it sticks to the top in a compact one-row flex layout (the placeholder div preserves the original height to prevent scroll-flicker loops).

All cards are **scoped to: (a) the selected view (New/Rep) AND (b) the active Supplier Region** (defaults to China). Click toggles the card's preset filter on/off.

**Cards shared by both views** (always present, 7 cards):
1. **Pending** — POs in HOLD status. *Filter: `status=HOLD`*
2. **Late** — POs with `late_future = 'LATE'`. *Filter: `lateFuture=[LATE]`*
3. **Not Updated** (always-red border) — Next Update = today AND no log entry written today. *Filter: `nextUpdate=today`*
4. **Urgents** — Urgent-flagged POs (hidden in New view by request)
5. **Current Collection** — Late POs in this month's collection
6. **Will Miss Collection** — Current collection at risk: `final_dd > EOM - 5`
7. **Manufactured Not Started** — `NOT_STARTED_DD_STATUSES`

**New view — extra 5 cards** (replaces Urgents):
- Fabric/PPS at Risk · Rework/Reproduction · QC > 3 days · Old Collection · Drop Risk (< 7d to drop date)

**Rep view — extra 4 cards** (on top of shared):
- Late Best Sellers · High BNO – Low OTW · Empty Status · Same Status > 5D

### 7.2 DD Team Manager — `KpiCards`
Seven cards spread evenly:
1. **New pending (today)** — HOLDs created today
2. **Total pending** — all HOLDs system-wide
3. **Urgent pending** (red) — urgent HOLDs
4. **Acknowledged** (green) — approved + acknowledged
5. **Rejected today** (red)
6. **Not Updated** (always-red border)
7. **Receiving Notice** (amber) — POs with delivery status update

Card click toggles its preset filter.

### 7.3 DD Team Employee — `KpiCards`
Four cards, **all scoped to the logged-in user's name** (regardless of the active DD Manager filter):
1. **Pending** (red) — my HOLDs awaiting decision
2. **Acknowledged** (green) — my approved + acknowledged
3. **Rejected** (red) — rejected by main office
4. **Receiving Notice** (amber) — delivery status updated

### 7.4 HOLDs by Responsibility card
Renders inside the Main Office KPI grid (`HoldsResponsibilityCard`). Computes responsibility split (OTHER / EDIKTED / SUPPLIER) for all currently-HOLDing POs and shows a stacked-bar mini-chart with counts and percentages.

---

## 8. Insights Strip (Main Office only)

`InsightsStrip` — a collapsible card between KPIs and filters. Aggregates non-US-supplier rows into supplier and manager stats:

**Supplier insights:**
- Top late supplier (by late%, min 5 POs)
- Most on-time supplier (by ontime%, min 5 POs)
- Biggest workload (by total POs)
- Count of suppliers above 30% late (badge shown even when collapsed)

**DD Manager insights:**
- Top late (by absolute late count)
- Top on-time (by ontime%)
- Most urgent load (by urgent count)

Clicking any insight opens `LeaderboardDrawer` with the full ranked list.

---

## 9. Filter Toolbar

`FilterToolbar` exists in two modes depending on role.

### 9.1 Main Office / DD Manager — primary + advanced

**Primary bar (always visible, single row):**
PO Number · Status · Style Color · Urgency Reason (multi) · Supplier Region · `+ Advanced` toggle · Reset

**Status options:** All · Pending (HOLD) · Handled · Approved · Rejected · Acknowledged · Auto-approved.

**Supplier Region (always primary):** **China (default)** / US / All. Uses `US_SUPPLIERS = ['LUCENTING', 'LUCENTINC', 'KILAT']` substring match.

**Advanced panel (collapsible):**
- **Categories**: DD Manager (multi) · Supplier (multi) · Production Stage (multi, incl. "Empty status" sentinel) · Order Type · Collection · US Priority · UK Priority · Delay Response (text)
- **Rep-only categories**: Missing Sizes · Shipping Method · Last Urgent Comment (text)
- **Date ranges**: Final DD · Drop Date *(New only)* · Next Update
- **Numeric ranges**: Delay Request days · Shipped % *(New only)* · IND *(Main Office only)*
- **Toggles** (DD Manager only): Archive (POs that never entered HOLD workflow)
- **Active filter chips** render under the panel — click to dismiss.

### 9.2 DD Employee / DD Manager — simplified inline strip
A single-row grid of 9 filters with no advanced panel:
PO Number · Supplier · Style Color · DD Manager · Next Update (range) · Production Stage · Supplier Region (default China) · Collection · PM Tags · Reset

### 9.3 KPI-driven virtual filters
KPI clicks set hidden flags on the filter state: `staleStatus`, `late7Plus`, `bestSeller`, `highBno`, `dropRisk`, `lateFuture`, `bnoHighLowOtw`, `sameStatusOver5d`. These filter the rows but don't render as chips (the KPI card itself is the visual indicator).

### 9.4 Urgency Reason normalization
Raw values from `po_urgent_status` (e.g. `"UK-O Order,US-O Order"`) get split on `,;|` and stripped of `US-` / `UK-` prefixes so US+UK variants collapse into one category. Options are sorted by frequency and shown as `"Category (count)"`.

---

## 10. Tables — `FollowUpTable`

All three layouts share one shell:
- Sticky header (sortable, resizable per-column)
- Sticky-left cluster: ☐ checkbox · ▸ expand · img thumbnail · PO Number
- Sticky-right Actions column with shadow
- Rejected rows have a red row background
- Pagination: PAGE_SIZE = 100 with **Load more** / **Show all** buttons in the footer
- Per-row click → opens PO Details drawer (Main Office only)
- Footer **Custom Filter** button (see §11)

### 10.1 Main Office view

**Columns** (left to right):
☐ · ▸ · img · **PO Number** · Style Color · Rank · Production Stage · DDD Status · **Urgent Priority** *(was: Urgency Reason — see §3.3.2)* · DD Manager · Supplier · Delivery Status · Due Date · Delayed DD · Final DD · Next Update · Days Late · DD Reason · DDD Comment · DD Comment · HOLD Age · Delay Response · **Last Comment (internal)** · DDD Count · PM Tags · *Missing Sizes (Rep scope only)* · Actions

> **Note 1**: IND is no longer a PO-level column. It now lives on the per-destination sub-PO row inside the expand area (see §10.6) because IND is computed per destination, not per PO.
>
> **Note 2**: The legacy "Urgency Reason" column (string-multi-value from `po_urgent_status.reason`) is replaced by **"Urgent Priority"** — a single computed label per PO using the canonical formula in §3.3.2. The column header tooltip shows the rule that triggered the value.

**Actions per row:**
- ✅ Approve (`onDecide(po, 'APPROVED')`)
- ℹ️ Acknowledge (`onDecide(po, 'ACKNOWLEDGED')`)
- ❌ Reject (`onDecide(po, 'REJECTED')`)
- 💬 Internal note (`onInternalNote(po)`)
- ⚡ **Mark / unmark as Urgent** *(new — see §10.7)*
- 🕐 View Logs (`onViewLogs(po)`)

The PO row is **expandable** (Main Office only): clicking ▸ opens the per-destination sub-PO table — see §10.6. Row click still opens the PO Details drawer; the ▸ toggle is independent.

### 10.2 DD Team Manager view

**Fixed columns (always visible):** ☐ · ▸ · img · **PO Number**

**Toggleable columns** (29 total, via `ColumnPicker` persisted in localStorage `ddmgr-opt-cols`):

*Standard — ON by default (12):*
Style Color · Production Stage · DD Comment · DDD Status · PO Response · DDD Reason · DDD Comment · Delayed DD · CountDown · DD Manager · Days Same Status · Next Update

*Additional — OFF by default (17):*
Original DD · DD Date · Flags · Supplier · Delivery Status · DDD Count · Set With · Ordered QTY · QTY Received · Manual RW · Auto RW · Goods Received · Order Date · Drop · Collection · PM Tags · Bulk Fabric · PPS Receipt Date · Order Type

**Column picker UI:** Standard / Additional grouped checkboxes, "Reset to defaults" button. Shows hidden count in the trigger button.

**Actions per row:**
- 🩷 Report delay / Edit delay (button label flips based on whether `effective_delayed_due_date` already exists)
- Update (general update)
- 🕐 View Logs

**Expandable row** → renders the new **Sub-PO Table** (see §10.6).

### 10.3 DD Team Employee view

**Fixed columns (always visible):** ☐ · ▸ · img · **PO Number**

**Always-visible columns (31, no picker):**
Style Color · Production Stage · DD Comment · DDD Status · PO Response · DDD Reason · DDD Comment · Original DD · Delayed DD · DD Date · CountDown · Flags · Supplier · Delivery Status · DD Manager · DDD Count · Set With · Ordered QTY · QTY Received · Manual RW · Auto RW · Goods Received · Order Date · Days Same Status · Next Update · Drop · Collection · PM Tags · Bulk Fabric · PPS Receipt Date · Order Type

**Auto-scoping**: when the role is selected, the DD Manager filter pre-fills with the logged-in user's `full_name`. The user can clear it to see other people's POs (read-only — no permission gating in UI).

**Actions per row:** identical to Manager view (Report delay / Update / Logs).

**Expandable row** → renders the new **Sub-PO Table** (see §10.6).

### 10.4 Sorting & resizing
- Click any column header to sort asc → desc → none. Numeric sort for number fields, locale-numeric string sort otherwise.
- Drag the right edge of a column header to resize. Widths kept in component state (not persisted).

### 10.5 Tooltips
Each column header has a one-line tooltip on hover (`TIPS` map) — e.g. `IND`: *Inventory Days = (stock + air OTW) ÷ (virtual7d / 7)*; `HOLD Age`: *Days the delay request has been awaiting Main Office decision*; `Urgent Priority`: *Computed from urgent_reasons_base — see §3.3.2*.

### 10.6 Expanded sub-PO view — one row per destination

Replaces the legacy `PoSizeBreakdown` cards with a **single compact table** inside the expand area. **One row per destination/sub-PO** (typically two rows: US + UK). Columns:

```
┌────────────┬─────┬────┬────┬────┬────┬────┬─────┬──────────────────┬─────────┐
│ Destination│ IND │ XS │ S  │ M  │ L  │ XL │ XXL │ Shipping Method  │ Air OTW │
├────────────┼─────┼────┼────┼────┼────┼────┼─────┼──────────────────┼─────────┤
│ [US]       │ 18d │ 30 │ 60 │ 80 │ 60 │ 30 │ 10  │ Air Express, Sea │  50     │
│ [UK]       │ 22d │ 20 │ 40 │ 60 │ 40 │ 20 │ 10  │ Sea Freight      │   0     │
└────────────┴─────┴────┴────┴────┴────┴────┴─────┴──────────────────┴─────────┘
```

**Columns:**
| Column | Source | Notes |
|---|---|---|
| **Destination** | `sub_po_view.destination` → `shipment_destination.destination` | Pink chip, "US" / "UK" / etc. |
| **IND** (Inventory Days) | `repeats_sc_united_history."Inv Days"` joined on style_color + destination | Color-coded: red < 5 · amber < 14 · normal ≥ 14 · `∞` when sufficient indefinitely. **Per destination, not per PO.** |
| **Sizes breakdown** (one column per size in `SIZE_ORDER`) | `pod_view.ordered_qty` per SKU, summed per size | Shows ordered qty per size. Empty cell = no orders for that size. |
| **Shipping Method** | `shipment_methods.method` resolved from `sub_po_view.shipping_method` | Comma-joined when multiple. |
| **Air OTW** | `sub_po_view.qty_otw_air` (total per sub-PO) | Integer, right-aligned. |

**Scope:** Same content for all three roles (Main Office / DD Manager / DD Employee). No per-destination action buttons in this view — the sub-PO–level annotations (`follow_up_date`, `internal_comment`, `marked_urgent`) from earlier drafts are **deferred** and not included in this iteration.

**Backend additions to support 10.6:**
- `getPoDetails` extended to return per-destination `{ destination, sub_po_number, inv_days, sizes: { XS: 30, S: 60, … }, shipping_method_names, air_otw }`.
- IND join: `repeats_sc_united_history` ("Inv Days") on `style_color`, scoped per destination if the source supports it; otherwise reuse the PO-level `inv_days` as a fallback for all destinations.

### 10.7 Mark as Urgent — PO-level action (Main Office only)

A new manual override that lets Main Office flag a whole PO as urgent regardless of the computed `urgent_priority` from §3.3.2.

**Trigger:** ⚡ icon button in the Main Office row Actions cluster (between 💬 Internal Note and 🕐 Logs).

**Behaviour:**
- Click opens `MarkUrgentConfirmModal` (see §12) with a confirm prompt and optional reason text.
- On confirm, writes to `po_overrides`:
  - `marked_urgent: boolean` (true = mark, false = unmark)
  - `marked_urgent_by_email: string`
  - `marked_urgent_at: datetime`
  - `marked_urgent_reason?: string` (optional, max 200 chars)
- The row's **`urgent_priority` becomes `"MANUAL"`** when `marked_urgent = true`, overriding any computed value. Unmarking restores the source-computed value.
- The ⚡ icon button is **filled pink** when `marked_urgent = true` and **outline gray** otherwise — gives Main Office a quick visual of which POs they themselves have flagged.

**Entity update:** `po_overrides` schema gains three new optional fields:
- `marked_urgent` (boolean)
- `marked_urgent_by_email` (string)
- `marked_urgent_at` (datetime)
- `marked_urgent_reason` (string)

**Backend:** `saveFollowUpAction` gets a new `action_type = 'MARK_URGENT'` with payload `{ po_number, marked_urgent, marked_urgent_reason? }`. Upserts the `po_overrides` row, sets `actor_email`, and timestamps the change. The next `getFollowUpData` call reflects the new state immediately (no separate refresh needed).

**DD roles:** the ⚡ button is **not rendered** for DD Manager or DD Employee — this is a Main Office–only capability per the requirement.

---

## 11. Custom Filter Modal

Footer button **"Filter"** opens `CustomFilterModal`, anchored above the button (positions `bottom: viewport - anchor.top + 8px` and `right` to match the anchor):

- Build multiple rules: each rule is **(Column, Operator, Value)**. Combined with implicit AND.
- Operators per column type:
  - **text** — includes / does not include / is / is not / is empty / is not empty
  - **number** — = / ≠ / > / ≥ / < / ≤ / is empty / is not empty
  - **date** — is / before / after / is empty / is not empty
  - **boolean** — is true / is false
- Dropdowns auto-flip up when there's no room below.
- Footer: **Clear filters** (left) · Cancel · **Apply** (right).
- Active rule count shown on the trigger button.
- **Filters reset when role changes** (the column schemas differ per role — see `CUSTOM_FILTER_COLUMNS`).

Per-role column schemas in `CUSTOM_FILTER_COLUMNS`:
- **main_office**: 23 fields (PO/style/stage/DDD status/urgency/IND/manager/supplier/dates/days late/reason/comments/HOLD age/response/internal note/DDD count/PM tags/collection/order type)
- **dd_team_manager**: 29 fields (all manager columns above)
- **dd_team_employee**: same 29 fields as manager

---

## 12. Modals & Drawers

| Component | Trigger | Behaviour |
|---|---|---|
| **`LogDelayModal`** | DD Manager/Employee "Report delay" / "Edit delay" buttons; Bulk Action Bar "Report Delay" | Multi-select reasons grouped by Other/Edikted/Supplier, "Other (custom)" with free text. Required: delayed DD (must be after original Due Date — single mode), at least one reason, comment. Bulk: same form applied to all selected POs (loops one save per PO). |
| **`GeneralUpdateModal`** | DD Manager/Employee "Update" button; Bulk Action Bar "General Update" | Production stage (or "No change") + template-driven comment (`STATUS_COMMENT_TEMPLATES` by chosen stage; templates contain `[date]` / `[X/Y]` placeholders to fill) + Next Update date. Next Update capped at **5 days from today if any selected PO is urgent, else 7 days**. Warns if `[` placeholder remains in comment. |
| **`DecisionModal`** | Main Office row Approve / Acknowledge / Reject buttons; Bulk Action Bar Approve/Acknowledge/Reject All | Single decision (`APPROVED` / `ACKNOWLEDGED` / `REJECTED`) + optional preset (`DELAY_RESPONSE_OPTIONS`: Please send via email · Push to send XS earlier · Push to send S earlier · Push to advance DD for UK / US qty · Shorten DD · Send partial qty · Send on [date] · Other). **Comment is required for REJECTED**. Detects status override (changing from APPROVED to REJECTED, etc.) and shows a confirmation message. |
| **`InternalNoteModal`** | Main Office row 💬 button | Edit/save private note attached to the latest DDD_UPDATE. **Not visible to DD team** in logs or columns. |
| **`ActivityLogDrawer`** | Row 🕐 Logs button; PO Number click in any table | Right-side drawer (`PoActivityLog`). Chronological history of all updates: DDD_UPDATEs (with reason, comment, decision badge), GENERAL_UPDATEs (stage, comment, next update). Internal notes shown only to `main_office` role. |
| **`PoDetailsDrawer`** | Row click (Main Office only) | Right-side drawer with sub-blocks: Hero (PO info + thumb) · Progress (qty bars per destination) · Delay (history of DDD_UPDATEs) · Meta (collection/order type/drop/dates) · Timeline (all events) · Readiness (production stage timeline). Loads from `getPoDetails`. |
| **`LeaderboardDrawer`** | Click any row in Insights strip | Right-side drawer with full ranked list of suppliers or managers by the chosen metric (late% / ontime% / workload / urgent count). |
| **`MarkUrgentConfirmModal`** *(new — Main Office only — see §10.7)* | Main Office row ⚡ button | Single-click confirm: "Mark this PO as urgent?" (or "Remove urgent mark?" if already marked). On confirm, writes `po_overrides.marked_urgent` boolean + actor email + timestamp. Optional reason text (max 200 chars) stored in `po_overrides.marked_urgent_reason`. |
| **`BulkActionBar`** | Appears when ≥ 1 row selected | Floating bottom bar showing selection count, Clear button, role-specific bulk action buttons, and Export Selected. |

---

## 13. Header & User Menu

- **Title**: "Follow Up" with "Working as <Role>" subtitle.
- **Role switcher**: dropdown showing roles available to the user. Admins see all three.
- **Export button**: downloads CSV of current filtered rows.
- **Refresh button**: re-runs `getFollowUpData`.
- **User menu**: avatar with first letter + name → dropdown shows full name, email, role, and Log out.

CSV columns: PO Number · Style Color · Supplier · DD Manager · Status · Priority · Due Date · Delayed DD · Final DD · Days Late · DD Reason · DDD Comment · DD Status · Delivery Status · Response · Collection · Next Update · DDD Count.

---

## 14. Authentication

Uses Base44's built-in auth pages **without customization**:
- `/login` · `/register` · `/forgot-password` · `/reset-password`
- After login users land on `/follow-up` (also reachable as `/`).
- `AuthContext` provides `user`, `isAuthenticated`, `isLoadingAuth`, `logout`. Auth pages render before the loading spinner clears.
- `ProtectedRoute` guards `/` and `/follow-up`; unauthenticated visits redirect to `/login`.
- `UserNotRegisteredError` screen renders when `authError.type === 'user_not_registered'`.

User entity carries built-in fields (`id`, `email`, `full_name`, `role`) and an optional custom `roles[]` array.

---

## 15. Design System

### 15.1 Colors
- **Primary**: Edikted Pink `#E31B7F`, hover `#C21571`, active `#A80D61`, light `#FFF0F7`, lighter `#FFE5F2`
- **Success**: `#22C55E` (bg `#F0FDF4`, border `#86EFAC`)
- **Warning**: `#F59E0B` (bg `#FFFBEB`, border `#FCD34D`)
- **Error**: `#EF4444` (bg `#FEF2F2`, border `#FCA5A5`)
- **Accent**: Purple `#8B5CF6` (bg `#F5F3FF`) · Teal `#14B8A6` (bg `#F0FDFA`)
- **Page bg**: `#F8F8F8` · **Card bg**: white · **Subtle bg**: `#FAFAFA`
- **Borders**: `#E5E5E5` (default) · `#D4D4D4` (input)
- **Text**: primary `#0A0A0A` · secondary `#525252` · tertiary `#A3A3A3`

### 15.2 Typography
- Inter — body & UI (400/500/600/700)
- JetBrains Mono — numbers, PO codes, dates (400/500/600)
- Base body size 13px; KPI numbers 20-24px monospace bold.

### 15.3 Shape
- Border radius scale: 6 / 8 / 10 / 12 / 14px
- Shadows: `edikted-card` (subtle), `edikted-hover` (pink-tinted on interactive), `edikted-elevated` (modals), `edikted-drawer` (drawers).

### 15.4 Density
- Compact table rows: 7-8px vertical padding to maximize rows per screen.
- Inline form fields: 32px (h-8) height standard.
- Sticky header is `bg-[#F8F8F8]`.

### 15.5 Badges & tags
- **Status badges** with semantic colors (HOLD amber, APPROVED green, REJECTED red, ACKNOWLEDGED teal, AUTOMATICALLY gray).
- **Priority badges** — URGENT (amber), Best Seller (purple), Normal (gray).
- **DD Status badge** — pill with status-specific color.
- **Supplier / Manager / Collection pills** — colored bg, white text, rounded.

---

## 16. Conventions & Constraints

- **Tailwind classes are literal strings only** — no template-string class names (build purges anything dynamic). Color helpers come from `tailwind.config.js`.
- **Entity field writes never store base64 / blobs** — files go through `UploadFile` integration.
- **Frontend never calls Edikted SQL directly** — always via the four backend functions.
- **Bulk writes loop client-side** — `saveFollowUpAction` is called once per PO; if any call fails, the modal halts and shows the failing PO.
- **`User` entity** is built-in; create/import disallowed — invites only.
- **Date formatting** — `fmtDate` returns `"14 Jun"` (en-GB), `ddmm` returns `"14/06"`.
- **Real-time** — entity subscriptions available but not currently wired (refresh button is the manual trigger).
- **CSV export** uses a manual blob (no library).

---

## 17. Mockup Banner

A pink banner across the top reads:
> ⚠️ This is a mockup — data and actions are for preview purposes only.

To be removed when the app moves to production data.