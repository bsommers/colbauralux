# integrate-qa report
## What I built
docs/LEARNINGS.md; ran all gates. No integration.test.mjs written.
## Verification evidence
npm test 63/63; check-imports 54 files 0 errors; smoke_web OK; strict shots title/play/levels/win clean (out/shots/qa_*.png); botplay exit 0 with flags (L3, L14 autopilot <50% on normal; L1 trivial).
## Deviations from the contract
None.
## Mistakes I made and how I fixed them
First win shot forced the wrong owner (produced a loss); corrected to owner 1.
## Learnings for a future agent
See docs/LEARNINGS.md.
## Requests for other modules
levels: consider L1 trivial-time flag and L3/L14 autopilot win rate (balance only, not defects).
