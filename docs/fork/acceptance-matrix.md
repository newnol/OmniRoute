# Fork acceptance matrix (LC-01 to LC-15)

These are **required tests, not passing test results**. Record test code, command, environment and evidence before checking an item.

| ID | Scenario | Required result | Status |
| --- | --- | --- | --- |
| LC-01 | Provider disabled; another eligible provider healthy | Deny all new dispatch to disabled provider, keep other provider usable | TODO |
| LC-02 | Model disabled, then resync/restart | No model resurrection through direct/combo/alias/auto paths | TODO |
| LC-03 | Presentation-only model hide | Hidden from managed picker; explicit call allowed unless legacy hard-hide applies | TODO |
| LC-04 | Provider restored with inactive child connection | Child connection remains inactive | TODO |
| LC-05 | Temporary pause expires with group wallet still exhausted | Wallet admission still denies | TODO |
| LC-06 | One key returns 429 with healthy sibling key | Isolate supported scope; fallback to eligible sibling | TODO |
| LC-07 | Clear local cooldown while authoritative Retry-After applies | Authoritative reset still respected | TODO |
| LC-08 | Only paid backups; strict free-only on | Deny; zero paid dispatch | TODO |
| LC-09 | Disable committed after catalog snapshot, before dispatch | Final revision/eligibility gate rejects | TODO |
| LC-10 | Concurrent reservations at last quota headroom | No strict-cap oversubscription on supported single writer | TODO |
| LC-11 | Partial stream; final usage unknown | No cross-model replay; conservatively retain liability | TODO |
| LC-12 | Legacy isHidden with presentation hide | Existing dispatch denial unchanged | TODO |
| LC-13 | Unauthorized or stale-revision management action | Deny or 409; no mutation; safe audit | TODO |
| LC-14 | Large catalog (1k/5k/10k rows) | Paginated stable query, no initial eager full-model fetch; measure bytes and p95 | TODO |
| LC-15 | Optimization agent stopped; target disabled | Routing still works and disable remains authoritative | TODO |

## Release gating

Do not mark a scenario complete without a reproducible automated assertion. Include a disabled-provider no-auth connection, an explicit `provider/model` request, saved combo, aliases, `auto/*`, retry and the supported non-chat modality entrypoints. Run migrations against both a fresh DB and disposable backed-up old DB. For budgets, document the supported deployment topology (local single SQLite writer vs unsupported multi-replica).
