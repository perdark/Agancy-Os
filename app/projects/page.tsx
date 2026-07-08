import Link from "next/link";
import { listProjects } from "@/features/projects/service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No projects yet</CardTitle>
            <CardDescription>
              Run Project Genesis to capture a brief and begin the workflow.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {project.businessName}
                    </CardTitle>
                    <CardDescription>
                      Stage: {project.currentStage} · Updated{" "}
                      {project.updatedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
