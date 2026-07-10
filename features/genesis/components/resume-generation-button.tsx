"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resumeProjectGeneration } from "../actions";

/**
 * Retries generation for a saved project. Only the stages that still need
 * work re-run server-side; the page refreshes to show the new run states
 * either way — success or an honestly recorded failure.
 */
export function ResumeGenerationButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onResume = () => {
    setError(null);
    startTransition(async () => {
      const result = await resumeProjectGeneration(projectId);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={onResume} disabled={isPending} size="sm">
        {isPending ? "Resuming…" : "Resume generation"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
