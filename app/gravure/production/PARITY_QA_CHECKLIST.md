# Production Module — Parity QA Checklist (Phases 1–10)

End-to-end test plan for the redeveloped Production module vs the reference
(`IndasEstimoFlexo production-entry`). Demo job = **JC0024 / content 26** on IndusNext
(CompanyID 2). Run top-to-bottom after each backend rebuild.

## 0. Setup (once)
- [ ] **Rebuild backend** in Visual Studio (Web API 4.8 — every controller change needs it).
- [ ] Apply schema scripts (idempotent) in `IndusWebApi/Scripts/`:
      `ProductionModule_QCEntry.sql`, `ProductionModule_RollTracking.sql`,
      `ProductionModule_QCParams.sql`, `ProductionModule_ToolImpressionLog.sql`,
      `ProductionModule_RollReturnRequest.sql`, `ProductionModule_ProcessRating.sql`
- [ ] Apply `ProductionModule_DemoSeed.sql` (idempotent — seeds all Phase 1–9 test data).
- [ ] Frontend: `npm run dev`; open `/gravure/production`.

Chain for content 26: **P213 Printing (main) → P220 Slitting (main) → P221 Lamination (online) → P217 Inspection (main)**.

---

## P1 — Unit Conversion
- [ ] Update P220 (Avg Slitting): enter e.g. **700 m** → preview shows `700 m → 30000 pcs` (SLITTING AC, CylMM 350, TotalUps 15).
- [ ] Next process receives the **converted (pcs)** qty as its input balance.

## P2 — Roll scan-at-start + FIFO merge
- [ ] Create a **later** process (not first): "Input Rolls" step appears; scan/multi-select previous-process rolls; gate blocks Start until selected.
- [ ] Output rolls consume the merged parents (FIFO); `validateroll` rejects wrong-content/consumed/not-earlier rolls.

## P3 — Slitting auto 1-to-N + spool lanes
- [ ] On P220 output-rolls step: **auto-split banner** "Slitting 1-to-3 → A/B/C" pre-fills the grid (30000 → 3×10000, last lane = remainder).
- [ ] Generate → each roll gets `SpoolID {parentBatch}/A|B|C`. **Spool slips** PDF prints big lane letters.

## P4 — LC / CTQ / FPA / Inspection
- [ ] **Line Clearance** (Create, after machine select): 4 Yes/No params → **Save** → LC number → **Print checksheet**; Make Ready blocked until saved.
- [ ] **CTQ / FPA / Inspection** cards (Update, after QC approve): fill Yes/No → Save (voucher no) → Print checksheet.
- [ ] **Complete gate**: selecting Complete without CTQ+FPA saved → Save Update disabled + amber hint.

## P5 — Online-process cascade
- [ ] Grid **hides** P221 Lamination (online); shows only P213/P220/P217 (mains).
- [ ] Create P220: banner "Online processes auto-chained: lamination No.-1".
- [ ] Update/Complete P220: **"Online Processes"** card previews P221 output; on Save P221 auto-produces (own conversion) + mirrors status; dashboard shows a P221 row.

## P6 — Make-ready timer + machine status + downtime
- [ ] **Make Ready Start** → live **⏱ mm:ss** timer (real MachineCurrentStatusEntry interval); refresh → timer resumes.
- [ ] **Make Ready Complete** → shows setup time (or "discarded" if <60s).
- [ ] Start → machine `CurrentStatus=Active`; starting a **different** job on a busy machine is **blocked**.
- [ ] Update screen **Machine Status** card: log Downtime/Breakdown (reason + remark) → interval + status; **Resume** frees the machine; history shows minutes.

## P7 — Tool impressions / plate life
- [ ] Update **P213 Printing**: **Tool Impressions** card shows 2 plates (rated 25000 m).
- [ ] Enter Meter/Impressions → **Remaining** = rated − used − this (red ⚠ if <10%). Save → ToolImpressionLog logs; remaining drops on next view.

## P8 — Return-to-store / Send-to-packing / Semi-finish
- [ ] Output-rolls **Actions**: **Pack** a printing (P213) roll → **slitting-pending warn** (confirm); a P220 roll packs clean.
- [ ] **Return** → roll `Returned to Store` + a Pending `ProductionRollReturnRequest`; **Semi** → `Semi Finished`; **Undo pack** reverts to Complete.
- [ ] (Inventory side) `pendingreturns` / `markreturned` flip Pending → Returned.

## P9 — Ratings / Comments / Job admin
- [ ] Update → Complete: **Rate previous process** ★ (1–5 + remark); saved once, then locked.
- [ ] **Comments** card: add note → appears in list with user + time.
- [ ] Dashboard: process **Admin status** dropdown forces status (mirrors JSR/JBJP/PE); card **Close Job** sets IsClose (drops from grid).

## P10 — Polish + parity QA
- [ ] Frontend `npm run type-check` clean (only the pre-existing `page-loading.tsx` warning, unrelated).
- [ ] Controller brace-balanced; 56 routes; all inline SQL parameterised via `Sq()` for strings, typed IDs for numbers; multi-table writes wrapped in transactions.
- [ ] **Full flow once**: select JC0024 → P213 (LC/tools/QC/CTQ/FPA/rating/comment) → Complete → P220 (slitting split/spool/online cascade) → pack/return → **Production Report PDF** + **Dashboard** reflect everything.

---

### Deferred (documented, out of module scope)
- Floor-stock consumption & add-process (inventory plumbing / complex route edit).
- Stuck-jobs filter view; edit-schedule-qty UI (`editschedqty` endpoint is ready).
- `ProductionRollReturnRequest` stock-in and semi-finish stock posting are the **Inventory** module's job (this module records intent/status only — reference parity).
