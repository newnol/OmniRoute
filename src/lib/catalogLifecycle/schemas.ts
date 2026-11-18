import { z } from "zod";

/**
 * Management payload schemas for fork-owned lifecycle policies.
 * Schemas are intentionally separate from upstream isHidden/connection isActive.
 * Persistence is available before runtime enforcement; do not expose PATCH
 * until all final-dispatch and catalog gates are verified.
 */
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const reason = z.string().max(240).nullable().optional();

export const providerLifecycleIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^\s/\x00-\x1f\x7f]+$/, "Invalid provider identifier");

export const modelLifecycleIdSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((id) => id === id.trim() && !/[\x00-\x1f\x7f]/.test(id), "Invalid model identifier");

export const lifecycleModalitySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,31}$/, "Invalid modality");

export const providerLifecyclePatchSchema = z
  .object({
    expectedRevision: revision,
    presentationHidden: z.boolean().optional(),
    routingDisabled: z.boolean().optional(),
    autoSyncSuppressed: z.boolean().optional(),
    reason,
  })
  .strict()
  .refine(
    (p) =>
      p.presentationHidden !== undefined ||
      p.routingDisabled !== undefined ||
      p.autoSyncSuppressed !== undefined ||
      p.reason !== undefined,
    "At least one field must be provided"
  );

export const modelLifecyclePatchSchema = z
  .object({
    expectedRevision: revision,
    canonicalModelId: modelLifecycleIdSchema,
    modality: lifecycleModalitySchema,
    catalogHidden: z.boolean().optional(),
    routingDisabled: z.boolean().optional(),
    reason,
  })
  .strict()
  .refine(
    (p) =>
      p.catalogHidden !== undefined ||
      p.routingDisabled !== undefined ||
      p.reason !== undefined,
    "At least one field must be provided"
  );
