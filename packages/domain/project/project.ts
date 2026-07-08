import type { Clock } from "../shared/clock";
import { asHistoryEventId, asProjectId, type ProjectId } from "../shared/id";
import type { IdGenerator } from "../shared/id";
import { initialWorkflow, type Workflow } from "../workflow/workflow";
import type { Asset } from "./assets";
import { emptyDiscovery, type Discovery } from "./discovery";
import type { Document } from "./documents";
import type { HistoryEvent } from "./history";
import { emptyKnowledge, type Knowledge } from "./knowledge";
import type { ProjectIdentity } from "./identity";

/**
 * Project — the core aggregate of Agency OS and the single root every other
 * concept hangs off. A Project owns, exactly as the product defines it:
 *
 *   Identity · Discovery · Knowledge · Workflow · Documents · Assets · History
 *
 * The aggregate is modelled as immutable data. Behaviour that changes a
 * Project is expressed as pure functions returning a new Project, which keeps
 * state transitions explicit and trivially testable, and leaves persistence to
 * an adapter (see {@link ProjectRepository}).
 */
export interface Project {
  readonly id: ProjectId;
  readonly identity: ProjectIdentity;
  readonly discovery: Discovery;
  readonly knowledge: Knowledge;
  readonly workflow: Workflow;
  readonly documents: readonly Document[];
  readonly assets: readonly Asset[];
  readonly history: readonly HistoryEvent[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Create a new Project from its identity. Every dependency the domain would
 * otherwise reach for as a global — identity generation, the clock — is
 * injected, so creation is deterministic under test.
 */
export const createProject = (
  identity: ProjectIdentity,
  deps: { ids: IdGenerator; clock: Clock },
): Project => {
  const now = deps.clock.now();
  const id = asProjectId(deps.ids.next());

  return {
    id,
    identity,
    discovery: emptyDiscovery(),
    knowledge: emptyKnowledge(),
    workflow: initialWorkflow(),
    documents: [],
    assets: [],
    history: [
      {
        id: asHistoryEventId(deps.ids.next()),
        type: "project.created",
        businessName: identity.businessName,
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

/** Append a history event and bump `updatedAt`, returning a new Project. */
export const withHistory = (
  project: Project,
  event: HistoryEvent,
): Project => ({
  ...project,
  history: [...project.history, event],
  updatedAt: event.at,
});
