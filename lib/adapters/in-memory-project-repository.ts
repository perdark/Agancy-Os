import type {
  Project,
  ProjectId,
  ProjectRepository,
  ProjectSummary,
} from "@/domain";
import { STAGE_LABELS } from "@/domain";

/**
 * The Version 1 default persistence adapter.
 *
 * An in-memory implementation of the {@link ProjectRepository} port so the app
 * runs with zero infrastructure. The Drizzle/Postgres adapter (see
 * lib/db/drizzle-project-repository.ts) implements the same port for real
 * persistence; which one is used is a composition decision, not a domain one.
 *
 * NOTE: process-local and non-durable — intended for local development and to
 * keep Version 1 runnable before a database is provisioned.
 */
export class InMemoryProjectRepository implements ProjectRepository {
  private readonly store = new Map<ProjectId, Project>();

  async save(project: Project): Promise<void> {
    this.store.set(project.id, project);
  }

  async findById(id: ProjectId): Promise<Project | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<ProjectSummary[]> {
    return [...this.store.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((p) => ({
        id: p.id,
        businessName: p.identity.businessName,
        currentStage: STAGE_LABELS[p.workflow.currentStage],
        updatedAt: p.updatedAt,
      }));
  }
}
