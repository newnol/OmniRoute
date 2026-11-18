# OmniRoute fork: M0 baseline and implementation gates

**Audit date:** 2026-11-18  
**Status:** source-inspection baseline only. No full checkout, dependency installation, build, migrations, or runtime tests have been performed by this PR.

## Immutable references

- Fork: `newnol/OmniRoute`, `main` at `3337f07a591878cd57d790903f7d86daeb52e4ca` (package reports version `3.8.54`).
- Selected upstream integration reference: `cheaper-inference/OmniRoute` `release/v3.8.55` at `5340875be21a2a0f7c260c695b37ad844838b06e`.
- The fork is **not** assumed to contain every upstream commit. Reconcile fork-only changes and the upstream delta with a complete checkout before syncing/rebasing.
- Source paths below were checked against the fork's `main` through GitHub file reads. They are an audit inventory, not proof that every dispatch path has been covered.

## Verified implementation overlap (do not duplicate)

| Area | Current source | Risk to avoid |
| --- | --- | --- |
| Connection availability | `src/lib/db/providers.ts`, `src/app/(dashboard)/dashboard/providers/page.tsx` | Provider-wide operator disable must not rewrite child `isActive` flags. |
| Hidden model | `src/shared/utils/modelVisibility.ts`, `src/sse/handlers/chat/hiddenModelGate.ts`, `src/app/api/provider-models/route.ts` | Legacy `isHidden` affects dispatch; do not redefine it as UI-only. |
| Model exposure | `src/shared/utils/modelExposureList.ts` | Exposure allow/deny filters listings and auto pools, but does not reject explicitly requested models. |
| Management catalog | `src/app/api/models/catalog/route.ts` | `includeHidden=1` requires management auth. Keep existing response format. |
| Existing quota share | `open-sse/services/combo/quotaShareStrategy.ts`, `open-sse/handlers/chatCore/quotaSharePreHook.ts` | Documented fail-open cannot authorize a new strict resource cap. |
| Management auth | `src/lib/api/requireManagementAuth.ts` | New mutations must follow the current privileged auth and validation patterns. |
| Resilience | `docs/architecture/RESILIENCE_GUIDE.md` | Provider breaker, connection cooldown and model lockout have different scopes. |

## Ordered implementation milestones

1. **M0 — Baseline and source audit (this PR):** record source references, CI/test gap, precise acceptance matrix and safe implementation boundaries.
2. **M1 — Lifecycle domain:** pure effective eligibility; separate persisted provider/model disabled policies with revision checks; integrate into every final dispatch route, catalog, combos, aliases and no-auth candidates; scoped management APIs; then incremental management catalog and UI. No credentials or child connection flags are deleted.
3. **M2 — Scoped recovery:** evidence-based classification and bounded cooldown/half-open per connection or model, preserving authoritative Retry-After.
4. **M3 — Upstream key resource profiles:** validated USD/token/RPM/TPM/concurrency/group limits, *separate* from downstream API key quotas; atomic strict admission (single authoritative SQLite writer only), conservative streaming usage reconciliation; never paid fallback in strict free-only.
5. **M4 — Explainability/operator controls:** redacted trace, safe temporary pause/probe, dashboard and off-hot-path optimization proposals.

Implement as independently reviewable PRs. Do **not** merge untested hard-routing or money/budget logic. Require human review for schema migrations, enabling billed routes, production provider changes and merge to `main`.

## M1 semantics to freeze

- `hidden`: presentation/catalog-only; explicit calls remain routable unless legacy hidden gate forbids them.
- `disabled`: durable policy, blocks new dispatch to the target across all routes; restore does not change child `isActive`.
- `paused`: temporary incident state, expires with TTL but never clears authoritative Retry-After or hard quota budget.
- Unknown/quota telemetry is not proof of `free`. Strict free-only denies an unknown-cost target.
- Every enabled feature must preserve upstream default behavior when turned off.

## Unverified prerequisites

A full Git checkout in an environment with repository/network access is required before any claim of a passing baseline. Read `AGENTS.md`, `src/lib/db/AGENTS.md`, `open-sse/services/AGENTS.md` and `docs/architecture/RESILIENCE_GUIDE.md`; then run:

```bash
npm ci
npm run typecheck:core
npm run check:router-eval
npm run check:db-rules
npm run check:docs-all
```

Run focused Node tests with the per-file `DATA_DIR` isolation specified in `AGENTS.md`. Also inventory all supported modalities, direct routes, retries, aliases, auto and saved combos before enforcing an operator disable. Verify migrations using a disposable copy of a pre-fork database. Record actual failures and regressions rather than assuming green.

## Scope of this PR

Docs only. It deliberately does **not** implement UI toggles, active-only catalog, routing gates, budgets, probing, or a full upstream rebase. See [acceptance matrix](./acceptance-matrix.md) for the release tests.
