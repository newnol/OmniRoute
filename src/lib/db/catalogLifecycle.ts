/**
 * Fork-owned, transactional provider/model lifecycle policy persistence.
 *
 * No credential, connection-activation, static model or legacy hidden rows are
 * touched. These records are NOT a routing gate until every final-dispatch path
 * is wired; do not expose a production disable control until then.
 */
import { getDbInstance } from "./core";
import type { ProviderLifecycleOverride, ModelLifecycleOverride } from "@/lib/catalogLifecycle/types";

export type ProviderLifecyclePatch = ProviderLifecycleOverride & { reason?: string | null };
export type ModelLifecyclePatch = Omit<Partial<ModelLifecycleOverride>, "modality"> & {
  reason?: string | null;
};

export interface ProviderLifecycleState extends Required<ProviderLifecycleOverride> {
  providerId: string;
  reason: string | null;
  revision: number;
  updatedAt: string | null;
}

export interface ModelLifecycleState {
  providerId: string;
  canonicalModelId: string;
  modality: string;
  catalogHidden: boolean;
  routingDisabled: boolean;
  reason: string | null;
  revision: number;
  updatedAt: string | null;
}

type ProviderRow = {
  provider_id: string;
  presentation_hidden: number;
  routing_disabled: number;
  auto_sync_suppressed: number;
  reason: string | null;
  revision: number;
  updated_at: string;
};

type ModelRow = {
  provider_id: string;
  canonical_model_id: string;
  modality: string;
  catalog_hidden: number;
  routing_disabled: number;
  reason: string | null;
  revision: number;
  updated_at: string;
};

export class LifecycleRevisionConflictError extends Error {
  readonly code = "lifecycle_revision_conflict";
  constructor() {
    super("Lifecycle policy revision has changed; refresh before retrying");
    this.name = "LifecycleRevisionConflictError";
  }
}

function requireKey(value: string, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new RangeError(`Invalid ${field}`);
  }
  return value;
}

function requireRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new RangeError("expectedRevision must be a nonnegative safe integer");
  }
}

function requirePatchBooleans(patch: Record<string, unknown>, fields: string[]): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("Lifecycle patch must be an object");
  }
  for (const field of fields) {
    if (patch[field] !== undefined && typeof patch[field] !== "boolean") {
      throw new TypeError(`Invalid boolean ${field}`);
    }
  }
}

function nextReason(current: string | null, proposed: string | null | undefined): string | null {
  if (proposed === undefined) return current;
  if (proposed === null) return null;
  if (typeof proposed !== "string" || proposed.length > 240) {
    throw new RangeError("reason must be a string of at most 240 characters");
  }
  return proposed.trim() || null;
}

function toProvider(row: ProviderRow): ProviderLifecycleState {
  return {
    providerId: row.provider_id,
    presentationHidden: row.presentation_hidden === 1,
    routingDisabled: row.routing_disabled === 1,
    autoSyncSuppressed: row.auto_sync_suppressed === 1,
    reason: row.reason,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

function toModel(row: ModelRow): ModelLifecycleState {
  return {
    providerId: row.provider_id,
    canonicalModelId: row.canonical_model_id,
    modality: row.modality,
    catalogHidden: row.catalog_hidden === 1,
    routingDisabled: row.routing_disabled === 1,
    reason: row.reason,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

function emptyProvider(providerId: string): ProviderLifecycleState {
  return {
    providerId,
    presentationHidden: false,
    routingDisabled: false,
    autoSyncSuppressed: false,
    reason: null,
    revision: 0,
    updatedAt: null,
  };
}

function emptyModel(providerId: string, canonicalModelId: string, modality: string): ModelLifecycleState {
  return {
    providerId,
    canonicalModelId,
    modality,
    catalogHidden: false,
    routingDisabled: false,
    reason: null,
    revision: 0,
    updatedAt: null,
  };
}

function requireModelKey(providerId: string, modelId: string, modality: string): void {
  requireKey(providerId, "providerId", 128);
  requireKey(modelId, "canonicalModelId", 512);
  if (typeof modality !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(modality)) {
    throw new RangeError("Invalid modality");
  }
}

const PROVIDER_SELECT =
  "SELECT provider_id, presentation_hidden, routing_disabled, auto_sync_suppressed, " +
  "reason, revision, updated_at FROM provider_lifecycle_policies WHERE provider_id = ?";
const MODEL_SELECT =
  "SELECT provider_id, canonical_model_id, modality, catalog_hidden, routing_disabled, " +
  "reason, revision, updated_at FROM model_lifecycle_overrides " +
  "WHERE provider_id = ? AND canonical_model_id = ? AND modality = ?";

export function getProviderLifecycle(providerId: string): ProviderLifecycleState | null {
  requireKey(providerId, "providerId", 128);
  const row = getDbInstance().prepare<ProviderRow>(PROVIDER_SELECT).get(providerId);
  return row ? toProvider(row) : null;
}

export function getModelLifecycle(
  providerId: string,
  canonicalModelId: string,
  modality: string
): ModelLifecycleState | null {
  requireModelKey(providerId, canonicalModelId, modality);
  const row = getDbInstance()
    .prepare<ModelRow>(MODEL_SELECT)
    .get(providerId, canonicalModelId, modality);
  return row ? toModel(row) : null;
}

/** A revision shared across provider/model writes, useful for future catalog invalidation. */
export function getCatalogLifecycleRevision(): number {
  const row = getDbInstance()
    .prepare<{ revision: number }>("SELECT revision FROM catalog_lifecycle_revision WHERE id = 1")
    .get();
  if (!row) throw new Error("Catalog lifecycle migration is not installed");
  return row.revision;
}

/**
 * Write with optimistic revision checking, inside an IMMEDIATE SQLite
 * transaction. The global catalog revision increments only on a change.
 */
export function updateProviderLifecycle(
  providerId: string,
  patch: ProviderLifecyclePatch,
  expectedRevision: number
): ProviderLifecycleState {
  requireKey(providerId, "providerId", 128);
  requireRevision(expectedRevision);
  requirePatchBooleans(patch as Record<string, unknown>, [
    "presentationHidden",
    "routingDisabled",
    "autoSyncSuppressed",
  ]);
  const db = getDbInstance();
  let result: ProviderLifecycleState = emptyProvider(providerId);
  db.immediate(() => {
    const row = db.prepare<ProviderRow>(PROVIDER_SELECT).get(providerId);
    const current = row ? toProvider(row) : emptyProvider(providerId);
    if (current.revision !== expectedRevision) throw new LifecycleRevisionConflictError();
    const next: ProviderLifecycleState = {
      ...current,
      presentationHidden: patch.presentationHidden ?? current.presentationHidden,
      routingDisabled: patch.routingDisabled ?? current.routingDisabled,
      autoSyncSuppressed: patch.autoSyncSuppressed ?? current.autoSyncSuppressed,
      reason: nextReason(current.reason, patch.reason),
    };
    const changed =
      next.presentationHidden !== current.presentationHidden ||
      next.routingDisabled !== current.routingDisabled ||
      next.autoSyncSuppressed !== current.autoSyncSuppressed ||
      next.reason !== current.reason;
    if (!changed) {
      result = current;
      return;
    }
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO provider_lifecycle_policies
       (provider_id, presentation_hidden, routing_disabled, auto_sync_suppressed, reason, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_id) DO UPDATE SET
         presentation_hidden=excluded.presentation_hidden,
         routing_disabled=excluded.routing_disabled,
         auto_sync_suppressed=excluded.auto_sync_suppressed,
         reason=excluded.reason, revision=excluded.revision, updated_at=excluded.updated_at`
    ).run(
      providerId,
      Number(next.presentationHidden),
      Number(next.routingDisabled),
      Number(next.autoSyncSuppressed),
      next.reason,
      next.revision,
      next.updatedAt
    );
    db.prepare("UPDATE catalog_lifecycle_revision SET revision = revision + 1 WHERE id = 1").run();
    result = next;
  });
  return result;
}

export function updateModelLifecycle(
  providerId: string,
  canonicalModelId: string,
  modality: string,
  patch: ModelLifecyclePatch,
  expectedRevision: number
): ModelLifecycleState {
  requireModelKey(providerId, canonicalModelId, modality);
  requireRevision(expectedRevision);
  requirePatchBooleans(patch as Record<string, unknown>, ["catalogHidden", "routingDisabled"]);
  const db = getDbInstance();
  let result: ModelLifecycleState = emptyModel(providerId, canonicalModelId, modality);
  db.immediate(() => {
    const row = db
      .prepare<ModelRow>(MODEL_SELECT)
      .get(providerId, canonicalModelId, modality);
    const current = row ? toModel(row) : emptyModel(providerId, canonicalModelId, modality);
    if (current.revision !== expectedRevision) throw new LifecycleRevisionConflictError();
    const next: ModelLifecycleState = {
      ...current,
      catalogHidden: patch.catalogHidden ?? current.catalogHidden,
      routingDisabled: patch.routingDisabled ?? current.routingDisabled,
      reason: nextReason(current.reason, patch.reason),
    };
    const changed =
      next.catalogHidden !== current.catalogHidden ||
      next.routingDisabled !== current.routingDisabled ||
      next.reason !== current.reason;
    if (!changed) {
      result = current;
      return;
    }
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO model_lifecycle_overrides
       (provider_id, canonical_model_id, modality, catalog_hidden, routing_disabled,
        reason, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_id, canonical_model_id, modality) DO UPDATE SET
         catalog_hidden=excluded.catalog_hidden,
         routing_disabled=excluded.routing_disabled,
         reason=excluded.reason, revision=excluded.revision, updated_at=excluded.updated_at`
    ).run(
      providerId,
      canonicalModelId,
      modality,
      Number(next.catalogHidden),
      Number(next.routingDisabled),
      next.reason,
      next.revision,
      next.updatedAt
    );
    db.prepare("UPDATE catalog_lifecycle_revision SET revision = revision + 1 WHERE id = 1").run();
    result = next;
  });
  return result;
}

export function listModelLifecycles(
  providerId: string,
  limit = 100,
  offset = 0
): ModelLifecycleState[] {
  requireKey(providerId, "providerId", 128);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 ||
      !Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError("Invalid lifecycle pagination");
  }
  const rows = getDbInstance().prepare<ModelRow>(
    "SELECT provider_id, canonical_model_id, modality, catalog_hidden, routing_disabled, " +
    "reason, revision, updated_at FROM model_lifecycle_overrides WHERE provider_id = ? " +
    "ORDER BY canonical_model_id, modality LIMIT ? OFFSET ?"
  ).all(providerId, limit, offset);
  return rows.map(toModel);
}
