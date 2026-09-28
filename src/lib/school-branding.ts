"use client";

import { browserClient } from "@/lib/supabase/client";

export const SCHOOL_ASSET_BUCKET = "school-assets";
export const schoolLogoPath = (schoolId: string) => `schools/${schoolId}/logo`;

export async function resolveSchoolLogoUrl(
  storedPath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!storedPath) return null;
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  const { data, error } = await browserClient()
    .storage
    .from(SCHOOL_ASSET_BUCKET)
    .createSignedUrl(storedPath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadSchoolLogo(schoolId: string, file: File) {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
  if (!allowed.has(file.type)) {
    throw new Error("Use a PNG, JPG, WEBP or SVG school logo.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("School logos must be 2 MB or smaller.");
  }

  const path = schoolLogoPath(schoolId);
  const { error } = await browserClient()
    .storage
    .from(SCHOOL_ASSET_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });
  if (error) throw new Error(error.message);

  const { error: updateError } = await browserClient()
    .from("schools")
    .update({ logo_url: path })
    .eq("id", schoolId)
    .select("id")
    .single();
  if (updateError) throw new Error(updateError.message);

  return resolveSchoolLogoUrl(path, 3600);
}

export async function imageUrlToPngDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Image could not be loaded.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded."));
      element.src = objectUrl;
    });
    const max = 1200;
    const ratio = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * ratio));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png", 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
