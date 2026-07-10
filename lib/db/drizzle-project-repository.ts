import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  asProjectId,
  STAGE_LABELS,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
  type StageKind,
} from "@/domain";
import { getDb } from "./client";
import { projects } from "./schema";
import type * as schema from "./schema";
import { toProject, toProjectRow } from "./project-codec";

/**
 * Accepts any Drizzle Postgres database over our schema — postgres-js in
 * production, PGlite in tests — so round-trips are testable without a server.
 */
export type ProjectDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The real persistence adapter: implements the {@link ProjectRepository} port
 * against Postgres via Drizzle. It is the *only* place that knows about rows
 * and columns; mapping and runtime validation live in the codec
 * (see project-codec.ts), so the domain never sees a database shape and a
 * corrupted row fails loudly on read.
 */
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db?: ProjectDatabase) {}

  private database(): ProjectDatabase {
    return this.db ?? getDb();
  }

  async save(project: Project): Promise<void> {
    const row = toProjectRow(project);
    await this.database()
      .insert(projects)
      .values(row)
      .onConflictDoUpdate({ target: projects.id, set: row });
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const rows = await this.database()
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toProject(row) : null;
  }

  async list(): Promise<ProjectSummary[]> {
    const rows = await this.database().select().from(projects);
    return rows
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => ({
        id: asProjectId(row.id),
        businessName: row.businessName,
        currentStage: STAGE_LABELS[row.currentStage as StageKind],
        updatedAt: row.updatedAt,
      }));
  }
}
