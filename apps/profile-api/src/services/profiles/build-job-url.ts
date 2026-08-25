export function buildJobUrl({
  hostUrl,
  insertPrivateDetails,
  batchIndex,
  onlyPrivateDetails,
  totalBatches,
  profileImportId,
}: {
  hostUrl: string;
  insertPrivateDetails: boolean;
  batchIndex: number;
  onlyPrivateDetails: boolean;
  totalBatches: number;
  profileImportId: string;
}): URL {
  const url = new URL(
    `/api/v1/jobs/import-profiles/${profileImportId}`,
    hostUrl,
  );

  url.search = new URLSearchParams({
    insertPrivateDetails: String(insertPrivateDetails),
    onlyPrivateDetails: String(onlyPrivateDetails),
    batchIndex: String(batchIndex),
    totalBatches: String(totalBatches),
  }).toString();

  return url;
}
