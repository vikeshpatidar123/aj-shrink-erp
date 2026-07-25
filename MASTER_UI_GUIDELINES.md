# Master UI Guidelines — AJ Shrink Gravure ERP

> **Mandatory reading for every developer and AI agent before creating or modifying any frontend page.**
> This document defines the single UI standard for the entire application.

---

## Purpose

This file is the single source of truth for the frontend design system of AJ Shrink Gravure ERP.
Every new page, module, table, form, modal, and component must conform to these guidelines.
No page may introduce its own standalone layout, sidebar, header, or independent design pattern.

---

## Master Layout

Every authenticated page is automatically wrapped by `components/layout/AppShell.tsx`.

```
AppShell
├── ToastProvider
│   └── LoaderProvider           ← Global Gravure cylinder loader
│       └── [Context Providers]
│           ├── Sidebar          ← 230 px expanded / 60 px icon-only
│           └── <div flex-1>
│               ├── Topbar       ← Dark navy, sticky, 52 px
│               └── <main>       ← p-4 md:p-6 lg:p-7, overflow-y: scroll
│                   └── {children}   ← YOUR PAGE CONTENT GOES HERE
```

**Never create your own `<header>`, `<aside>`, or wrapper that mimics the shell.**
Just export a React component as `default` from `app/[route]/page.tsx` — AppShell wraps it automatically.

---

## Sidebar

- Width: **230 px** (expanded) / **60 px** (icon-only, collapsed)
- Background: `var(--erp-sidebar-bg)` — deep navy `#0f2540`
- Toggle: `PanelLeftClose` / `PanelLeftOpen` button at the top of the sidebar
- Active item: `var(--erp-primary)` background + white text + **Active pill** (right side)
- Active sub-item inside an expanded group: semi-transparent primary bg + **Active pill**
- Mobile: overlay drawer, triggered by hamburger in Topbar

**Rule:** Never hardcode sidebar width in page CSS. Main content uses `flex: 1` and automatically fills available space.

---

## Topbar (Header)

- Background: `var(--erp-sidebar-bg)` — dark navy
- Contains: company name, unit dropdown (EXT/GRV), financial year badge, Hello Admin, global search, notifications, mail, settings, user dropdown
- Height: 52 px (`minHeight: 52px`)

**Rule:** Never add a second header or title bar inside your page content. The page title lives in the `<PageHeader>` component inside `<main>`.

---

## Design Tokens (CSS Variables)

Defined in `app/globals.css`. Always use these instead of hardcoded hex values.

| Token | Value | Usage |
|---|---|---|
| `--erp-primary` | `#2C5D8A` | Brand blue — buttons, active states, headings |
| `--erp-primary-dark` | `#1f4468` | Hover/pressed state |
| `--erp-primary-light` | `#deeaf5` | Row hover, card backgrounds, badge bg |
| `--erp-sidebar-bg` | `#0f2540` | Sidebar + Topbar background |
| `--background` | `#f4f6f9` | Page background |
| `--foreground` | `#1a2332` | Body text |

---

## Page Structure (Standard Pattern)

Every interior page must follow this hierarchy:

```tsx
// app/[module]/[page]/page.tsx
"use client";

export default function MyPage() {
  return (
    <div className="flex flex-col h-full min-h-screen">

      {/* 1 — Toolbar strip (filters, search, actions) */}
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
        <h1 className="text-sm font-semibold text-white" style={{ /* inside dark toolbar */ }}>
          Page Title
        </h1>
        {/* filters, search, action buttons */}
      </div>

      {/* 2 — Table / content area (fills remaining height) */}
      <div className="flex-1 overflow-auto bg-white">
        <DataTable ... />
      </div>

      {/* 3 — Footer strip (count, pagination) */}
      <div className="flex-shrink-0 px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        Showing X–Y of Z
      </div>

    </div>
  );
}
```

---

## Listing / Table Pages

### Toolbar (top strip)

- Background: `var(--erp-primary)` (dark navy-blue)
- Height: ~44 px (slim strip, not a full page header)
- Left: Page title in white, status filter chips
- Right: Search input, filter button, date range picker, **+ New [Entity]** primary action button

```tsx
<div
  className="flex-shrink-0 flex items-center gap-3 px-4 py-2 flex-wrap"
  style={{ background: "var(--erp-primary)", minHeight: 44 }}
>
  <h1 className="text-sm font-semibold text-white mr-2">Order Booking</h1>
  <StatusChips ... />
  <div className="ml-auto flex items-center gap-2">
    <SearchInput />
    <Button variant="primary" icon={<Plus size={14} />}>New Order</Button>
  </div>
</div>
```

### Table

- Use `<DataTable>` from `components/tables/DataTable.tsx` — **never build a raw `<table>`**
- Column headers: automatically styled by DataTable with `var(--erp-primary)` background + white text
- Row height: compact (`py-2` on `<td>`)
- Row hover: `.erp-table-row:hover` class (set in `globals.css`)
- Actions column: pass `actions={(row) => <ActionButtons />}` prop

### Status Badges

Always use `statusBadge(status)` or `<Badge>` from `components/ui/Badge.tsx`.

```tsx
import { statusBadge } from "@/components/ui/Badge";
// Returns a <Badge> JSX element
{statusBadge(row.Status)}
```

**Never define a local `Badge` or `statusBadge` inside a page file.**

### Pagination

DataTable handles pagination automatically via its `pageSize` prop (default: 10).
If you need a custom page size selector, pass `pageSize` as state controlled externally.

---

## Form / Create / Edit Pages

### Modal Forms (preferred for simple-medium forms)

Use `<Modal>` from `components/ui/Modal.tsx` with `size="md"` or `size="lg"`.

```tsx
<Modal open={open} onClose={() => setOpen(false)} title="New Customer" size="lg">
  <div className="space-y-4 p-1">
    <Input label="Customer Name" value={form.name} onChange={...} />
    <Select label="Status" options={...} value={form.status} onChange={...} />
  </div>
  <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onClick={handleSave}>Save</Button>
  </div>
</Modal>
```

### Full-Page Forms (for very complex forms with many sections)

When a form is too complex for a modal (e.g., Purchase Order with 4 tabs and dynamic line items),
use a full-page form with the same `flex flex-col h-full min-h-screen` container.

```
┌─ Toolbar (title + Save/Cancel buttons) ─── flex-shrink-0
├─ Tab bar (if multiple sections) ──────────── flex-shrink-0
└─ Scrollable form content ─────────────────── flex-1 overflow-auto
```

### Form Fields

Always use the shared input components from `components/ui/Input.tsx`:

```tsx
import { Input, Select, Textarea } from "@/components/ui/Input";

<Input label="Customer Name" required value={...} onChange={...} error={errors.name} />
<Select label="Category" options={categories} value={...} onChange={...} />
<Textarea label="Remarks" value={...} onChange={...} />
```

**Never use raw `<input>`, `<select>`, or `<textarea>` in new pages.**
For existing pages being migrated: replace raw inputs with these components.

### Section Headers Inside Forms

Use the `erp-section-title` CSS class (defined in `globals.css`):

```tsx
<p className="erp-section-title mb-3">Customer Information</p>
```

This renders: small, uppercase, spaced-out, `var(--erp-primary)` colored heading.

---

## Detail / View Pages

- Use `<Card>` and `<CardHeader>` from `components/ui/Card.tsx` for information groups
- Section headers: `erp-section-title` class
- Key-value pairs: two-column grid (`grid grid-cols-2 gap-4`)
- Action buttons: top-right corner of the page or the card header

---

## Dashboards

- Keep dashboard-specific charts and widgets
- Stat tiles: use `<StatCard>` from `components/ui/Card.tsx` — do NOT define local stat card components inline
- Card containers: use `<Card>` — do NOT define local `Card` wrappers inline
- Status badges: use `<Badge>` or `statusBadge()` — do NOT define local badge components inline
- Tab navigation on dashboards: use the **Underline Tabs** pattern (see Tabs section below)

---

## Buttons

Import from `components/ui/Button.tsx`:

```tsx
import { Button } from "@/components/ui/Button";

<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
<Button variant="ghost">View</Button>
<Button variant="success">Approve</Button>
<Button size="sm" icon={<Plus size={12} />}>Add</Button>
<Button loading={saving}>Saving...</Button>
```

**Never use raw `<button>` with inline Tailwind color classes in new pages.**

---

## Tabs

Use the **Underline Tab** pattern everywhere. One consistent style across the app:

```tsx
{["All", "Draft", "Approved", "Sent"].map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
    style={{
      color: activeTab === tab ? "var(--erp-primary)" : "#6b7280",
      borderColor: activeTab === tab ? "var(--erp-primary)" : "transparent",
    }}
  >
    {tab}
  </button>
))}
```

**Do not use:**
- Pill/filled tabs (`bg-blue-600 text-white rounded-lg`) — reserved only for toggle switches
- Dynamic color tabs from `t.color` — always use `var(--erp-primary)` for active

---

## Status Badges / Chips

Always use `components/ui/Badge.tsx`:

```tsx
import { Badge, statusBadge } from "@/components/ui/Badge";

// Auto-mapped by status string:
{statusBadge("Approved")}   // → green badge
{statusBadge("Draft")}      // → gray badge
{statusBadge("Pending")}    // → yellow badge
{statusBadge("Cancelled")}  // → red badge

// Manual:
<Badge label="Custom" variant="primary" />
```

**The `statusBadge()` in `lib/styles.ts` returns a CSS class string (legacy). Do not use it in new code. Use the JSX version from `components/ui/Badge.tsx`.**

---

## Spacing and Typography

| Element | Class |
|---|---|
| Page section title | `erp-section-title` (via globals.css) |
| Toolbar title | `text-sm font-semibold text-white` |
| Card heading | `text-sm font-bold text-gray-700` |
| Table cell text | `text-xs text-gray-700` |
| Label | `text-xs font-medium text-gray-600` |
| Muted / secondary text | `text-xs text-gray-400` |
| Page container | `flex flex-col h-full min-h-screen` |
| Toolbar strip | `px-4 py-2` |
| Card padding | `p-5` |
| Form field gap | `space-y-4` |

---

## Scrolling and Overflow

**Horizontal scrolling must always be INSIDE the table container, never on the page body.**

```tsx
{/* Correct */}
<div className="flex-1 overflow-auto">       {/* scrolls both X and Y */}
  <table style={{ minWidth: 1200 }}>...</table>
</div>

{/* Wrong — causes full-page horizontal scroll */}
<div style={{ overflowX: "auto", width: "100%" }}>
  <table style={{ minWidth: 1200 }}>...</table>
</div>
```

The outer `<main>` in AppShell uses `overflow-y: scroll` — never set `overflow: auto` or `overflow: scroll` on the page root div, or you will create a double-scrollbar.

Use this container pattern for ALL listing pages:

```tsx
<div className="flex flex-col h-full min-h-screen">
  <div className="flex-shrink-0 ...">toolbar</div>   {/* fixed height */}
  <div className="flex-1 overflow-auto">table</div>  {/* scrolls */}
  <div className="flex-shrink-0 ...">footer</div>    {/* fixed height */}
</div>
```

---

## Modals

Use `<Modal>` from `components/ui/Modal.tsx`.

```tsx
<Modal open={open} onClose={handleClose} title="Title" size="lg">
  {/* content */}
</Modal>
```

Available sizes: `sm` (400 px) | `md` (560 px) | `lg` (720 px) | `xl` (960 px)

For pages with sub-tabs inside a modal, use the `subHeader` prop:
```tsx
<Modal ... subHeader={<TabBar />}>
  {tabContent}
</Modal>
```

---

## Responsive Design

- Sidebar collapse is automatic — main content uses `flex: 1` and resizes automatically
- Tables: always use `overflow-auto` on the wrapper, `minWidth` on the table itself for columns that need it
- Mobile card view: DataTable automatically switches to a card layout on `< lg` screens
- Never use fixed widths (`w-[800px]`) on full-page containers — use `max-w-*` with `w-full`

---

## Reusable Components — Complete Inventory

Before building any UI, check whether a shared component already exists:

| Need | Import from |
|---|---|
| Table with search/sort/filter/pagination | `components/tables/DataTable` |
| Column filter funnel icon | `components/tables/ColFilterIcon` |
| Primary / secondary / danger button | `components/ui/Button` |
| Status badge / color badge | `components/ui/Badge` |
| White card container | `components/ui/Card` |
| Stat tile (icon + number + label) | `components/ui/Card` → `StatCard` |
| Labelled text input | `components/ui/Input` → `Input` |
| Searchable dropdown select | `components/ui/Input` → `Select` |
| Multi-line textarea | `components/ui/Input` → `Textarea` |
| Fixed overlay modal | `components/ui/Modal` |
| Success / error toast | `components/ui/Toast` → `useToast()` |
| Full-screen loading overlay | `components/ui/GravureLoader` → `useLoader()` |
| File upload (Cloudinary/S3) | `components/ui/CloudinaryUpload` |
| Authenticated GET | `lib/api` → `apiGet()` |
| Authenticated POST | `lib/api` → `apiPost()` |
| Silent background GET | `lib/api` → `apiGetSafe()` |
| File upload API call | `lib/api` → `apiUpload()` |
| Shared Tailwind class strings | `lib/styles` → `inputCls`, `cardCls`, etc. |
| Voucher number generator | `lib/generateCode` |

---

## New Page Development Rules

1. **Every new page MUST use the existing AppShell / MasterLayout.** Never create a standalone layout.
2. **Before creating a new UI component, check the inventory above.** Reuse first, create only if nothing fits.
3. **Never redefine Badge, Button, Card, StatusBadge, or Input locally inside a page file.**
4. **Always use `<DataTable>` for listing pages.** Never build a raw `<table>` for new pages.
5. **Use `var(--erp-primary)` and design tokens** — never hardcode `#2C5D8A`, `#1f4468`, or other brand colors.
6. **Use `statusBadge()` from `components/ui/Badge`** — not the one in `lib/styles.ts`.
7. **Test sidebar collapse:** After building a page, collapse the sidebar and verify the content fills the full available width without breaking.
8. **No horizontal page scroll.** All wide tables must scroll inside their own `overflow-auto` container.

---

## Technical Debt / Known Issues (as of 2026-07-20)

| Issue | Location | Priority |
|---|---|---|
| Raw `<table>` used instead of DataTable | inventory/purchase-order, inventory/purchase-requisition, gravure/dispatch, gravure/production/job-production | High |
| Raw `<button>` instead of `<Button>` component | inventory/purchase-order, login pages | High |
| ~~Local `Badge` re-defined~~ | ~~tool-inventory/stock-summary~~ | ~~Resolved~~ |
| ~~Conflicting `statusBadge` (two implementations)~~ | ~~lib/styles.ts vs components/ui/Badge.tsx~~ | ~~Resolved~~ |
| Local `Field`/`SectionTitle` duplicated 3× | inventory/purchase-order, masters/items, masters/field-master | Medium |
| Pill tab style (should be underline tabs) | gravure/production/job-production | Low |
| Dynamic `t.color` tabs | gravure/dashboard | Low |
| Hardcoded `style={{ minWidth: 1100 }}` | inventory/purchase-order | Low |
| Raw `<input>`/`<select>` in form pages | gate-entry, job-production, purchase-order | Medium |
