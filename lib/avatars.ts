// Avatar upload: turn whatever the player picked into a small square image, put it in the
// player's own folder in the Kinetype bucket, and hand back the public URL to store.
//
// WHY IT DOWNSIZES FIRST
//
// A phone photo is 3-12 MB and 4000px wide to be shown at 64px. Uploading it raw would burn the
// player's data, cost storage, and slow every leaderboard row that renders it. So the image is
// decoded, centre-cropped to a square and re-encoded at AVATAR_PIXELS before it ever leaves the
// browser — a few KB, which is what the bucket's 1 MiB cap is there to bound.
//
// WHY THE PATH IS `<handle>/…`
//
// The storage policies key every write on the first path segment BEING the caller's own handle,
// so this path shape is what makes it impossible to overwrite someone else's face. The handle is
// used rather than the user id on purpose: a public object's URL contains its path, so a uid-based
// folder would publish the player's auth UUID in the HTML of every profile page and in every row
// of the leaderboard payload. The handle is already public and never changes.
//
// Browser-only: uses canvas, Blob and ImageBitmap. Only import it from a client component.

import { supabase } from "./supabase";

/** Must match the bucket created in db/migrations/0004_profile_editing.sql. */
export const AVATAR_BUCKET = "kinetype-avatars";

/** Rendered size of the stored image, in pixels. Shown at up to 64px, so this covers retina. */
export const AVATAR_PIXELS = 256;

/** Refuse absurd sources before decoding them (a 50 MB TIFF is not a profile picture). */
export const AVATAR_MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/** MIME types the bucket accepts, and the `accept` attribute for the file picker. */
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(",");

/** Every extension we might have written, so a replace/remove clears all of them. */
const KNOWN_EXTENSIONS = ["webp", "png", "jpg"] as const;

export function isSupportedAvatarFile(file: File): boolean {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(file.type);
}

/** `"<handle>/avatar.webp"` — the storage object path for a player's picture. */
export function avatarObjectPath(handle: string, ext: string): string {
  return `${handle}/avatar.${ext}`;
}

/**
 * Decode, centre-crop to a square, and re-encode.
 *
 * WHY `createImageBitmap` AND NOT AN `<img>` POINTED AT A BLOB URL
 *
 * The obvious way to decode a picked file is `new Image(); img.src = URL.createObjectURL(file)`.
 * That does not work here: next.config.ts sets `img-src 'self' data: https:`, which has no
 * `blob:`, so the browser refuses to load the object URL and every upload dies with "the source
 * image cannot be decoded". `createImageBitmap` takes the File directly, needs no URL, and
 * sidesteps the CSP rather than widening it for a temporary one.
 *
 * The ext is DERIVED FROM THE BLOB, not assumed: a browser without a WebP encoder quietly falls
 * back to PNG instead of failing, and shipping PNG bytes labelled `image/webp` would be a lie the
 * bucket's mime check can catch.
 */
async function downscaleToSquare(file: File): Promise<{ blob: Blob; ext: string }> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("Your browser cannot process images. Try a different one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file could not be read as an image.");
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (!side) throw new Error("That image has no readable size.");

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PIXELS;
    canvas.height = AVATAR_PIXELS;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser would not let us process that image.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Centre-crop: take the largest centred square, then scale it to the target.
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_PIXELS,
      AVATAR_PIXELS,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) throw new Error("Your browser could not encode that image.");

    const type = blob.type || "image/webp";
    const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
    return { blob, ext };
  } finally {
    // Releases the decoded bitmap immediately instead of waiting for GC.
    bitmap.close();
  }
}

/**
 * Upload a new avatar for `handle` and return the public URL to store on the profile.
 *
 * `handle` is the player's own handle, which namespaces their folder in the bucket. The server
 * re-checks it against the caller's session, so passing someone else's handle simply fails.
 *
 * The URL carries a `?v=` cache-buster. The object path is STABLE across replacements (always
 * `<handle>/avatar.<ext>`), which is what keeps the bucket free of orphans, but it also means the
 * browser and the CDN would happily keep serving the previous face. A changing query string is
 * what makes a replacement actually visible.
 */
export async function uploadAvatar(handle: string, file: File): Promise<string> {
  if (!isSupportedAvatarFile(file)) {
    throw new Error("Use a PNG, JPEG or WebP image.");
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    throw new Error("That image is too large — 8 MB or smaller, please.");
  }

  const { blob, ext } = await downscaleToSquare(file);
  const path = avatarObjectPath(handle, ext);

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/webp",
    cacheControl: "3600",
  });
  if (error) throw error;

  // A fallback encoder can change the extension, which would leave the previous file behind.
  // Best-effort: a leftover object is harmless, so a failure here must not fail the upload.
  void removeOtherExtensions(handle, ext);

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Delete the player's stored avatar(s). Best-effort — the profile row is the real record. */
export async function removeAvatar(handle: string): Promise<void> {
  await removeObjects(KNOWN_EXTENSIONS.map((ext) => avatarObjectPath(handle, ext)));
}

async function removeOtherExtensions(handle: string, keep: string): Promise<void> {
  try {
    await removeObjects(
      KNOWN_EXTENSIONS.filter((ext) => ext !== keep).map((ext) => avatarObjectPath(handle, ext)),
    );
  } catch {
    // Ignore: a stale object costs a few KB and nothing reads it.
  }
}

async function removeObjects(paths: string[]): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  if (error) throw error;
}
