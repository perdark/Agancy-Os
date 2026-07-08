import type { ProjectId } from "../shared/id";
import type { Project } from "./project";

/**
 * ProjectRepository — the persistence *port*.
 *
 * The domain declares what it needs from storage; the infrastructure layer
 * (Drizzle/Postgres, an in-memory fake in tests) provides it. Nothing in the
 * domain imports a database. This is the line that keeps "design the domain,
 * not the tables" true: the schema serves this interface, not the other way
 * round.
 */
export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  list(): Promise<ProjectSummary[]>;
}

/** A lightweight projection for list views — avoids loading whole aggregates. */
export interface ProjectSummary {
  readonly id: ProjectId;
  readonly businessName: string;
  readonly currentStage: string;
  readonly updatedAt: Date;
}
