import {
  OPENROUTER_SORT_VARIANTS,
  openRouterSort,
  setOpenRouterVariant,
} from "../models/openrouterVariants";

interface Props {
  model: string;
  catalogIds: readonly string[];
  onChange: (value: string) => void;
  scope: "reasoning" | "transcription";
}

export default function OpenRouterModelVariants({ model, catalogIds, onChange, scope }: Props) {
  const sort = openRouterSort(model);
  const free = model.split(":").includes("free");
  const base = model.split(":")[0];
  const hasFree = catalogIds.includes(base + ":free");
  return (
    <fieldset
      className="space-y-2 rounded-md border border-border p-3"
      aria-label="OpenRouter options"
    >
      <legend className="px-1 text-sm font-medium">OpenRouter options</legend>
      <p className="text-xs text-muted-foreground">
        Choose one routing preference, or leave all unchecked for default routing.
      </p>
      {OPENROUTER_SORT_VARIANTS.map((variant) => (
        <label key={variant.id} className="flex items-start gap-2 text-sm">
          <input
            dir="ltr"
            className="mt-0.5 shrink-0 accent-primary"
            type="checkbox"
            aria-label={variant.label}
            checked={sort === variant.id}
            disabled={!model.trim()}
            onChange={(event) =>
              onChange(setOpenRouterVariant(model, variant.id, event.target.checked))
            }
          />
          <span>
            {variant.label}
            <span className="block text-xs text-muted-foreground">{variant.description}</span>
          </span>
        </label>
      ))}
      <label className="flex items-start gap-2 text-sm">
        <input
          dir="ltr"
          className="mt-0.5 shrink-0 accent-primary"
          type="checkbox"
          aria-label="Free"
          checked={free}
          disabled={!model.trim() || (!hasFree && !free)}
          onChange={(event) => onChange(setOpenRouterVariant(model, "free", event.target.checked))}
        />
        <span>
          Free
          <span className="block text-xs text-muted-foreground">
            {hasFree || free
              ? "Use the model's free-tier catalog entry; rate limits apply."
              : "This model has no free-tier entry in the current catalog."}
          </span>
        </span>
      </label>
      {scope === "transcription" && (
        <p className="text-xs text-muted-foreground">
          Suffixes are sent unchanged. OpenRouter's speech-to-text API does not document applying
          routing sorts; Nitro, Floor or Exacto may have no effect on transcription routing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Deprecated Online, Thinking and Extended suffixes are not offered. Batch requires
        OpenRouter's separate Batch API.
      </p>
      <div className="text-xs text-muted-foreground">
        Request model:{" "}
        <code
          dir="ltr"
          className="break-all text-foreground"
          data-testid="openrouter-effective-model"
        >
          {model || "Select a model first"}
        </code>
      </div>
    </fieldset>
  );
}
