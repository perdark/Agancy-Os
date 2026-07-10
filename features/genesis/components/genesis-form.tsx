"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRICE_LEVELS, PRICE_LEVEL_LABELS } from "@/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitGenesisIntake } from "../actions";
import {
  GENESIS_EVIDENCE_MIME_TYPES,
  GENESIS_INPUT_LIMITS,
  GENESIS_LOGO_MIME_TYPES,
  genesisAssetSchema,
  genesisInputSchema,
  type GenesisFormValues,
} from "../schema";

/**
 * The Project Genesis intake — the entry point of Version 1.
 *
 * Leads with what actually wins the meeting (the guide's §8 hierarchy): the
 * client's real logo and available evidence, then the brief. Files travel as
 * one multipart submission to the server action, which re-validates everything
 * — client checks here exist only for fast feedback and are never trusted.
 */
export function GenesisForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [failedProjectId, setFailedProjectId] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [assetError, setAssetError] = useState<string | null>(null);

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

  const validateFiles = (): string | null => {
    if (logoFile && !isAllowed(logoFile, GENESIS_LOGO_MIME_TYPES)) {
      return "The logo must be an image (PNG, JPEG, WebP, SVG, or GIF).";
    }
    for (const file of evidenceFiles) {
      if (!isAllowed(file, GENESIS_EVIDENCE_MIME_TYPES)) {
        return `"${file.name}" is not a supported evidence type (images or PDF).`;
      }
    }
    const all = [...(logoFile ? [logoFile] : []), ...evidenceFiles];
    if (all.some((file) => file.size > GENESIS_INPUT_LIMITS.assetFileBytes)) {
      return "Each file must be 10 MB or smaller.";
    }
    if (
      all.reduce((total, file) => total + file.size, 0) >
      GENESIS_INPUT_LIMITS.totalAssetFileBytes
    ) {
      return "All files together must stay under 50 MB.";
    }
    if (all.length > GENESIS_INPUT_LIMITS.assets) {
      return `Attach at most ${GENESIS_INPUT_LIMITS.assets} files.`;
    }
    return null;
  };

  const onSubmit = (values: GenesisFormValues) => {
    setFormError(null);
    setFailedProjectId(null);

    const fileProblem = validateFiles();
    if (fileProblem) {
      setAssetError(fileProblem);
      return;
    }

    const linkAssets = [];
    if (instagramUrl.trim()) {
      const parsed = genesisAssetSchema.safeParse({
        label: "Instagram",
        uri: instagramUrl,
      });
      if (!parsed.success) {
        setAssetError("The Instagram / evidence link must be a valid URL.");
        return;
      }
      linkAssets.push({ label: "Instagram", uri: instagramUrl.trim() });
    }
    setAssetError(null);

    const formData = new FormData();
    formData.set("payload", JSON.stringify({ ...values, assets: linkAssets }));
    if (logoFile) formData.set("logo", logoFile);
    for (const file of evidenceFiles) formData.append("evidence", file);

    startTransition(async () => {
      const result = await submitGenesisIntake(formData);
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
      <Field
        label="Business name"
        error={errors.businessName?.message}
        htmlFor="businessName"
      >
        <Input id="businessName" {...register("businessName")} />
      </Field>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <h3 className="text-sm font-medium">Client identity & evidence</h3>
          <p className="text-xs text-muted-foreground">
            The real logo and whatever material you already have — this is what
            makes the prototype specific instead of generic.
          </p>
        </div>

        <LogoField file={logoFile} onChange={setLogoFile} />

        <Field label="Instagram or evidence link" htmlFor="instagramUrl">
          <Input
            id="instagramUrl"
            inputMode="url"
            placeholder="https://instagram.com/…"
            value={instagramUrl}
            onChange={(event) => setInstagramUrl(event.target.value)}
          />
        </Field>

        <EvidenceField files={evidenceFiles} onChange={setEvidenceFiles} />

        {assetError ? (
          <p className="text-xs text-red-600" role="alert">
            {assetError}
          </p>
        ) : null}
      </div>

      <Field
        label="What you know about the prospect"
        error={errors.notes?.message}
        htmlFor="notes"
        hint='Any real-world detail helps — e.g. "the cafe is near a college".'
      >
        <Textarea id="notes" rows={4} {...register("notes")} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
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
      </div>

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
          {isPending
            ? "Building first-meeting kit…"
            : "Generate first-meeting prototype"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Decodes the brief, then builds the first-meeting kit (two AI steps —
          can take a couple of minutes).
        </p>
      </div>
    </form>
  );
}

const isAllowed = (file: File, allowlist: readonly string[]): boolean =>
  allowlist.includes(file.type.toLowerCase());

/** Object URL for an image file, revoked automatically when it changes. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(
    () =>
      file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    [file],
  );
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function LogoField({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(file);

  return (
    <div className="space-y-2">
      <Label htmlFor="logo">Logo</Label>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img
            src={previewUrl}
            alt="Logo preview"
            className="h-16 w-16 rounded-md border object-contain p-1"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Logo
          </div>
        )}
        <div className="space-y-1">
          <Input
            id="logo"
            ref={inputRef}
            type="file"
            accept={GENESIS_LOGO_MIME_TYPES.join(",")}
            className="max-w-xs"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                onChange(null);
              }}
            >
              Remove {file.name}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              The client&apos;s real logo file — it drives the visual identity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceField({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="evidence">Screenshots & files</Label>
      <Input
        id="evidence"
        ref={inputRef}
        type="file"
        multiple
        accept={GENESIS_EVIDENCE_MIME_TYPES.join(",")}
        className="max-w-xs"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) onChange([...files, ...picked]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 text-xs"
            >
              <EvidenceThumb file={file} />
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="text-muted-foreground underline underline-offset-2"
                onClick={() =>
                  onChange(files.filter((_, other) => other !== index))
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Instagram screenshots, the menu, price lists — anything real
          (images or PDF).
        </p>
      )}
    </div>
  );
}

function EvidenceThumb({ file }: { file: File }) {
  const url = useObjectUrl(file);
  if (!url) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded border text-[10px] uppercase text-muted-foreground">
        {file.type === "application/pdf" ? "pdf" : "file"}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
  return (
    <img
      src={url}
      alt=""
      className="h-8 w-8 rounded border object-cover"
    />
  );
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

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
