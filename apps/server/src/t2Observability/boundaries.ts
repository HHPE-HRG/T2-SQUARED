export const T2_CATALOG_BOUNDARIES = [
  "rpc",
  "orchestration",
  "provider-turn",
  "git",
  "sqlite",
  "terminal",
] as const;

export type T2CatalogBoundary = (typeof T2_CATALOG_BOUNDARIES)[number];
