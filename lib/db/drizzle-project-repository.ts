import { eq } from "drizzle-orm";
import {
  asProjectId,
  STAGE_LABELS,
  type Asset,
  type Discovery,
  type Document,
  type HistoryEvent,
  type Knowledge,
  type PriceLevel,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
  type StageKind,
  type Workflow,
} from "@/domain";
import { getDb } from "./client";
import { projects, type NewProjectRow, type ProjectRow } from "./schema";

/**
 * The real persistence adapter: implements the {@link ProjectRepository} port
 * against Postgres via Drizzle. It is the *only* place that knows about rows
 * and columns. Mapping between the aggregate and the row is confined to the two
 * functions below, so the domain never sees a database shape.
 */
export class DrizzleProjectRepository implements ProjectRepository {
  async save(project: Project): Promise<void> {
    const row = toRow(project);
    await getDb()
      .insert(projects)
      .values(row)
      .onConflictDoUpdate({ target: projects.id, set: row });
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const rows = await getDb()
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async list(): Promise<ProjectSummary[]> {
    const rows = await getDb().select().from(projects);
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

const toRow = (project: Project): NewProjectRow => ({
  id: project.id,
  businessName: project.identity.businessName,
  businessType: project.identity.businessType,
  market: project.identity.market,
  country: project.identity.country,
  audience: project.identity.audience,
  priceLevel: project.identity.priceLevel,
  notes: project.identity.notes,
  currentStage: project.workflow.currentStage,
  discovery: project.discovery,
  knowledge: project.knowledge,
  workflowResults: project.workflow.results,
  documents: project.documents,
  assets: project.assets,
  history: project.history,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const toDomain = (row: ProjectRow): Project => {
  const workflow: Workflow = {
    currentStage: row.currentStage as StageKind,
    results: row.workflowResults as Workflow["results"],
  };

  return {
    id: asProjectId(row.id),
    identity: {
      businessName: row.businessName,
      businessType: row.businessType,
      market: row.market,
      country: row.country,
      audience: row.audience,
      priceLevel: row.priceLevel as PriceLevel,
      notes: row.notes,
    },
    discovery: row.discovery as Discovery,
    knowledge: row.knowledge as Knowledge,
    workflow,
    documents: row.documents as Document[],
    assets: row.assets as Asset[],
    history: row.history as HistoryEvent[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
