import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

export function signedPhotoUrl(publicId: string): string | undefined {
  if (!publicId || !isCloudinaryConfigured()) return undefined;
  return cloudinary.url(publicId, { type: "authenticated", sign_url: true, secure: true });
}

export { cloudinary };
