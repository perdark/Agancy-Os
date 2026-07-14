import {
  asHistoryEventId,
  asOutcomeId,
  withHistory,
  withOutcome,
  type Clock,
  type DealStatus,
  type IdGenerator,
  type MeetingOutcome,
  type Project,
  type ProjectId,
  type ProjectRepository,
} from "@/domain";

/**
 * Record what actually happened in the meeting (guide Step 8). Append-only:
 * every meeting adds a record; nothing is rewritten. The outcome names the
 * candidate that was presented (and the artifact when one was shown) so the
 * learning loop can trace results back to exact inputs and prompts.
 */
export interface RecordOutcomeRequest {
  readonly projectId: ProjectId;
  readonly candidateId: string;
  readonly artifactId?: string;
  readonly deal: DealStatus;
  readonly operatorChanges?: string;
  readonly clientChanges?: string;
  readonly reaction?: string;
  readonly whyItWorked?: string;
}

export interface RecordOutcomeDeps {
  readonly projects: ProjectRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface RecordOutcomeOutcome {
  readonly project: Project;
  readonly outcome: MeetingOutcome;
}

export class OutcomeRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutcomeRecordError";
  }
}

const cleaned = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;

export const recordMeetingOutcome = async (
  request: RecordOutcomeRequest,
  deps: RecordOutcomeDeps,
): Promise<RecordOutcomeOutcome> => {
  const project = await deps.projects.findById(request.projectId);
  if (!project) {
    throw new OutcomeRecordError(`Project ${request.projectId} was not found.`);
  }
  const candidate = project.candidates.find(
    (entry) => entry.id === request.candidateId,
  );
  if (!candidate) {
    throw new OutcomeRecordError(
      `Candidate ${request.candidateId} was not found on project ${project.id}.`,
    );
  }
  const artifact = request.artifactId
    ? project.artifacts.find((entry) => entry.id === request.artifactId)
    : undefined;
  if (request.artifactId && !artifact) {
    throw new OutcomeRecordError(
      `Artifact ${request.artifactId} was not found on project ${project.id}.`,
    );
  }

  const recordedAt = deps.clock.now();
  const outcome: MeetingOutcome = {
    id: asOutcomeId(deps.ids.next()),
    candidateId: candidate.id,
    ...(artifact ? { artifactId: artifact.id } : {}),
    deal: request.deal,
    ...(cleaned(request.operatorChanges)
      ? { operatorChanges: cleaned(request.operatorChanges) }
      : {}),
    ...(cleaned(request.clientChanges)
      ? { clientChanges: cleaned(request.clientChanges) }
      : {}),
    ...(cleaned(request.reaction) ? { reaction: cleaned(request.reaction) } : {}),
    ...(cleaned(request.whyItWorked)
      ? { whyItWorked: cleaned(request.whyItWorked) }
      : {}),
    recordedAt,
  };

  const updated = withHistory(withOutcome(project, outcome), {
    id: asHistoryEventId(deps.ids.next()),
    type: "outcome.recorded",
    outcomeId: outcome.id,
    deal: outcome.deal,
    at: recordedAt,
  });
  await deps.projects.save(updated);
  return { project: updated, outcome };
};
