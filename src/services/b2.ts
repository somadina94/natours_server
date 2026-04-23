import B2 from "backblaze-b2";
import { env, isB2Configured, publicMediaBaseUrl } from "../config/env.js";
import AppError from "../utils/appError.js";

let client: B2 | null = null;

const getClient = (): B2 => {
  if (!isB2Configured()) {
    throw new AppError("Object storage is not configured.", 500);
  }
  if (!client) {
    client = new B2({
      applicationKeyId: env.b2ApplicationKeyId,
      applicationKey: env.b2ApplicationKey,
    });
  }
  return client;
};

/** Public URL for a stored object key (no leading slash on key). */
export const publicUrlForKey = (key: string): string => {
  const normalized = key.replace(/^\//, "");
  const base = publicMediaBaseUrl();
  if (!base) return normalized;
  return `${base}/${normalized}`;
};

export type UploadItem = {
  key: string;
  buffer: Buffer;
  contentType?: string;
};

/** One B2 authorize + N uploads (avoids ~1 RTT per file and reduces timeout risk on tour create). */
export async function uploadManyBuffers(items: UploadItem[]): Promise<string[]> {
  if (!isB2Configured()) {
    throw new AppError(
      "Image storage is not configured. Set Backblaze B2 env vars: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_PUBLIC_BASE_URL, then restart the API.",
      500,
    );
  }
  if (items.length === 0) return [];

  const b2 = getClient();
  try {
    await b2.authorize();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(`Backblaze B2 authorization failed: ${msg}`, 502);
  }

  const urls: string[] = [];
  for (const item of items) {
    const normalizedKey = item.key.replace(/^\//, "");
    try {
      const { data } = await b2.getUploadUrl({ bucketId: env.b2BucketId });
      await b2.uploadFile({
        uploadUrl: data.uploadUrl,
        uploadAuthToken: data.authorizationToken,
        fileName: normalizedKey,
        data: item.buffer,
        mime: item.contentType ?? "image/jpeg",
        contentLength: item.buffer.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(
        `Backblaze B2 upload failed for key "${normalizedKey}": ${msg}`,
        502,
      );
    }
    urls.push(publicUrlForKey(normalizedKey));
  }
  return urls;
}

export async function uploadBuffer(params: UploadItem): Promise<string> {
  const urls = await uploadManyBuffers([params]);
  const u = urls[0];
  if (!u) {
    throw new AppError("B2 upload returned no URL.", 500);
  }
  return u;
}
