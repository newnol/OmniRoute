import type { CatalogEligibility, CatalogTargetContext } from "./types";

/**
 * Pure v1 eligibility: no DB I/O, cache, dispatch, or implied resource costs.
 *
 * Order of precedence: durable provider disable > scoped durable model disable
 * > legacy hard-hidden > inactive selected connection > catalog-only model hide
 * > provider-level automatic sync suppression.
 *
 * This predicate does not make the feature active: every final dispatch path
 * must be integrated and rechecked against authoritative policy revision first.
 */
export function resolveCatalogEligibility(ctx: CatalogTargetContext): CatalogEligibility {
  const providerDisabled = ctx.provider?.routingDisabled === true;
  const scopedModel = ctx.model?.modality === ctx.modality ? ctx.model : null;
  const modelDisabled = scopedModel?.routingDisabled === true;
  const legacyHidden = ctx.legacyModelHidden === true;
  const inactiveConnection = ctx.connectionActive === false;
  const catalogHidden = scopedModel?.catalogHidden === true;
  const syncSuppressed = ctx.provider?.autoSyncSuppressed === true;

  const routable = !providerDisabled && !modelDisabled && !legacyHidden && !inactiveConnection;
  const advertised = routable && !catalogHidden;
  const autoSyncAllowed = !providerDisabled && !syncSuppressed;

  const reasonCode = providerDisabled
    ? "provider_disabled"
    : modelDisabled
      ? "model_disabled"
      : legacyHidden
        ? "legacy_hidden"
        : inactiveConnection
          ? "connection_inactive"
          : catalogHidden
            ? "model_catalog_hidden"
            : syncSuppressed
              ? "provider_sync_suppressed"
              : undefined;

  return {
    advertised,
    routable,
    autoSyncAllowed,
    recoverableInManagement: true,
    ...(reasonCode ? { reasonCode } : {}),
  };
}
