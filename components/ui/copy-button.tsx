"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

/**
 * Copies the given text to the clipboard.
 *
 * Clipboard access can be unavailable (non-secure origin) or reject (denied
 * permission); both failure shapes are caught and surfaced as a visible,
 * screen-reader-announced "failed" state instead of an unhandled rejection.
 */
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          if (!navigator.clipboard) {
            throw new Error("Clipboard API is unavailable on this origin.");
          }
          await navigator.clipboard.writeText(text);
          setState("copied");
          setTimeout(() => setState("idle"), 2000);
        } catch {
          setState("failed");
          setTimeout(() => setState("idle"), 4000);
        }
      }}
    >
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed — select the text manually"
            : label}
      </span>
    </Button>
  );
}
