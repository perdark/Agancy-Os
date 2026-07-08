import { z } from "zod";
import { PRICE_LEVELS, type GenesisInput } from "@/domain";

/**
 * Edge validation for Project Genesis.
 *
 * Zod guards the *shape* of untrusted input at the boundary (form + server
 * action). The domain's {@link GenesisInput} remains the canonical type — this
 * schema is asserted to produce exactly that, so drift between the form and the
 * domain is a compile error, not a runtime surprise.
 */
export const genesisAssetSchema = z.object({
  label: z.string().min(1, "Label is required"),
  uri: z.string().url("Must be a valid URL"),
  mimeType: z.string().optional(),
});

export const genesisInputSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(120),
  businessType: z.string().min(1, "Business type is required").max(120),
  market: z.string().min(1, "Market is required").max(120),
  country: z.string().min(1, "Country is required").max(120),
  audience: z.string().min(1, "Audience is required").max(280),
  priceLevel: z.enum(PRICE_LEVELS),
  notes: z.string().max(2000).default(""),
  assets: z.array(genesisAssetSchema).default([]),
});

export type GenesisFormValues = z.input<typeof genesisInputSchema>;

/**
 * Compile-time guard: the schema's parsed output must remain assignable to the
 * domain's canonical {@link GenesisInput}. If the two drift apart this line
 * fails to type-check — the coupling is also enforced at the use-case call
 * site, this makes the intent explicit here.
 */
type _SchemaOutputMatchesDomain =
  z.output<typeof genesisInputSchema> extends GenesisInput ? true : never;
export const schemaOutputMatchesDomain: _SchemaOutputMatchesDomain = true;
