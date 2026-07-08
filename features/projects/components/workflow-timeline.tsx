import {
  STAGE_KINDS,
  STAGE_LABELS,
  stageStatus,
  type Workflow,
} from "@/domain";
import { cn } from "@/lib/utils";

/**
 * Renders the seven-stage workflow as a horizontal timeline, reading status
 * straight from the domain (`stageStatus`). It enumerates `STAGE_KINDS`, so a
 * newly registered stage appears here automatically.
 */
export function WorkflowTimeline({ workflow }: { workflow: Workflow }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGE_KINDS.map((kind) => {
        const status = stageStatus(workflow, kind);
        return (
          <li
            key={kind}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              status === "current" && "border-primary bg-primary/5 font-medium",
              status === "done" && "border-emerald-500/40 bg-emerald-500/5",
              status === "upcoming" && "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                status === "current" && "bg-primary",
                status === "done" && "bg-emerald-500",
                status === "upcoming" && "bg-muted-foreground/30",
              )}
              aria-hidden
            />
            {STAGE_LABELS[kind]}
          </li>
        );
      })}
    </ol>
  );
}
