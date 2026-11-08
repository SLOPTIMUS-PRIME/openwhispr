// OpenRouter distinguishes catalog variants from request-only routing suffixes.
// Keep model IDs intact for inference; use this resolver only for catalog metadata.
const ROUTING_SUFFIXES = new Set(["nitro", "floor", "exacto", "online"]);

export const OPENROUTER_SORT_VARIANTS = [
  {
    id: "nitro",
    label: "Nitro",
    description: "Prefer highest throughput; priority-tier prices may apply.",
  },
  {
    id: "floor",
    label: "Floor",
    description: "Prefer lowest price; flex-tier endpoints may be used.",
  },
  {
    id: "exacto",
    label: "Exacto",
    description: "Prefer quality signals tuned for reliable tool calling.",
  },
] as const;
export type OpenRouterVariant = "nitro" | "floor" | "exacto" | "free";
const SORT_SUFFIXES = new Set<string>(OPENROUTER_SORT_VARIANTS.map((v) => v.id));
const CATALOG_SUFFIXES = new Set(["free", "batch", "thinking", "extended"]);

export function openRouterSort(model: string): string | undefined {
  return model
    .split(":")
    .filter((part) => SORT_SUFFIXES.has(part))
    .at(-1);
}

export function setOpenRouterVariant(
  model: string,
  variant: OpenRouterVariant,
  enabled: boolean
): string {
  if (!model.trim()) return model;
  const [base, ...suffixes] = model.split(":");
  const keep = suffixes.filter((suffix) =>
    variant === "free" ? !CATALOG_SUFFIXES.has(suffix) : !SORT_SUFFIXES.has(suffix)
  );
  if (enabled) keep.push(variant);
  return [base, ...keep].join(":");
}

export function selectOpenRouterModel(
  current: string,
  next: string,
  catalogIds: readonly string[]
): string {
  let result = next;
  const base = next.split(":")[0];
  if (
    current.split(":").includes("free") &&
    !next.includes(":") &&
    catalogIds.includes(base + ":free")
  ) {
    result += ":free";
  }
  const sort = openRouterSort(current);
  if (sort) result = setOpenRouterVariant(result, sort as OpenRouterVariant, true);
  return result;
}

export function openRouterCatalogId(model: string): string {
  return model
    .split(":")
    .filter((part, index) => index === 0 || !ROUTING_SUFFIXES.has(part))
    .join(":");
}
