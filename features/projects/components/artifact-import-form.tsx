"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importProjectArtifact } from "../actions";
import { MOCKUP_SCREENSHOT_MIME_TYPES } from "../schema";

/**
 * The return step of the handoff: screenshots and/or a result URL come back
 * from Claude Design and are stored as the project's rendered artifact, tied
 * to the candidate whose package produced them.
 */
export function ArtifactImportForm({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [resultUrl, setResultUrl] = useState("");
  const filesRef = useRef<HTMLInputElement>(null);

  if (candidates.length === 0) return null;

  const onImport = () => {
    setError(null);
    const files = Array.from(filesRef.current?.files ?? []);
    if (files.length === 0 && resultUrl.trim().length === 0) {
      setError("Add at least one screenshot or the result URL.");
      return;
    }

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("candidateId", candidateId);
    formData.set("resultUrl", resultUrl);
    formData.set("note", "");
    for (const file of files) formData.append("screenshot", file);

    startTransition(async () => {
      const result = await importProjectArtifact(formData);
      if (!result.ok) {
        setError(result.error);
      } else {
        setResultUrl("");
        if (filesRef.current) filesRef.current.value = "";
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="import-candidate">Generated from</Label>
        <select
          id="import-candidate"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={candidateId}
          onChange={(event) => setCandidateId(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="import-screenshots">Mockup screenshots</Label>
        <Input
          id="import-screenshots"
          ref={filesRef}
          type="file"
          multiple
          accept={MOCKUP_SCREENSHOT_MIME_TYPES.join(",")}
          className="max-w-xs"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="import-url">Result URL (optional)</Label>
        <Input
          id="import-url"
          inputMode="url"
          placeholder="https://claude.ai/…"
          value={resultUrl}
          onChange={(event) => setResultUrl(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={onImport} disabled={isPending}>
          {isPending ? "Importing…" : "Import mockup"}
        </Button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
