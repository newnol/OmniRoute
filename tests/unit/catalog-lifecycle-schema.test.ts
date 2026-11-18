import test from "node:test";
import assert from "node:assert/strict";
import {
  providerLifecycleIdSchema,
  providerLifecyclePatchSchema,
  modelLifecyclePatchSchema,
} from "../../src/lib/catalogLifecycle/schemas.ts";

test("provider accepts explicit false and revision zero", () => {
  const value = { expectedRevision: 0, routingDisabled: false };
  assert.deepEqual(providerLifecyclePatchSchema.parse(value), value);
});

test("provider mutation requires a changed field and expected revision", () => {
  assert.equal(providerLifecyclePatchSchema.safeParse({ expectedRevision: 0 }).success, false);
  assert.equal(providerLifecyclePatchSchema.safeParse({ routingDisabled: true }).success, false);
});

test("unknown keys and invalid booleans fail closed", () => {
  assert.equal(
    providerLifecyclePatchSchema.safeParse({
      expectedRevision: 0,
      routingDisabled: true,
      apiKey: "exfiltrate",
    }).success,
    false
  );
  assert.equal(
    providerLifecyclePatchSchema.safeParse({
      expectedRevision: 0,
      routingDisabled: "true",
    }).success,
    false
  );
});

test("provider ID disallows path traversal, slashes and control chars", () => {
  for (const id of ["", "bad/name", "bad\nname", " space"]) {
    assert.equal(providerLifecycleIdSchema.safeParse(id).success, false);
  }
  assert.equal(providerLifecycleIdSchema.safeParse("node:custom-1").success, true);
});

test("model IDs may contain slashes but must be bounded and control-free", () => {
  const patch = {
    expectedRevision: 0,
    canonicalModelId: "meta/llama-3.1-70b",
    modality: "chat",
    catalogHidden: true,
  };
  assert.equal(modelLifecyclePatchSchema.safeParse(patch).success, true);
  assert.equal(
    modelLifecyclePatchSchema.safeParse({ ...patch, canonicalModelId: "x\nsecret" }).success,
    false
  );
  assert.equal(
    modelLifecyclePatchSchema.safeParse({ ...patch, modality: "../../../chat" }).success,
    false
  );
});

test("model policy rejects negative revision, secrets in extra fields and oversized reason", () => {
  const patch = {
    expectedRevision: 2,
    canonicalModelId: "model",
    modality: "chat",
    routingDisabled: true,
  };
  assert.equal(modelLifecyclePatchSchema.safeParse({ ...patch, expectedRevision: -1 }).success, false);
  assert.equal(modelLifecyclePatchSchema.safeParse({ ...patch, extra: "no" }).success, false);
  assert.equal(modelLifecyclePatchSchema.safeParse({ ...patch, reason: "x".repeat(241) }).success, false);
});
