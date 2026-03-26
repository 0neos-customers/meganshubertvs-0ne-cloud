# 0ne Cloud -- State

> Last updated: 2026-02-28

## Current Phase
KPI Dashboard feature complete (verification pending). Skool GHL Sync functional with channel management complete.

## What's Done

### KPI Dashboard (Feature Complete - 2026-02-10)
- All 6 implementation phases complete
- Cohorts EPL/LTV calculations from ghl_transactions
- Funnel page with live contacts by stage
- Overview trends chart with real weekly data
- Recent activity feed showing contact movements
- Delete expense API with system expense protection
- Daily snapshots cron with ad spend aggregation
- Historical trend data for period-over-period changes
- Daily notifications feature
- Skool MRR integration
- Funnel structure: Leads -> Hand Raisers -> Qualified -> [Good Credit -> VIP -> Funded | Bad Credit -> Premium]

### Skool GHL Sync (Functional - Feb 18, 2026)
- Bidirectional sync working (Skool <-> GHL <-> 0ne Inbox)
- Extension-first architecture (no server-side Skool API calls)
- ID column migration complete (user_id -> clerk_user_id / staff_skool_id)
- Mixed-ID bug in dm_messages fixed
- Conversation channel management with placeholder ID resolution and per-staff caching
- Hand-raiser outbound DMs fully working end-to-end

## Blockers

### KPI Dashboard
- Jimmy needs to build GHL Revenue Workflows (Premium $99/mo, VIP yearly) in GHL UI
- `CRON_SECRET` needs to be added to Vercel environment variables
- Manual verification checklist not yet run

## Open Product Concerns

### Build Cost Mitigation for Non-Technical Clients
**Problem:** Clients using 0ne Cloud who aren't developers may push constantly for every tiny change without using local dev previews, burning through Vercel build minutes (Pro = 24,000/mo, ~$0.01/min overage).

**Mitigations to evaluate:**
- [ ] **Ignored Build Step** — Vercel setting: bash script that skips builds when only non-app files changed (docs, markdown, config). Biggest single lever.
- [ ] **Preview deployment limits** — Restrict which branches trigger preview builds (PR-only, not every push)
- [ ] **Spend alerts / hard caps** — Vercel Pro spend management to catch runaway usage early
- [ ] **Client education** — Onboarding guidance: "run `bun dev` locally, push only when ready"
- [ ] **Research findings** — See research on how vibe-coding platforms (Lovable, Bolt, etc.) and other SaaS handle this. May reveal better patterns (build caching, incremental deploys, alternative hosts, etc.)

**Context:** This is a product-level concern for the SaaS offering, not Jimmy's personal usage. Non-technical clients won't naturally batch their pushes or use local previews.

## Next Steps
1. **KPI Dashboard:** Jimmy runs verification checklist in browser
2. **KPI Dashboard:** Add `CRON_SECRET` to Vercel, build GHL Revenue Workflows
3. **KPI Dashboard:** Phase 7 (Test Suite) when stable
4. **Skool GHL Sync:** Monitor for edge cases in production
