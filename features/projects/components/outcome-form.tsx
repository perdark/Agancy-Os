"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEAL_STATUS_LABELS, DEAL_STATUSES } from "@/domain";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { recordProjectOutcome } from "../actions";

/** Record one meeting's result — append-only, honest, quick to fill in. */
export function OutcomeForm({
  projectId,
  candidates,
  artifactId,
}: {
  projectId: string;
  candidates: readonly { id: string; label: string }[];
  artifactId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [deal, setDeal] = useState<(typeof DEAL_STATUSES)[number]>("pending");
  const [reaction, setReaction] = useState("");
  const [operatorChanges, setOperatorChanges] = useState("");
  const [clientChanges, setClientChanges] = useState("");
  const [whyItWorked, setWhyItWorked] = useState("");

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Record a meeting outcome…
      </Button>
    );
  }

  const onRecord = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordProjectOutcome({
        projectId,
        candidateId,
        artifactId: artifactId ?? "",
        deal,
        reaction,
        operatorChanges,
        clientChanges,
        whyItWorked,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setOpen(false);
        setReaction("");
        setOperatorChanges("");
        setClientChanges("");
        setWhyItWorked("");
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="outcome-candidate">Presented candidate</Label>
        <select
          id="outcome-candidate"
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
      <div className="flex flex-wrap gap-2">
        {DEAL_STATUSES.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={deal === status ? "default" : "outline"}
            onClick={() => setDeal(status)}
          >
            {DEAL_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
      <Field
        id="outcome-reaction"
        label="Client reaction & objections"
        value={reaction}
        onChange={setReaction}
      />
      <Field
        id="outcome-operator-changes"
        label="What you changed before the meeting"
        value={operatorChanges}
        onChange={setOperatorChanges}
      />
      <Field
        id="outcome-client-changes"
        label="What the client asked to change"
        value={clientChanges}
        onChange={setClientChanges}
      />
      <Field
        id="outcome-why"
        label="Why this direction worked or failed"
        value={whyItWorked}
        onChange={setWhyItWorked}
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={onRecord} disabled={isPending}>
          {isPending ? "Recording…" : "Record outcome"}
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

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
