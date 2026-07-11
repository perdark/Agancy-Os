"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REGENERATION_SCOPE_LABELS, REGENERATION_SCOPES } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { regenerateProjectCandidate } from "../actions";
import type { CandidateView } from "../candidate-view";

/**
 * Candidate versions (guide §8): every stored direction with its package,
 * provenance, and scoped regeneration. Newest first — the latest attempt is
 * what the operator acts on; older ones remain for comparison and learning.
 */
export function CandidatesCard({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: readonly CandidateView[];
}) {
  if (candidates.length === 0) return null;
  const newestFirst = [...candidates].reverse();

  return (
    <div className="grid gap-4">
      {newestFirst.map((candidate) => (
        <CandidateItem
          key={candidate.id}
          projectId={projectId}
          candidate={candidate}
        />
      ))}
    </div>
  );
}

function CandidateItem({
  projectId,
  candidate,
}: {
  projectId: string;
  candidate: CandidateView;
}) {
  // Entire-scope regenerations carry a full package; only narrower scopes
  // ship an amendment (mirrors candidateClipboardPayload in the domain).
  const isAmendment =
    candidate.regeneration !== undefined &&
    candidate.regeneration.scope !== "entire";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {candidate.approachLabel}
            </CardTitle>
            {candidate.regeneration ? (
              <Badge variant="outline">
                {candidate.regeneration.scopeLabel}
              </Badge>
            ) : null}
          </div>
          <CopyButton
            text={candidate.payload}
            label={isAmendment ? "Copy amendment" : "Copy complete package"}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{candidate.summary}</p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          {candidate.payload}
        </pre>
        <p className="text-xs text-muted-foreground">
          {candidate.provenance} ·{" "}
          {new Date(candidate.createdAtIso).toLocaleString()}
        </p>
        <RegenerateForm projectId={projectId} candidateId={candidate.id} />
      </CardContent>
    </Card>
  );
}

function RegenerateForm({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<(typeof REGENERATION_SCOPES)[number]>(
    "entire",
  );
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          // A reopened form starts from the default scope — a stale scope
          // from an earlier regeneration must never leak into a new request.
          setScope("entire");
          setInstruction("");
          setError(null);
          setOpen(true);
        }}
      >
        Regenerate…
      </Button>
    );
  }

  const scopedWithoutInstruction =
    scope !== "entire" && instruction.trim().length === 0;

  const onRegenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await regenerateProjectCandidate({
        projectId,
        candidateId,
        scope,
        instruction,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setOpen(false);
        setInstruction("");
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap gap-2">
        {REGENERATION_SCOPES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={scope === option ? "default" : "outline"}
            onClick={() => setScope(option)}
          >
            {REGENERATION_SCOPE_LABELS[option]}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`instruction-${candidateId}`}>
          {scope === "entire"
            ? "Correction (optional — regenerates the whole candidate)"
            : "What should change?"}
        </Label>
        <Textarea
          id={`instruction-${candidateId}`}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="e.g. The audience is college staff, not students."
          rows={2}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={onRegenerate}
          disabled={isPending || scopedWithoutInstruction}
        >
          {isPending ? "Regenerating…" : "Regenerate"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
