// Resources served by app/[locale]/admin/[resource]/[[...rest]] (server-safe list; configs live in registry.tsx).
export const RESOURCE_NAMES = [
  "articles",
  "categories",
  "tags",
  "halls",
  "exhibits",
  "events",
  "slides",
  "galleries",
  "pages",
  "messages",
  "subscribers",
  "users",
  "languages",
  "activity-logs",
] as const;

export type ResourceName = (typeof RESOURCE_NAMES)[number];

export function isResourceName(v: string): v is ResourceName {
  return (RESOURCE_NAMES as readonly string[]).includes(v);
}
