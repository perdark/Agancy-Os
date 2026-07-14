"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { extractProjectFacts } from "../actions";

/** Runs fact extraction over the evidence and refreshes the page. */
export function ExtractFactsButton({
  projectId,
  extracted,
}: {
  projectId: string;
  extracted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onExtract = () => {
    setError(null);
    startTransition(async () => {
      const result = await extractProjectFacts({ projectId });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={extracted ? "outline" : "default"}
        onClick={onExtract}
        disabled={isPending}
      >
        {isPending
          ? "Extracting…"
          : extracted
            ? "Re-extract facts"
            : "Extract facts from evidence"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
