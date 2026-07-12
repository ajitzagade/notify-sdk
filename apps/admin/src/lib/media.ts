import { getPool } from './db';

export type MediaKind = 'image' | 'video' | 'document' | 'audio';

export interface MediaAssetRecord {
  id: string;
  tenantId: string;
  kind: MediaKind;
  blobUrl: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string | null;
  createdAt: string;
}

function rowToAsset(row: Record<string, unknown>): MediaAssetRecord {
  return {
    id:                row.id as string,
    tenantId:          row.tenant_id as string,
    kind:              row.kind as MediaKind,
    blobUrl:           row.blob_url as string,
    contentType:       row.content_type as string,
    sizeBytes:         row.size_bytes as number,
    originalFilename:  row.original_filename as string | null,
    createdAt:         row.created_at as string,
  };
}

const KIND_BY_MIME_PREFIX: Record<string, MediaKind> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
};

export function inferMediaKind(mimeType: string): MediaKind {
  const prefix = mimeType.split('/')[0];
  return KIND_BY_MIME_PREFIX[prefix] ?? 'document';
}

export async function listMediaAssets(tenantId: string, limit = 30): Promise<MediaAssetRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM media_assets WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  return rows.map(rowToAsset);
}

export async function createMediaAsset(input: {
  tenantId: string;
  kind: MediaKind;
  blobUrl: string;
  contentType: string;
  sizeBytes: number;
  originalFilename?: string;
}): Promise<MediaAssetRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO media_assets (tenant_id, kind, blob_url, content_type, size_bytes, original_filename)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.tenantId, input.kind, input.blobUrl, input.contentType, input.sizeBytes, input.originalFilename ?? null]
  );
  return rowToAsset(rows[0]);
}
