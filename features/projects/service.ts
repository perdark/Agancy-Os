import "server-only";
import { asProjectId, type Project, type ProjectSummary } from "@/domain";
import { getContainer } from "@/lib/container";

/**
 * Read-side helpers for the projects feature. Thin pass-throughs to the
 * repository port — the container decides which adapter answers.
 */
export const listProjects = async (): Promise<ProjectSummary[]> => {
  return getContainer().projects.list();
};

export const getProject = async (id: string): Promise<Project | null> => {
  return getContainer().projects.findById(asProjectId(id));
};
