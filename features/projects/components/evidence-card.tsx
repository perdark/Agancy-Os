import type { Asset } from "@/domain";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The project's evidence locker: the client's real logo and every piece of
 * supplied material, each with its provenance (uploaded bytes vs. a link) and
 * integrity metadata. Uploaded previews stream from the asset route; links
 * stay links.
 */
export function EvidenceCard({
  projectId,
  assets,
}: {
  projectId: string;
  assets: readonly Asset[];
}) {
  if (assets.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evidence & assets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assets.map((asset) => (
          <AssetRow key={asset.id} projectId={projectId} asset={asset} />
        ))}
      </CardContent>
    </Card>
  );
}

function AssetRow({
  projectId,
  asset,
}: {
  projectId: string;
  asset: Asset;
}) {
  const isUpload = asset.source === "operator-upload";
  const isImage = isUpload && (asset.mimeType?.startsWith("image/") ?? false);
  const previewUrl = `/api/assets/${projectId}/${asset.id}`;

  return (
    <div className="flex items-start gap-4">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- streamed from the asset port, not an optimizable static asset
        <img
          src={previewUrl}
          alt={asset.label}
          className={
            asset.kind === "logo"
              ? "h-20 w-20 rounded-md border bg-white object-contain p-1"
              : "h-14 w-14 rounded-md border object-cover"
          }
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-md border text-[10px] uppercase text-muted-foreground">
          {isUpload ? (asset.mimeType === "application/pdf" ? "pdf" : "file") : "link"}
        </div>
      )}

      <div className="min-w-0 space-y-1 text-sm">
        {/* div, not p: Badge renders a div, which is invalid inside a p and
            breaks hydration */}
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {asset.label}
          <Badge variant="secondary">{asset.kind}</Badge>
          <Badge variant="outline">
            {isUpload ? "uploaded" : "link"}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {isUpload ? (
            <>
              {asset.fileName}
              {asset.mimeType ? ` · ${asset.mimeType}` : ""}
              {typeof asset.sizeBytes === "number"
                ? ` · ${formatBytes(asset.sizeBytes)}`
                : ""}
              {asset.checksum ? ` · sha256 ${asset.checksum.slice(0, 12)}…` : ""}
            </>
          ) : (
            <a
              className="underline underline-offset-2"
              href={asset.uri}
              target="_blank"
              rel="noreferrer noopener"
            >
              {asset.uri}
            </a>
          )}
        </p>
      </div>
    </div>
  );
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
