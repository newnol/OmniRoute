import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-fork-lifecycle-"));
const oldDataDir = process.env.DATA_DIR;
const oldBackupFlag = process.env.DISABLE_SQLITE_AUTO_BACKUP;
process.env.DATA_DIR = dataDir;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

const core = await import("../../../src/lib/db/core.ts");
const lifecycle = await import("../../../src/lib/db/catalogLifecycle.ts");

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(dataDir, { recursive: true, force: true });
  if (oldDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = oldDataDir;
  if (oldBackupFlag === undefined) delete process.env.DISABLE_SQLITE_AUTO_BACKUP;
  else process.env.DISABLE_SQLITE_AUTO_BACKUP = oldBackupFlag;
});

test("timestamped migration creates reversible policy tables and revision ledger", () => {
  const db = core.getDbInstance();
  for (const table of [
    "provider_lifecycle_policies",
    "model_lifecycle_overrides",
    "catalog_lifecycle_revision",
  ]) {
    const row = db.prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);
    assert.equal(row?.name, table);
  }
  assert.equal(lifecycle.getCatalogLifecycleRevision(), 0);
});

test("provider policy writes use CAS and never mutate child activation settings", () => {
  const before = lifecycle.getProviderLifecycle("nvidia");
  assert.equal(before, null);
  const next = lifecycle.updateProviderLifecycle(
    "nvidia",
    { routingDisabled: true, reason: "  scheduled maintenance " },
    0
  );
  assert.equal(next.routingDisabled, true);
  assert.equal(next.presentationHidden, false);
  assert.equal(next.reason, "scheduled maintenance");
  assert.equal(next.revision, 1);
  assert.equal(lifecycle.getCatalogLifecycleRevision(), 1);
  assert.deepEqual(lifecycle.getProviderLifecycle("nvidia"), next);
  assert.throws(
    () => lifecycle.updateProviderLifecycle("nvidia", { routingDisabled: false }, 0),
    lifecycle.LifecycleRevisionConflictError
  );
  assert.equal(lifecycle.getProviderLifecycle("nvidia")?.routingDisabled, true);
  assert.equal(lifecycle.getCatalogLifecycleRevision(), 1);
});

test("provider restore is independent of no-auth/connection rows", () => {
  const changed = lifecycle.updateProviderLifecycle(
    "nvidia",
    { routingDisabled: false, presentationHidden: true },
    1
  );
  assert.equal(changed.revision, 2);
  assert.equal(changed.presentationHidden, true);
  assert.equal(changed.routingDisabled, false);
  assert.equal(lifecycle.getCatalogLifecycleRevision(), 2);
});

test("idempotent updates do not inflate global or record revision", () => {
  const old = lifecycle.getProviderLifecycle("nvidia");
  assert.ok(old);
  const revision = lifecycle.getCatalogLifecycleRevision();
  assert.deepEqual(
    lifecycle.updateProviderLifecycle("nvidia", { routingDisabled: false }, old.revision),
    old
  );
  assert.equal(lifecycle.getCatalogLifecycleRevision(), revision);
});

test("model policy survives restart and isolates modalities", () => {
  const chat = lifecycle.updateModelLifecycle(
    "nvidia",
    "org/model-v1",
    "chat",
    { routingDisabled: true, catalogHidden: true },
    0
  );
  assert.equal(chat.revision, 1);
  assert.equal(chat.routingDisabled, true);
  assert.equal(lifecycle.getModelLifecycle("nvidia", "org/model-v1", "image"), null);
  const image = lifecycle.updateModelLifecycle(
    "nvidia",
    "org/model-v1",
    "image",
    { catalogHidden: true },
    0
  );
  assert.equal(image.routingDisabled, false);
  assert.equal(image.catalogHidden, true);
  const beforeRestart = lifecycle.getCatalogLifecycleRevision();
  core.resetDbInstance();
  assert.deepEqual(lifecycle.getModelLifecycle("nvidia", "org/model-v1", "chat"), chat);
  assert.deepEqual(lifecycle.getModelLifecycle("nvidia", "org/model-v1", "image"), image);
  assert.equal(lifecycle.getCatalogLifecycleRevision(), beforeRestart);
});

test("model stale revision blocks update and cannot override a disabled chat model", () => {
  assert.throws(
    () =>
      lifecycle.updateModelLifecycle(
        "nvidia",
        "org/model-v1",
        "chat",
        { routingDisabled: false },
        0
      ),
    lifecycle.LifecycleRevisionConflictError
  );
  assert.equal(lifecycle.getModelLifecycle("nvidia", "org/model-v1", "chat")?.routingDisabled, true);
  const restored = lifecycle.updateModelLifecycle(
    "nvidia",
    "org/model-v1",
    "chat",
    { routingDisabled: false, catalogHidden: false },
    1
  );
  assert.equal(restored.revision, 2);
  assert.equal(restored.routingDisabled, false);
});

test("provider model listing is stable and scoped", () => {
  const models = lifecycle.listModelLifecycles("nvidia", 50);
  assert.deepEqual(
    models.map((m) => [m.canonicalModelId, m.modality]),
    [["org/model-v1", "chat"], ["org/model-v1", "image"]]
  );
  assert.deepEqual(lifecycle.listModelLifecycles("unrelated"), []);
});

test("invalid revisions, model keys, and wrong boolean types fail before writes", () => {
  const rev = lifecycle.getCatalogLifecycleRevision();
  assert.throws(() => lifecycle.updateProviderLifecycle("bad", { routingDisabled: true }, -1));
  assert.throws(() =>
    lifecycle.updateProviderLifecycle("bad", { routingDisabled: 1 as unknown as boolean }, 0)
  );
  assert.throws(() =>
    lifecycle.updateModelLifecycle("nvidia", "", "chat", { routingDisabled: true }, 0)
  );
  assert.throws(() =>
    lifecycle.updateModelLifecycle("nvidia", "gpt-x", "chat", { reason: "x".repeat(241) }, 0)
  );
  assert.equal(lifecycle.getCatalogLifecycleRevision(), rev);
});
