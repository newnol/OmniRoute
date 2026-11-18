import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCatalogEligibility } from "../../src/lib/catalogLifecycle/effectiveEligibility.ts";

const chat = { modality: "chat" } as const;

test("default operator policy leaves existing routing and catalog unaffected", () => {
  assert.deepEqual(resolveCatalogEligibility(chat), {
    advertised: true,
    routable: true,
    autoSyncAllowed: true,
    recoverableInManagement: true,
  });
});

test("provider presentation-only hide cannot disable catalog/routing/sync", () => {
  const state = resolveCatalogEligibility({ ...chat, provider: { presentationHidden: true } });
  assert.equal(state.advertised, true);
  assert.equal(state.routable, true);
  assert.equal(state.autoSyncAllowed, true);
  assert.equal(state.recoverableInManagement, true);
});

test("durable provider disable dominates a model that is individually enabled", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    provider: { routingDisabled: true },
    model: { modality: "chat", routingDisabled: false },
  });
  assert.deepEqual(state, {
    advertised: false,
    routable: false,
    autoSyncAllowed: false,
    recoverableInManagement: true,
    reasonCode: "provider_disabled",
  });
});

test("restoring a provider does not change inactive child connection", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    provider: { routingDisabled: false },
    connectionActive: false,
  });
  assert.equal(state.routable, false);
  assert.equal(state.reasonCode, "connection_inactive");
});

test("model disable is strict within its modality only", () => {
  const model = { modality: "chat", routingDisabled: true } as const;
  const denied = resolveCatalogEligibility({ ...chat, model });
  const image = resolveCatalogEligibility({ modality: "image", model });
  assert.equal(denied.routable, false);
  assert.equal(denied.reasonCode, "model_disabled");
  assert.equal(image.routable, true);
  assert.equal(image.advertised, true);
});

test("presentation-only model hide suppresses listing but not explicit dispatch", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    model: { modality: "chat", catalogHidden: true },
  });
  assert.equal(state.advertised, false);
  assert.equal(state.routable, true);
  assert.equal(state.reasonCode, "model_catalog_hidden");
});

test("upstream legacy hidden is still a hard denial even with new presentation hide", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    model: { modality: "chat", catalogHidden: true },
    legacyModelHidden: true,
  });
  assert.equal(state.routable, false);
  assert.equal(state.advertised, false);
  assert.equal(state.reasonCode, "legacy_hidden");
});

test("sync suppression alone does not disable model routing", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    provider: { autoSyncSuppressed: true },
  });
  assert.equal(state.routable, true);
  assert.equal(state.advertised, true);
  assert.equal(state.autoSyncAllowed, false);
  assert.equal(state.reasonCode, "provider_sync_suppressed");
});

test("known disabled state stays denied even when other facts are absent", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    provider: { routingDisabled: true },
    legacyModelHidden: false,
  });
  assert.equal(state.routable, false);
});

test("a model hidden for image does not hide the same id for chat", () => {
  const state = resolveCatalogEligibility({
    ...chat,
    model: { modality: "image", catalogHidden: true },
  });
  assert.equal(state.advertised, true);
});
