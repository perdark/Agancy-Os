"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { evaluateProjectArtifact } from "../actions";

/** Runs the quality gate over the imported artifact and refreshes the page. */
export function EvaluateArtifactButton({
  projectId,
  artifactId,
  evaluated,
}: {
  projectId: string;
  artifactId: string;
  evaluated: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onEvaluate = () => {
    setError(null);
    startTransition(async () => {
      const result = await evaluateProjectArtifact({ projectId, artifactId });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={evaluated ? "outline" : "default"}
        onClick={onEvaluate}
        disabled={isPending}
      >
        {isPending
          ? "Evaluating…"
          : evaluated
            ? "Re-run quality gate"
            : "Run quality gate"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
