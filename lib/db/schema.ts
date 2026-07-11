import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Persistence schema — derived FROM the domain, never the reverse.
 *
 * The Project aggregate is the source of truth (see packages/domain). Here we
 * make a pragmatic mapping choice: the stable, queryable "front matter"
 * (identity + workflow pointer) lives in columns, while the rich, evolving
 * sub-structures (discovery, knowledge, documents, assets, history, stage
 * results) are stored as JSONB.
 *
 * Why JSONB for the aggregate body: it honours "design the domain, not the
 * tables". The domain model can grow — new fields, new stages — without a
 * migration per change, and no premature normalisation is imposed on shapes we
 * are still discovering. When a sub-structure earns its own query patterns, it
 * can be promoted to a real table behind the same repository port with no
 * change to the domain or callers.
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),

  // Identity — queryable columns.
  businessName: text("business_name").notNull(),
  businessType: text("business_type").notNull(),
  market: text("market").notNull(),
  country: text("country").notNull(),
  audience: text("audience").notNull(),
  priceLevel: text("price_level").notNull(),
  notes: text("notes").notNull().default(""),

  // Workflow pointer — queryable column; results live in the JSONB body.
  currentStage: text("current_stage").notNull().default("discovery"),

  // The rest of the aggregate, serialised. See the note above.
  discovery: jsonb("discovery").notNull(),
  knowledge: jsonb("knowledge").notNull(),
  workflowResults: jsonb("workflow_results").notNull(),
  workflowRuns: jsonb("workflow_runs").notNull().default({}),
  candidates: jsonb("candidates").notNull().default([]),
  artifacts: jsonb("artifacts").notNull().default([]),
  documents: jsonb("documents").notNull(),
  assets: jsonb("assets").notNull(),
  history: jsonb("history").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
