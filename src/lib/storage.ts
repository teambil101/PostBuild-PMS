import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "property-photos";
export const DOC_BUCKET = "property-docs";

export type EntityType = "building" | "unit" | "contract" | "ticket" | "person";

/** Validation specs */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic";
export const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_PER_ENTITY = 50;

export const DOC_ACCEPT =
  "application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";
export const DOC_MAX_BYTES = 25 * 1024 * 1024;
export const DOC_MAX_PER_ENTITY = 100;

export const isPhotoMime = (m: string) => m.startsWith("image/");

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const fileExt = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
};

export const buildPhotoPath = (entityType: EntityType, entityId: string, photoId: string, fileName: string) =>
  `${entityType}/${entityId}/photos/${photoId}.${fileExt(fileName) || "bin"}`;

export const buildDocPath = (entityType: EntityType, entityId: string, docId: string, fileName: string) =>
  `${entityType}/${entityId}/documents/${docId}.${fileExt(fileName) || "bin"}`;

/* ===========================
   Signed URL cache (12h photos, 1h docs)
   =========================== */
interface CacheEntry { url: string; expiresAt: number; }
const memCache = new Map<string, CacheEntry>();

const PHOTO_TTL_SECONDS = 60 * 60 * 12; // 12h
const DOC_TTL_SECONDS = 60 * 60;        // 1h
const CLOCK_SKEW_MS = 60_000;

const cacheKey = (bucket: string, path: string) => `${bucket}::${path}`;

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  return getCachedSignedUrl(PHOTO_BUCKET, path, PHOTO_TTL_SECONDS);
}

export async function getSignedDocUrl(path: string): Promise<string | null> {
  return getCachedSignedUrl(DOC_BUCKET, path, DOC_TTL_SECONDS);
}

async function getCachedSignedUrl(bucket: string, path: string, ttl: number): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const hit = memCache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt - CLOCK_SKEW_MS > now) return hit.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) return null;
  memCache.set(key, { url: data.signedUrl, expiresAt: now + ttl * 1000 });
  return data.signedUrl;
}

export function invalidateSignedUrl(bucket: string, path: string) {
  memCache.delete(cacheKey(bucket, path));
}