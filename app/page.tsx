import Link from "next/link";
import { STAGE_KINDS, STAGE_LABELS } from "@/domain";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Structure the work, idea → development.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Agency OS is a personal operating system for running a premium digital
          agency. It turns a raw brief into strategy and a prototype direction by
          moving every project through the same disciplined stages — each one
          returning the same contract so you always know what is ready and what
          is not.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/projects/new">Start a project</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/projects">View projects</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          The workflow
        </h2>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STAGE_KINDS.map((kind, i) => (
            <li key={kind} className="flex items-center gap-2">
              <span className="rounded-md border px-3 py-1.5">
                {STAGE_LABELS[kind]}
              </span>
              {i < STAGE_KINDS.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
