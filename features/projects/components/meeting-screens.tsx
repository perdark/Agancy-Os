"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Simple navigation through the mockup's key screens (guide Step 7.2): one
 * screen at a time, previous/next, a counter — nothing that needs
 * explanation in front of a client.
 */
export function MeetingScreens({
  projectId,
  screenshots,
}: {
  projectId: string;
  screenshots: readonly { id: string; label: string }[];
}) {
  const [index, setIndex] = useState(0);
  if (screenshots.length === 0) return null;
  const current = screenshots[Math.min(index, screenshots.length - 1)]!;

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the asset port, not an optimizable static asset */}
      <img
        src={`/api/assets/${projectId}/${current.id}`}
        alt={current.label}
        className="max-h-[70vh] w-full rounded-lg border object-contain"
      />
      {screenshots.length > 1 ? (
        <div className="flex items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex((index + screenshots.length - 1) % screenshots.length)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {index + 1} / {screenshots.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex((index + 1) % screenshots.length)}
          >
            Next →
          </Button>
        </div>
      ) : null}
    </div>
  );
}
