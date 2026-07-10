import { serveProjectAsset } from "@/features/projects/serve-asset";

/** Preview endpoint for uploaded assets; all logic lives in the feature. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; assetId: string }> },
) {
  const { projectId, assetId } = await params;
  return serveProjectAsset(projectId, assetId);
}
