/**
 * Compatibility facade for the canonical health-module contracts.
 *
 * Keep imports pointed here while the catalog, measurement groups and
 * snapshot-derived metrics evolve independently behind this stable API.
 */
export * from './healthModuleCatalog'
export * from './healthModuleMeasurements'
export * from './healthModuleSnapshot'
