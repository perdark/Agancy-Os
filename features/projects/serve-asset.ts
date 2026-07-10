import "server-only";
import { asProjectId } from "@/domain";
import { getContainer } from "@/lib/container";

/**
 * Resolve a project's uploaded asset to an HTTP response for previews.
 *
 * Only bytes that entered through the asset-storage port are served — linked
 * references stay links. Responses are defensive: uploaded content is treated
 * as inert (nosniff + CSP sandbox, so an uploaded SVG can never script the
 * app), and because pointers are content-addressed the bytes are immutable and
 * cacheable forever.
 */
export const serveProjectAsset = async (
  projectId: string,
  assetId: string,
): Promise<Response> => {
  const { projects, assetStorage } = getContainer();

  const project = await projects.findById(asProjectId(projectId));
  const asset = project?.assets.find((candidate) => candidate.id === assetId);
  if (!asset || !asset.uri.startsWith("asset://")) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await assetStorage.get(asset.uri);
  if (!bytes) return new Response("Not found", { status: 404 });

  // Response bodies must be plain-ArrayBuffer-backed; the port only promises
  // Uint8Array<ArrayBufferLike>, so copy into a fresh buffer.
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": asset.mimeType ?? "application/octet-stream",
      "content-length": String(bytes.length),
      "content-disposition": `inline; filename="${sanitizeFileName(
        asset.fileName ?? asset.label,
      )}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
};

/** Keep the download name printable ASCII so the header cannot be broken. */
const sanitizeFileName = (name: string): string =>
  name.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_") || "asset";
