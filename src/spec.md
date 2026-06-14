# Edikted Follow-Up — Product Specification

**Version:** Current (June 2026)
**Stack:** React + Vite + Tailwind + shadcn/ui · Base44 BaaS · External Postgres (Edikted DB)
**Brand:** Edikted Pink (#E31B7F) · Inter / JetBrains Mono · Pink-forward fashion-tech aesthetic

---

## 1. Purpose

A unified operations console for tracking purchase-order (PO) delivery health across the supply chain.
Three personas — **Main Office**, **DD Team Manager**, **DD Team Employee** — share one underlying dataset but each gets a tailored KPI grid, filter set, table layout, and action surface.

The goal is to make late / at-risk POs **immediately visible**, give the DD team a fast way to log delays and updates, and give the Main Office a one-click way to approve / acknowledge / reject those delay requests.

---

## 2. Roles

| Role | Sees | Primary actions |
|---|---|---|
| **Main Office** | All POs; KPI grid split by New / Rep orders; full filter set; insights strip; HOLDs responsibility breakdown | Approve / Acknowledge / Reject delay requests; write internal notes; respond to suppliers |
| **DD Team Manager** | All POs; column picker (29 toggleable columns, standard + additional); manager KPIs | Report / edit delay; post general updates; view full activity log |
| **DD Team Employee** | All POs but auto-scoped to their own name (DD Manager filter pre-fills); employee-specific KPI strip | Report / edit delay; post general updates; view activity log |

Admins can switch role from the header dropdown. Non-admins see only their assigned roles.

---

## 3. Data Model

### 3.1 Source of truth — external Postgres
Most PO data (style, supplier, quantities, dates, urgency, production stage, etc.) lives in the **Edikted DB** (accessed via `EDIKTED_DB_URL` secret). The backend reads it through SQL in `functions/getFollowUpData.js`.

### 3.2 App entities (Base44)

**`dd_updates`** — append-only event log. Two types:
- `DDD_UPDATE` — a delay request. Fields: `previous_due_date`, `new_due_date`, `reason[]` (multi-select), `reason_other_text`, `responsibility` (derived: SUPPLIER > EDIKTED > OTHER), `ddd_comment`, `status` (HOLD / AUTOMATICALLY / APPROVED / ACKNOWLEDGED / REJECTED), `cumulative_delay_days`, `decision_at`, `decision_by_email`, `delay_response_comment`, `internal_note`.
- `GENERAL_UPDATE` — a status check-in. Fields: `dd_status`, `general_comment` (closed list + Other), `general_comment_other_text`, `next_update_date`.

**`po_overrides`** — one row per PO, holds the latest effective state derived from updates: `delayed_due_date`, `dd_status`, `next_update_date`, `dd_status_changed_at`, `last_ddd_update_id`, `last_general_update_id`. Used as a fast read cache so the table doesn't need to scan `dd_updates` on every load.

### 3.3 Auto-approval rule
Non-urgent delay requests with ≤ 3 days delay are auto-approved (`status = AUTOMATICALLY`) at submission. Everything else lands in HOLD for Main Office decision.

### 3.4 Responsibility derivation
Each delay reason maps to OTHER / EDIKTED / SUPPLIER. When a request has multiple reasons, the worst-case wins: **SUPPLIER > EDIKTED > OTHER**.

---

## 4. Backend Functions

| Function | Purpose |
|---|---|
| `getFollowUpData` | Returns `{ rows, kpis }`. Joins purchase_orders + po_urgent_status + po_types + suppliers + dd_managers + collections + shipment_methods + pm_tags with `po_overrides` and the latest `dd_updates`. Computes virtual fields (see §5). |
| `getPoDetails` | Per-PO drawer data: full style/quantity/destination breakdown, OTW, GFS, replenishment numbers. |
| `getPoActivityLog` | Full update history for one PO (used by Activity drawer). |
| `saveFollowUpAction` | Single write endpoint for: log delay (single + bulk), general update (single + bulk), Main Office decision (approve / acknowledge / reject, single + bulk), internal note. Updates `dd_updates` + `po_overrides` atomically. |

All functions are user-scoped (`createClientFromRequest`); writes record `actor_email`.

---

## 5. Computed / Virtual Row Fields

The backend hydrates each row with derived fields that drive KPIs, filters, and table cells:

- `effective_dd_status`, `effective_delayed_due_date`, `effective_next_update` — overrides ▸ falls back to base PO data
- `current_status` — latest DDD_UPDATE.status (null if PO never entered the delay workflow)
- `final_dd` — effective delayed DD or original due date, whichever is later
- `days_late_counting` — final_dd vs. original due_date
- `late_future` — `LATE` / `FUTURE` / `RECEIVED`
- `countdown` — days from today to final_dd (negative = past due)
- `days_same_status` — days since `dd_status_changed_at`
- `hold_age_days` — days a HOLD request has been awaiting decision (Main Office column)
- `urgency_reason_raw` — raw text from `po_urgent_status` (split & normalized for filtering)
- `us_priority` / `uk_priority` — per-destination priority tag (BEST_SELLER / URGENT / NORMAL)
- `inv_days` — Inventory Days = (stock + air OTW) ÷ (virtual7d / 7) — Main Office only
- `bno_high_low_otw` — boolean: demand high vs. OTW low
- `is_best_seller`, `urgent` — flag booleans
- `po_rank` — sub-PO order within the same destination + style_color group, by delayed DD
- `dd_comment_log` — recent general updates as `[{date, text}]`
- `pm_tags_label` — comma-joined PM tag tokens
- `missing_sizes` — array of size codes still owed (Rep view)
- `shipping_method_names` — array of method names from `shipment_methods` (Rep view)
- `shipped_percent` — qty_received ÷ ordered_qty

---

## 6. UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Mockup banner (preview-only warning)                          │
├────────────────────────────────────────────────────────────────┤
│ Title  "Follow Up"        [Role ▾] [Export] [Refresh] [User ▾]│
│ "Working as <Role>"                                           │
├────────────────────────────────────────────────────────────────┤
│ KPI ZONE — varies per role                                    │
├────────────────────────────────────────────────────────────────┤
│ Insights strip (Main Office only)                             │
├────────────────────────────────────────────────────────────────┤
│ Filter toolbar — primary bar + collapsible Advanced panel     │
├────────────────────────────────────────────────────────────────┤
│ Data table — role-specific columns, sticky header + actions   │
│ Footer: row count · Load more · Show all · Custom Filter      │
└────────────────────────────────────────────────────────────────┘
[BulkActionBar] appears when rows are selected
```

---

## 7. KPI Zones

### 7.1 Main Office — `MainOfficeKpiGrid`
- **View mode toggle: New / Rep** (changes table scope automatically via `orderType` filter).
- **6 × 2 KPI grid** scoped to selected view + supplier region (default China).
- **Collapsible**: scroll past it and the grid sticks to the top in a compact one-row flex layout.
- Cards (varies by view):
  - Shared: Pending · Late · Not Updated · Urgents · Current Collection · Will Miss Collection · Manufactured Not Started
  - **New only**: Fabric/PPS at Risk · Rework/Reproduction · QC > 3 days · Old Collection · Drop Risk (< 7d)
  - **Rep only**: Late Best Sellers · High BNO – Low OTW · Empty Status · Same Status > 5d
- Clicking a card applies its preset filter; clicking again clears it.

### 7.2 DD Team Manager / Employee — `KpiCards`
- Manager: Pending HOLDs · Total Pending · Urgent Pending · Approved/Rejected/Acknowledged today · Not Updated · Received Updates
- Employee: scoped to the logged-in user — Pending · Acknowledged · Rejected · Received Updates

### 7.3 HOLDs Responsibility (Main Office only)
A side card on top of the KPI strip breaks down current HOLDs by Edikted / Supplier / Other.

---

## 8. Filters — `FilterToolbar`

### 8.1 Main Office / DD Manager — primary + advanced

**Primary bar (always visible):** PO Number · Status · Style Color · Urgency Reason · Supplier Region · [+ Advanced] · Reset

**Advanced panel (collapsible) — categories:**
DD Manager · Supplier · Production Stage · Order Type · Collection · US Priority · UK Priority · Delay Response

**Rep-only categories:** Missing Sizes · Shipping Method · Last Urgent Comment

**Ranges:** Final DD · Drop Date (New only) · Next Update · Delay Request (days) · Shipped % (New only) · IND (Main Office only)

**Toggles (DD Manager only):** Archive

Active filters render as **dismissable chips** under the panel.

### 8.2 DD Employee / DD Manager — simplified strip
Inline single-row strip with: PO · Supplier · Style Color · DD Manager · Next Update · Production Stage · Supplier Region · Collection · PM Tags · Reset

### 8.3 Supplier Region
Three-way switch — **CHINA (default)** / US / All. Filters via the `US_SUPPLIERS` list (`LUCENTING`, `LUCENTINC`, `KILAT` + substring match).

### 8.4 KPI-driven virtual filters
Toggled by clicking KPI cards: `staleStatus`, `late7Plus`, `bestSeller`, `highBno`, `dropRisk`, `lateFuture`, `bnoHighLowOtw`, `sameStatusOver5d`.

---

## 9. Tables — `FollowUpTable`

Three column layouts share the same shell (sticky header, sticky-left thumbnail/PO/checkbox cluster, sticky-right Actions column, sortable resizable columns, expandable row for sub-PO breakdown).

### 9.1 Main Office view
Columns: ☐ · ▸ · img · **PO Number** · Style Color · Rank · Production Stage · DDD Status · Urgency Reason · IND · DD Manager · Supplier · Delivery Status · Due Date · Delayed DD · Final DD · Next Update · Days Late · DD Reason · DDD Comment · DD Comment · HOLD Age · Delay Response · Last Comment (internal) · DDD Count · PM Tags · *Missing Sizes* (Rep scope) · **Actions** (Approve / Acknowledge / Reject / Internal note / Logs)

### 9.2 DD Team Manager view
Same shell + a **Column Picker** (29 toggleable columns split Standard / Additional, persisted in `localStorage`).
- Standard ON by default: Style Color · Production Stage · DD Comment · DDD Status · PO Response · DDD Reason · DDD Comment · Delayed DD · CountDown · DD Manager · Days Same Status · Next Update
- Additional OFF by default: Original DD · DD Date · Flags · Supplier · Delivery Status · DDD Count · Set With · Ordered/Received QTY · Manual/Auto RW · Goods Received · Order Date · Drop · Collection · PM Tags · Bulk Fabric · PPS Receipt Date · Order Type
- Actions: Report/Edit Delay · Update · Logs

### 9.3 DD Team Employee view
Fixed 31-column layout (no picker) matching Manager's full set. Auto-filtered by the logged-in user's name. Same actions as Manager.

### 9.4 Sub-PO expansion (▸ row)
Both Manager and Employee rows can expand to show **`PoSizeBreakdown`** — size-by-size table per destination (US / UK). Loads from `getPoDetails`.

### 9.5 Custom Filter
Footer button "Filter" opens a **`CustomFilterModal`** anchored above the button. Build rules:
- Pick column → operator (varies by type: text / number / date / boolean) → value
- Multi-rule (Where / And…)
- "Clear filters" · Cancel · Apply
- Active count shown on the button. Filters auto-reset when role changes (column schemas differ).
- Dropdowns auto-flip up when there's no room below.

---

## 10. Modals

| Modal | Purpose | Key behaviour |
|---|---|---|
| **`LogDelayModal`** | Report or edit a delay (DDD_UPDATE) | Multi-select reasons grouped by Other/Edikted/Supplier; new DD date picker; comment with `[date]` placeholder support; bulk mode for many POs at once |
| **`GeneralUpdateModal`** | Post a status check-in (GENERAL_UPDATE) | Production stage + status-aware comment templates (see `STATUS_COMMENT_TEMPLATES`); next-update date constrained to ≤5d (urgent) or ≤7d (normal); bulk-capable |
| **`DecisionModal`** | Main Office Approve / Acknowledge / Reject | Optional or required delay-response preset (`DELAY_RESPONSE_OPTIONS`) + free-text comment; bulk-capable |
| **`InternalNoteModal`** | Main Office private note | Hidden from DD team |
| **`ActivityLogDrawer`** | Right-side drawer | Chronological history of all updates for a PO; role-aware (DD team can't see internal notes) |
| **`PoDetailsDrawer`** | Right-side drawer | Hero + Progress + Delay + Meta + Timeline + Readiness blocks; loads from `getPoDetails` |
| **`LeaderboardDrawer`** | Right-side drawer | Top suppliers / managers by late%, on-time%, workload, urgents (triggered from Insights strip) |
| **`BulkActionBar`** | Floating bottom bar | Appears on row selection; role-specific bulk actions (Approve all / Acknowledge all / Reject all for Main Office; Report Delay / Update for DD; Export for everyone) |

---

## 11. Insights Strip (Main Office only)

A collapsible card above the filter toolbar surfacing performance trends:
- **Supplier insights**: top late suppliers · top on-time · highest workload · urgent concentration
- **Manager insights**: same axes for DD managers
- Each insight opens a `LeaderboardDrawer` for the full ranked list.
- US suppliers are excluded from supplier insights (different operating model).

---

## 12. Auth

Uses Base44's built-in auth pages (Login / Register / ForgotPassword / ResetPassword) without customization. After login users land on `/follow-up` (also reachable as `/`).

Auth context (`AuthContext`) loads the current user + public settings before rendering the app. Unauthenticated users redirect to `/login`. User entity carries `role` (admin / user) plus an optional `roles[]` array for role-set assignments.

---

## 13. Design System

- **Colors**: Edikted Pink (`#E31B7F`) primary; success green, warning amber, error red, accent purple/teal for tags. Page background `#F8F8F8`.
- **Typography**: Inter (body / UI), JetBrains Mono (numbers, PO codes, dates).
- **Spacing**: 4-px multiples; rounded corners `6 / 8 / 10 / 12 px`.
- **Shadows**: `edikted-card` (subtle) · `edikted-hover` (pink-tinted on interactive) · `edikted-elevated` (modals).
- **Status badges**: HOLD (amber) · APPROVED (green) · REJECTED (red) · ACKNOWLEDGED (teal) · AUTOMATICALLY (gray).
- **Density**: 13px base font for tables; compact 7-8px vertical padding to maximize rows per screen.

---

## 14. Export

CSV export (Export button + Bulk Export). Columns: PO · Style · Supplier · DD Manager · Status · Priority · Due Date · Delayed DD · Final DD · Days Late · DD Reason · DDD Comment · DD Status · Delivery Status · Response · Collection · Next Update · DDD Count.

---

## 15. Mockup Banner

A pink banner across the top reads:
> ⚠️ This is a mockup — data and actions are for preview purposes only.

To be removed when the app moves to production data.

---

## 16. Known Constraints / Conventions

- `User` entity is built-in; never creates/imports records — invites only.
- Entity field writes never store base64 / blobs — files go through `UploadFile` integration.
- Real-time updates use `base44.entities.X.subscribe()` where needed.
- Frontend never calls SQL directly — always through backend functions.
- Tailwind classes are literal strings only (no template-string class names) per build purge rules.