# Production Module — Full Parity Roadmap (target: 100% of IndasEstimoFlexo production-entry)

Reference: `IndasEstimoFlexo-main/src/app/(main)/production-entry` (10k FE lines) +
`IndasEstimo.Api-master .../ProductionEntry` repository (8k lines). We port to our stack
(ASP.NET Web API 4.8 raw ADO / `ProductionModuleController` + Next.js `app/gravure/production`).

Already done (base): job select (grid/QR), machine(dept)/operator, auto-process (sequence-gated),
material verify, basic line clearance, make-ready, start, In-Process QC gate, production update
(balance=prev qty, part/complete/hold, over-production, semi-packing last process → JobSemiPacking),
dashboard, QR roll capture + genealogy API + tracking page + export + roll labels, job report PDF.

## Phases (ordered by dependency + value) — each = DB + backend + frontend, delivered for review

- **P1 — Unit Conversion Engine** (FOUNDATION). 6-branch conversion (UPS/CUTS/FORMS/SLITTING AC/SHEET UNIT)
  from `ProcessMaster.UnitConversion` + content GSM/CylinderCircumferenceMM/FeedValue/UpsL/UpsW.
  ReadyQuantity = converted output; ProductionQuantity = schedule-unit; received = prev process ready.
  Frontend: 3-unit entry (Mtr/Kg/Pcs), impression guard (block save if no cyl/feed for slitting/sheet),
  RollUnit/RollUnitConversion travel on each roll. **Completed sums ProductionQuantity (not Ready).**

- **P2 — Roll scan-at-start + multi-roll FIFO merge.** Start: scan input rolls (validate-roll-scan),
  multi-select merge (ScannedRollIDs CSV), verify-by-last-digits popup. Backend: idempotent start
  (reuse open Running row), machine-busy guard (PE Running + MachineMaster Active), FIFO parent decrement
  across merged rolls, ConsumedFromRolls record.

- **P3 — Slitting auto 1-to-N + spool lanes.** Backend split by AcrossUps (=UpsL), perRoll=floor(total/n),
  last roll = remainder; SpoolID `{base}/{A..Z}`. Frontend: slitting detection (UnitConversion='Slitting AC'),
  spool slip PDF (lane letter 44pt), available-input vs slit-output tabs.

- **P4 — LC / CTQ / FPA / Inspection full param capture.** Param master + entry tables; get params/next-no/save;
  LC/CTQ saved with ProductionID=0 pre-start then re-linked at start; check-qc + FPA gates block complete;
  print PDFs (LC checksheet, FPA record, inspection). CTQ internal/external split.

- **P5 — Online-process cascade.** Start: placeholder Running PE for IsOnlineProcess between main and next main
  (by SequenceNo). Update: chain online outputs by own conversion (nextInput→opReady), N rolls → N online records,
  mirror status to JBJP+JSR. Online-process grid on update screen.

- **P6 — Make-ready timer + machine status audit + downtime/breakdown.** MachineCurrentStatusEntry intervals
  (setup-start/end, <60s discard); MachineMaster.CurrentStatus Running→Active; downtime/breakdown reasons.

- **P7 — Tool impressions / plate life.** ToolImpressionLog per tool per update; remaining life = PlateLife − SUM(log);
  tool allocation gate (ProcessToolGroupAllocationMaster); return-to-stock netting.

- **P8 — Return-to-store / Send-to-packing / Convert-to-semi-finish.** ProductionRollReturnRequest (Pending→Returned,
  Inventory does stock-in); Sent-to-Packing status + slitting-pending warn + undo; semi-finish stock conversion.

- **P9 — Job-status-modification / stuck jobs / admin + floor consumption + ratings/comments.** status-change,
  reset, close-job, delete-production-detail, schedule-qty edit, add/delete process; floor stock consume;
  ProductionProcessRating; production comments.

- **P10 — Polish + parity QA.** All PDFs, edge cases, transaction safety, UI consistency, end-to-end verification.

## Notes
- IndusNext missing some reference tables/columns — add per phase (already added ProductionRoll, ScannedRollIDs, ProductionQCEntry).
- Reference backend = .NET Core + Dapper; we mirror logic in Web API 4.8 raw ADO (DBConnection). Behaviour parity, not code 1:1.
- Backend rebuild required after each phase's controller changes.
