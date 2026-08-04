# Production QR Traceability — Finalized Plan (for approval)

Status: **PLAN ONLY — awaiting approval before build.**
Module: `frontend/app/gravure/production` + `backend .../Controllers/Production/ProductionModuleController.cs`
Depends on: existing Production module (Modules 1–3 already built).

---

## 0. Locked decisions

1. **Every process output physical unit gets its own QR.** A process *consumes* its input unit QR(s) and *produces* new output unit QR(s), linked to the parent(s).
2. **Pouch making** is tracked at **lot/box level** (1 box = N pouches = 1 QR), not per pouch.
3. **QR = parent batch continuation.** The **primary parent** (the substrate roll — film/paper) batch is *continued* into the child by appending a process+unit suffix. All other consumed materials (inks, adhesive, previous rolls) are recorded in the **link table** (full graph), not in the string.

---

## 1. Answers to the case questions (the "QR hona chahiye ki nahi?")

| Stage | In → Out | Output QR? | Notes |
|---|---|---|---|
| Warehouse issue | 3 rolls @400kg | Already have GRN batch QR | These are the **roots** → GRN → supplier |
| **Printing** | 3 rolls → 3 printed rolls (even if 1 production record) | **Yes — 3 output QR** | Each printed roll = 1 unit; 6 inks linked as secondary parents |
| **Lamination** | 3 → 3 (or more) | **Yes — 1 QR per output roll** | Input roll consumed, output roll new |
| **Slitting** | 1 roll (600mm) → 4 rolls (200mm) | **Yes — 4 slit-roll QR** | 1 parent → 4 children (fan-out) |
| **Pouch Making** | roll → pouches | **Yes — per box/lot QR** | Lot node; pouches counted, not individually QR'd |
| **Case II** (3→6, 6→8, part complete) | count/qty changes | **Yes — every new output unit gets a QR** | This is exactly why per-unit output QR is mandatory |

**Rule:** the number of output QRs = number of physical output units the operator declares at Update/Complete. When count changes (3→6, 1→4), you simply declare that many output units and each auto-gets a QR.

---

## 2. QR / Batch continuation scheme

Root (from GRN Stock Label, real example):
```
Batch:          _PO00011_25_26_23_001
Item:           PU BASED/TOLUENE MIX/grey   (I00007)
Supplier Batch: 4645TY
Tag/Reel:       REEL No-101
GRN:            GRN00012_25_26   (Metro Trading Company)
```

Child unit QR = **primary parent batch + `-<ProcCode><UnitSeq>`**. Process codes: `P`=Printing, `L`=Lamination, `S`=Slitting, `PCH`=Pouch (configurable per ProcessMaster).

```
Material roll (root)   _PO00011_25_26_23_001
   └─ Printed roll 1    _PO00011_25_26_23_001-P01
        └─ Laminated    _PO00011_25_26_23_001-P01-L01
             ├─ Slit 1  _PO00011_25_26_23_001-P01-L01-S01   (200mm)
             ├─ Slit 2  _PO00011_25_26_23_001-P01-L01-S02
             ├─ Slit 3  _PO00011_25_26_23_001-P01-L01-S03
             └─ Slit 4  _PO00011_25_26_23_001-P01-L01-S04
                  └─ Pouch box  ...-S01-PCH01   (box = 5000 pcs)
```

- The **string carries the primary substrate path** (human-readable, printable, scannable).
- The **link table carries the full graph** including secondary parents (the 6 ink cans, adhesive) and any blends/merges.
- QR image content: JSON `{ "u": "<UnitQR>", "unitId": <id> }` (same style as GRN QR) so a scan resolves instantly; plain-text `<UnitQR>` also accepted.

> When a printed roll blends **multiple** film rolls (not 1:1), the string continues **one** primary parent (operator picks / first-scanned), and the rest are edges in the link table. Traceability graph stays complete; the string stays readable.

---

## 3. Database — 2 new tables (idempotent DDL, multi-tenant like the rest)

### `ProductionUnit` — one row per physical output unit (node)
```sql
CREATE TABLE dbo.ProductionUnit (
    UnitID              BIGINT IDENTITY(1,1) PRIMARY KEY,
    UnitQR              NVARCHAR(200) NOT NULL,        -- continued batch string (unique per company)
    ProductionID        BIGINT NULL,                   -- FK -> ProductionEntry (which run produced it)
    ProductionUpdateID  BIGINT NULL,                   -- FK -> ProductionUpdateEntry (which update)
    JobBookingID        BIGINT NULL,
    JobBookingJobCardContentsID BIGINT NULL,
    ProcessID           BIGINT NULL,
    SequenceNo          INT NULL,                       -- process sequence
    ProcCode            NVARCHAR(10) NULL,              -- P / L / S / PCH
    UnitSeq             INT NULL,                       -- 1..N within the process run
    MachineID           BIGINT NULL,
    OperatorID          BIGINT NULL,
    Qty                 DECIMAL(18,3) NULL,             -- output qty of this unit
    Unit                NVARCHAR(20) NULL,              -- kg / mtr / pcs
    WidthMM             DECIMAL(18,3) NULL,             -- for slit rolls
    PrimaryParentUnitID BIGINT NULL,                    -- the substrate parent whose batch was continued
    PrimaryParentBatch  NVARCHAR(200) NULL,             -- root/material batch when parent is material
    Status              NVARCHAR(32) NULL,              -- InStock / Consumed / Dispatched
    CreatedDate         DATETIME NOT NULL DEFAULT(GETDATE()),
    UserID BIGINT NULL, CompanyID BIGINT NULL, FYear NVARCHAR(20) NULL,
    ProductionUnitID_FK BIGINT NULL,                    -- production-unit (factory unit) id, if used
    IsDeletedTransaction BIT NOT NULL DEFAULT(0)
);
-- unique batch per company, and lookup indexes
CREATE UNIQUE INDEX UX_ProductionUnit_QR ON dbo.ProductionUnit(CompanyID, UnitQR) WHERE IsDeletedTransaction=0;
CREATE INDEX IX_ProductionUnit_Job     ON dbo.ProductionUnit(JobBookingJobCardContentsID, ProcessID);
CREATE INDEX IX_ProductionUnit_Prod    ON dbo.ProductionUnit(ProductionID);
```

### `ProductionUnitLink` — one row per consumption edge
```sql
CREATE TABLE dbo.ProductionUnitLink (
    LinkID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    ChildUnitID     BIGINT NOT NULL,                    -- FK -> ProductionUnit.UnitID (the output)
    ParentType      NVARCHAR(12) NOT NULL,              -- 'Material' | 'Unit'
    ParentUnitID    BIGINT NULL,                        -- when ParentType='Unit' -> ProductionUnit.UnitID
    ParentBatchID   BIGINT NULL,                        -- when ParentType='Material' -> ItemTransactionDetail.BatchID
    ParentBatchNo   NVARCHAR(200) NULL,                 -- material batch string (root)
    ItemID          BIGINT NULL,                        -- which item (film / ink / adhesive)
    IsPrimary       BIT NOT NULL DEFAULT(0),            -- 1 = substrate whose batch was continued
    ConsumedQty     DECIMAL(18,3) NULL,
    ConsumedUnit    NVARCHAR(20) NULL,
    CompanyID       BIGINT NULL,
    CreatedDate     DATETIME NOT NULL DEFAULT(GETDATE()),
    IsDeletedTransaction BIT NOT NULL DEFAULT(0)
);
CREATE INDEX IX_PUL_Child  ON dbo.ProductionUnitLink(ChildUnitID);
CREATE INDEX IX_PUL_Parent ON dbo.ProductionUnitLink(ParentType, ParentUnitID, ParentBatchID);
```

- **Roots** are `ItemTransactionDetail` rows (issued material batches) → already linked to GRN → `LedgerMaster` (supplier). No new root table needed.
- Graph is a **DAG**: `ProductionUnitLink` edges point child → parent. Fan-out (slitting) and blend (printing) both natural.

---

## 4. Flow changes in the Production module

### 4a. Production Start (input scan) — extends existing material verification
- **Printing:** operator scans the **material roll QRs** (already done in Material Verification) → these become the parent candidates. Operator marks the **primary** substrate roll (film). Inks/adhesive scanned too → secondary parents.
- **Later processes (Lamination/Slitting/Pouch):** the "issued material" for the process is actually the **previous process's output rolls**. Operator scans those `ProductionUnit` QRs → verified → parent candidates. (New: material verification grid can show *previous-process output units* instead of / in addition to warehouse-issued items.)

### 4b. Production Update / Complete (output generation) — the key new step
New sub-section **"Output Units"** in the Update screen:
- Operator declares output units: **count**, and per unit **qty / width / unit**.
  - Printing complete 3 rolls → add 3 rows (or "auto = input count").
  - Slitting → add 4 rows, width 200mm each.
  - Pouch → add box rows (qty in pcs).
- On Save, backend:
  1. Generates each `UnitQR` = primary-parent-batch + `-<ProcCode><Seq>`.
  2. Inserts `ProductionUnit` rows.
  3. Inserts `ProductionUnitLink` edges (child → each scanned parent; primary flagged).
  4. Marks consumed parent units `Status='Consumed'`.
  5. Returns the QR list → frontend prints **unit labels** (same label component as GRN, `qrcode.react`).

> Case I (3 rolls in one production record): the single production record still yields **3 output units** because operator declares 3. Case II (3→6): declare 6. The count is operator-driven at output time.

### 4c. Print labels
Reuse the GRN Stock-Label layout (the image you shared) — swap "GRN" fields for unit fields (Process, Machine, Operator, Qty, Width, Parent Batch, Job Card). One printable label per output unit.

---

## 5. Traceability APIs (recursive CTE over the graph)

- **Backward trace** `GET trace/backward/{unitQR}` → walk `ProductionUnitLink` child→parent recursively until roots; roots join `ItemTransactionDetail` → GRN (`ItemTransactionMain`) → `LedgerMaster` (supplier).
  Returns the full ancestor set (every roll/ink + supplier). *This solves the GSM-defect case: scan the bad pouch box → get the printing roll → the material roll → supplier + supplier batch (4645TY).*
- **Forward trace** `GET trace/forward/{batchOrUnit}` → walk parent→child → all descendants (which pouches came from a given material roll / supplier batch). *For recall: "is supplier ke is batch se kaunse pouch bane".*
- **Graph** `GET trace/graph/{jobContentId}` or `/{unitQR}` → returns nodes + edges (for the diagram): `{ nodes:[{id,label,process,seq,qty,unit,supplier?}], edges:[{from,to,qty}] }`.

Recursive CTE sketch (backward):
```sql
WITH anc AS (
  SELECT l.* FROM ProductionUnitLink l
    JOIN ProductionUnit u ON u.UnitID=l.ChildUnitID
   WHERE u.UnitQR=@qr AND l.IsDeletedTransaction=0
  UNION ALL
  SELECT l2.* FROM ProductionUnitLink l2
    JOIN anc a ON a.ParentType='Unit' AND l2.ChildUnitID=a.ParentUnitID
) SELECT * FROM anc;   -- + join roots to GRN/supplier
```

---

## 6. QR Tracking Page + auto-diagram (new page)

Route: `app/gravure/production/qr-tracking/page.tsx` (4th sub-module).

Layout mock:
```
┌ Toolbar: [Scan QR] [Search Job Card ▾]  Backward ⟷ Forward  [Export]        ┐
├─────────────────────────────────────────────────────────────────────────────┤
│  Columns = process sequence (auto). Nodes = units. Edges = consumption.      │
│                                                                              │
│  SUPPLIER        MATERIAL         PRINTING     LAMINATION   SLITTING   POUCH  │
│  Metro Trading ─ _..._001(400kg) ─ ..-P01 ──── ..-L01 ──┬─ ..-S01 ──── PCH01 │
│  (4645TY,REEL101) [+6 ink cans]                          ├─ ..-S02          ⚠ │
│                                                          ├─ ..-S03            │
│                                                          └─ ..-S04            │
│                                                                              │
│  ⚠ Defect path highlighted red: PCH01 → S01 → L01 → P01 → _..._001 → Metro   │
├─ Node detail panel (on click): process, machine, operator, qty, time, GSM,  ┤
│  supplier, GRN, consumed parents…                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Rendering:** `echarts` is already in the project → use **echarts Graph** (layered/left-right) or **Sankey** (qty-weighted). Fallback: custom SVG columnar-DAG (columns = process sequence, clean for mostly-sequential flow with fan-out at slitting/pouch).
- **Interactions:** scan/enter any QR → auto-loads its graph; click node → detail panel; toggle backward/forward; highlight a path; export PNG/PDF.
- Looks like an ERD/flowchart, **auto-built** from `trace/graph`.

---

## 7. Phasing (build after approval)

- **Phase 1 — Capture:** 2 tables + output-unit generation at Update/Complete + input-scan linking + unit label print. (Makes the graph data exist.)
- **Phase 2 — Trace APIs:** backward / forward / graph endpoints (recursive CTE).
- **Phase 3 — Tracking page:** scan + auto-diagram (echarts) + node detail + export.

---

## 8. Open items / assumptions to confirm

1. **Process codes** (P/L/S/PCH) — from a new column on `ProcessMaster` (e.g. `TraceCode`) or a fixed map? (Recommend a `TraceCode` column, admin-editable.)
2. **Output-unit declaration UX:** default output count = input count, operator edits? (Recommend yes.)
3. **Unit conversion at output** (roll kg → pouch pcs): output unit's `Unit`/`Qty` is just what operator enters in that process's output unit — conversion already handled by "balance = previous production qty" rule from the main flow.
4. **Labels:** reuse GRN label component with unit fields — OK?
5. **Where inks fit:** inks are secondary parents (linked, not in the string). OK per your decision.

Once you approve (and confirm the open items), I'll start **Phase 1**.

---

# REVISION (after studying the reference `IndasEstimoFlexo /roll-tracking`)

The sibling project already ships exactly this feature. We will **port its proven approach** instead of inventing new tables. This supersedes §3 (data model) and §6 (rendering).

## R1. Data model — reuse the reference's `ProductionRoll` (create it; it is NOT in IndusNext yet)
Single-parent chain + CSV-merge, exactly like the reference (makes the recursive CTEs and the frontend tree a straight port):

```sql
CREATE TABLE dbo.ProductionRoll (
    RollID              BIGINT IDENTITY(1,1) PRIMARY KEY,
    BatchNo             NVARCHAR(150) NULL,   -- continued batch string e.g. B2600018-PR1350-PR1355
    QRCode              NVARCHAR(MAX) NULL,   -- JSON QR payload
    ProductionID        BIGINT NULL,          -- FK ProductionEntry (producing run)
    ProductionUpdateID  BIGINT NULL,          -- slitting/update grouping
    ProcessID           BIGINT NULL,
    JobBookingJobCardContentsID BIGINT NULL,
    JobBookingID        BIGINT NULL,
    MachineID           BIGINT NULL,
    ParentTransactionID BIGINT NULL,          -- raw-material issue txn (root)  -> ItemTransactionDetail
    ParentRollID        BIGINT NULL,          -- roll -> roll genealogy (primary parent)
    SpoolID             NVARCHAR(50) NULL,     -- {baseBatch}/{A..Z} per slit lane
    ConsumedFromRolls   NVARCHAR(500) NULL,    -- extra parents (merge) — CSV of RollIDs
    Quantity            DECIMAL(18,3) NULL,
    RemainingQuantity   DECIMAL(18,3) NULL,
    RollUnit            NVARCHAR(20) NULL,
    Status              NVARCHAR(50) NULL,
    CompanyID BIGINT NULL, FYear NVARCHAR(20) NULL, ProductionUnitID BIGINT NULL,
    CreatedBy BIGINT NULL, CreatedDate DATETIME NOT NULL DEFAULT(GETDATE()),
    ModifiedBy BIGINT NULL, ModifiedDate DATETIME NULL,
    IsDeletedTransaction BIT NOT NULL DEFAULT(0)
);
-- + ALTER ProductionEntry ADD ScannedRollIDs NVARCHAR(500) NULL  (CSV of input rolls merged into a run)
```
- `ParentRollID` = roll→roll link (primary substrate, batch continued). `ParentTransactionID` = root material issue → GRN → supplier. `ScannedRollIDs`/`ConsumedFromRolls` = merges (many→one). Source batch/lot/supplier come from `ProductionEntry.PaperBatchNo` + `ItemTransactionDetail`/`ItemTransactionBatchDetail`.
- **No separate link table needed** — single-parent chain + CSV merge is enough for the tree (the reference proves it). (My earlier `ProductionUnit`/`ProductionUnitLink` idea is dropped in favour of this proven shape.)

## R2. Backend — port the recursive CTEs to our Web API 4.8 (raw ADO.NET)
The reference uses Dapper inline recursive CTEs; our `DBConnection.FillDataTable` runs the same T-SQL. New endpoints on `ProductionModuleController` (route `api/productionModule`):
- `GET rolls?search=` — roll list (batch/process/job/qty/status).
- `GET rollgenealogy?rollId=&batchNo=` — returns `{ Chain[], Descendants[], ContentRolls[], SourceItemName/BatchNo/LotNo/SupplierBatchNo/VoucherNo, Consumption[] }` via: backward CTE on `ParentRollID`, forward CTE, whole-content query, root resolve to `ItemTransactionDetail`/`ItemTransactionBatchDetail`/`ItemTransactionMain`.
- Output-roll capture is folded into the existing `start` (record `ScannedRollIDs`) and `update` (insert `ProductionRoll` rows per declared output unit, `BatchNo = parentBatch + '-PR'+RollID`, `ParentRollID`/`ParentTransactionID` set).

## R3. Frontend — port the tree page + export
New route `app/gravure/production/qr-tracking/page.tsx` (add a **"QR Tracking"** toggle/entry). Port the reference's technique verbatim (no graph lib):
- **Tree** = CSS nested `<ul>/<li>` org-chart + one inline `<svg>` for merge (bezier) lines; **hover tooltip** shows Batch, Qty/Remaining, Status, Machine, Operator, Source Batch/Lot, **Supplier Batch**, Production Roll ID, times.
- **Zoom / Fit / Full Screen** = CSS `scale`/`zoom` + `requestFullscreen()`.
- **Export** = `html-to-image` (`toPng`/`toSvg`/`toBlob`) + `jsPDF` + `file-saver` (PNG / SVG / PDF / Copy / Print) — identical to reference.
- **QR label** per roll = `qrcode.react` (`QRCodeCanvas`) → PNG → `jsPDF` (reuse instead of `@react-pdf/renderer`).

## R4. Feasibility check (done, on IndusNext + current frontend)
| Item | Status |
|---|---|
| `ProductionRoll` table | **Missing → create** (DDL above) |
| `ProductionEntry.ScannedRollIDs` | **Missing → ALTER add**; `PaperBatchNo`/`PaperBatchID` already present |
| `ProductionRollReturnRequest` | Missing → optional (returns feature, Phase 4) |
| `jspdf`, `file-saver`, `qrcode.react`, `qrcode`, `jsqr`, `echarts` | ✅ present |
| `html-to-image` | **Install** (`npm i html-to-image`) |
| `@react-pdf/renderer` | Not present → skip; use `jspdf`+`qrcode.react` for labels |

## R5. Revised phases
1. **DB + capture:** create `ProductionRoll`, add `ScannedRollIDs`; generate output rolls at Update/Complete (batch continuation, ParentRollID) + scan input rolls at Start.
2. **Genealogy API:** port recursive-CTE `rollgenealogy` + `rolls`.
3. **QR Tracking page:** port CSS org-chart tree + hover tooltips + zoom/fit/fullscreen + PNG/SVG/PDF/Copy/Print export (install `html-to-image`).
4. (Optional) Return-to-store + thermal slip parity.

Net: this is now a **port of a proven feature**, not net-new design. One npm install (`html-to-image`) + one table + one column, then port backend CTEs and the tree page.
