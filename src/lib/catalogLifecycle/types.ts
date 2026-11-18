/**
 * Fork-owned lifecycle controls are deliberately distinct from the existing
 * upstream model-compat `isHidden` flag and connection `isActive` state.
 *
 * Pure contracts only: persistence and policy mutation are separate concerns.
 */
export type CatalogModality = "chat" | "image" | "audio" | "embedding" | "rerank" | "video" | "moderation" | "music" | (string & {});

export interface ProviderLifecycleOverride {
  /** Presentation-only hiding of the provider card; never disables dispatch. */
  presentationHidden?: boolean;
  /** Durable operator intent. Applies to every connection including no-auth. */
  routingDisabled?: boolean;
  /** Disables automatic provider discovery, but not explicit authorized diagnostics. */
  autoSyncSuppressed?: boolean;
}

export interface ModelLifecycleOverride {
  /** A stored model override applies only to its named modality. */
  modality: CatalogModality;
  /** Suppresses advertisement in the curated catalog, not direct dispatch. */
  catalogHidden?: boolean;
  /** Durable operator intent, including explicit calls and saved combos. */
  routingDisabled?: boolean;
}

export interface CatalogTargetContext {
  provider?: ProviderLifecycleOverride | null;
  model?: ModelLifecycleOverride | null;
  modality: CatalogModality;
  /** Existing upstream hard-hidden model flag, already scoped for modality. */
  legacyModelHidden?: boolean;
  /** Eligibility of the selected connection (not the provider as a whole). */
  connectionActive?: boolean;
}

export type CatalogEligibilityReason =
  | "provider_disabled"
  | "model_disabled"
  | "legacy_hidden"
  | "connection_inactive"
  | "model_catalog_hidden"
  | "provider_sync_suppressed";

export interface CatalogEligibility {
  /** Whether to advertise this target in a curated public catalog. */
  advertised: boolean;
  /** Hard target routing gate, including direct/auto/combo/alias/retry routes. */
  routable: boolean;
  /** Whether this provider may run automatic discovery/sync. */
  autoSyncAllowed: boolean;
  /** Operator management page can always find disabled/hidden resources. */
  recoverableInManagement: true;
  /** First denial or suppression reason in documented precedence. */
  reasonCode?: CatalogEligibilityReason;
}
