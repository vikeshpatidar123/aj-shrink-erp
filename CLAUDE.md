# AJ Shrink Gravure ERP — AI Development Instructions

## MANDATORY: Read UI guidelines before any frontend work

**Before creating or modifying any frontend page, component, or style, read and follow:**

👉 [`MASTER_UI_GUIDELINES.md`](./MASTER_UI_GUIDELINES.md)

This is the single design system standard for the entire application. No exceptions.

---

## Project Overview

- **Framework:** Next.js 16 App Router (`app/` directory, `"use client"` pages)
- **Styling:** Tailwind CSS v4 (inline utilities) + `app/globals.css` (CSS variables, global overrides)
- **API:** .NET backend at `https://api.indusanalytics.co.in` via `lib/api.ts`
- **Auth:** HTTP Basic Auth, session in `localStorage`, managed by `lib/auth.ts`
- **Icons:** `lucide-react` v0.577

---

## Architecture Rules

### Layout
Every authenticated page is wrapped automatically by `components/layout/AppShell.tsx`.
**Never create your own sidebar, header, or root layout.**
Just export a default component from `app/[route]/page.tsx`.

### Design tokens
Use CSS variables (`var(--erp-primary)`, etc.) — never hardcode brand hex colors.
See `app/globals.css` for the full token list.

### Components to always use
| Need | Component |
|---|---|
| Table with search/filter/sort/page | `components/tables/DataTable` |
| Buttons | `components/ui/Button` |
| Status / color badges | `components/ui/Badge` → `statusBadge()` |
| Cards | `components/ui/Card` |
| Form inputs | `components/ui/Input` → `Input`, `Select`, `Textarea` |
| Modals | `components/ui/Modal` |
| Toast notifications | `components/ui/Toast` → `useToast()` |
| Loading overlay | `components/ui/GravureLoader` → `useLoader()` |

### API calls
Always use `lib/api.ts` helpers (`apiGet`, `apiPost`, `apiUpload`, `apiGetSafe`).
These handle auth headers, JSON double-unwrapping, and the global loader automatically.

---

## Controller Location
All new API controllers go in `Controllers/Gravure/` with namespace `IndusWebApi.Controllers.Gravure`.

---

## Deployment
**Never run `vercel`, `git push`, `git pull`, `git merge`, or any deploy command**
unless the user explicitly requests it in that specific message.
