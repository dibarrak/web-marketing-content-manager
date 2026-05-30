/**
 * Webflow Assets API v2 — 3-step upload.
 * 1) POST /sites/{siteId}/assets → returns S3 uploadUrl + uploadDetails + hostedUrl
 * 2) multipart POST to uploadUrl with all uploadDetails fields + the file
 * 3) Asset is immediately available via hostedUrl
 *
 * https://developers.webflow.com/data/reference/assets/create
 */
import SparkMD5 from 'spark-md5';
import type { WebflowClient } from './client';

export interface CreatedAsset {
  id: string;
  hostedUrl: string;
  uploadUrl: string;
  uploadDetails: Record<string, string>;
  parentFolder: string | null;
  contentType?: string;
  size?: number;
}

export interface UploadedAsset {
  id: string;
  url: string;
}

function md5Hex(bytes: Uint8Array): string {
  const spark = new SparkMD5.ArrayBuffer();
  spark.append(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return spark.end();
}

export function createAssetsApi(client: WebflowClient) {
  async function createAsset(
    siteId: string,
    fileName: string,
    bytes: Uint8Array,
    parentFolder?: string,
  ): Promise<CreatedAsset> {
    return client.request<CreatedAsset>(`/sites/${siteId}/assets`, {
      method: 'POST',
      body: { fileName, fileHash: md5Hex(bytes), parentFolder },
    });
  }

  async function uploadToS3(asset: CreatedAsset, bytes: Uint8Array, contentType: string) {
    const form = new FormData();
    for (const [k, v] of Object.entries(asset.uploadDetails)) form.append(k, v);
    form.append('file', new Blob([bytes], { type: contentType }));

    const res = await fetch(asset.uploadUrl, { method: 'POST', body: form });
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 upload failed (${res.status}): ${text}`);
    }
  }

  /**
   * Full upload: create + S3 push. Returns the final id + hostedUrl ready to
   * reference from a CMS field.
   */
  async function upload(
    siteId: string,
    fileName: string,
    bytes: Uint8Array,
    contentType: string,
    parentFolder?: string,
  ): Promise<UploadedAsset> {
    const asset = await createAsset(siteId, fileName, bytes, parentFolder);
    await uploadToS3(asset, bytes, contentType);
    return { id: asset.id, url: asset.hostedUrl };
  }

  return { createAsset, uploadToS3, upload };
}

export type AssetsApi = ReturnType<typeof createAssetsApi>;
