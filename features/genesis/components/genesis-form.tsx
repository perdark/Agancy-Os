"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRICE_LEVELS, PRICE_LEVEL_LABELS } from "@/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProjectFromGenesis } from "../actions";
import { genesisInputSchema, type GenesisFormValues } from "../schema";

/**
 * The Project Genesis form — the entry point of Version 1.
 *
 * React Hook Form + Zod validate on the client for fast feedback; the same Zod
 * schema re-runs in the server action, so validation is never trusted from the
 * browser alone. On success the server returns the new project id and the
 * client navigates to it.
 */
export function GenesisForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [failedProjectId, setFailedProjectId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenesisFormValues>({
    resolver: zodResolver(genesisInputSchema),
    defaultValues: {
      businessName: "",
      businessType: "",
      market: "",
      country: "",
      audience: "",
      priceLevel: "premium",
      notes: "",
      assets: [],
    },
  });

  const onSubmit = (values: GenesisFormValues) => {
    setFormError(null);
    setFailedProjectId(null);
    startTransition(async () => {
      const result = await createProjectFromGenesis(values);
      if (result.ok) {
        router.push(`/projects/${result.projectId}`);
      } else {
        setFormError(result.error);
        // A stage failure still saved the draft — offer the retry path.
        setFailedProjectId(result.projectId ?? null);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Business name"
          error={errors.businessName?.message}
          htmlFor="businessName"
        >
          <Input id="businessName" {...register("businessName")} />
        </Field>

        <Field
          label="Business type"
          error={errors.businessType?.message}
          htmlFor="businessType"
        >
          <Input
            id="businessType"
            placeholder="e.g. specialty coffee roaster"
            {...register("businessType")}
          />
        </Field>

        <Field label="Market" error={errors.market?.message} htmlFor="market">
          <Input id="market" {...register("market")} />
        </Field>

        <Field
          label="Country"
          error={errors.country?.message}
          htmlFor="country"
        >
          <Input id="country" {...register("country")} />
        </Field>

        <Field
          label="Price level"
          error={errors.priceLevel?.message}
          htmlFor="priceLevel"
        >
          <select
            id="priceLevel"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...register("priceLevel")}
          >
            {PRICE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {PRICE_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Audience"
          error={errors.audience?.message}
          htmlFor="audience"
        >
          <Input
            id="audience"
            placeholder="Who is this for?"
            {...register("audience")}
          />
        </Field>
      </div>

      <Field
        label="Notes"
        error={errors.notes?.message}
        htmlFor="notes"
        hint="Anything else that shapes the brief (optional)."
      >
        <Textarea id="notes" rows={4} {...register("notes")} />
      </Field>

      {formError ? (
        <p className="text-sm text-red-600" role="alert">
          {formError}
          {failedProjectId ? (
            <>
              {" "}
              Your draft was saved —{" "}
              <a
                className="font-medium underline underline-offset-2"
                href={`/projects/${failedProjectId}`}
              >
                open it to resume
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Building first-meeting kit…" : "Create project"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Decodes the brief, then builds the first-meeting kit (two AI steps —
          can take a couple of minutes).
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
