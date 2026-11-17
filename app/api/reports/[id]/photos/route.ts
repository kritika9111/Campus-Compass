import { NextResponse } from "next/server";
import type { UploadApiResponse } from "cloudinary";
import type { Document, UpdateFilter } from "mongodb";
import { auth } from "@/auth";
import { isUserSuspended } from "@/lib/access";
import { getDb } from "@/lib/mongodb";
import { cloudinary, isCloudinaryConfigured, signedPhotoUrl } from "@/lib/cloudinary";
import { isSameOrigin } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await isUserSuspended(session.user.email)) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: "Photo uploads are not configured." }, { status: 503 });
    }
    const { id } = await params;
    const db = await getDb();
    const report = await db.collection("reports").findOne({ _id: id, reporter_id: session.user.id });
    if (!report) return NextResponse.json({ error: "Report not found or not owned by you." }, { status: 404 });
    if (["closed", "returned", "hidden"].includes(String(report.state))) {
      return NextResponse.json({ error: "Photos cannot be added to a closed, returned, or hidden report." }, { status: 409 });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the photo as multipart form data." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || !allowed.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload a non-empty JPG, PNG, or WebP image up to 5 MB." }, { status: 400 });
    }
    if ((report.photos?.length || 0) >= 4) {
      return NextResponse.json({ error: "Maximum 4 photos per report." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type)) {
      return NextResponse.json({ error: "The file contents do not match a valid JPG, PNG, or WebP image." }, { status: 400 });
    }
    const uploaded = await new Promise<UploadApiResponse>((resolve, reject) =>
      cloudinary.uploader.upload_stream(
        {
          folder: `campus-compass/${id}`,
          resource_type: "image",
          type: "authenticated",
          access_mode: "authenticated",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          max_file_size: 5 * 1024 * 1024,
        },
        (err, result) => (err || !result ? reject(err || new Error("Cloudinary upload returned no result.")) : resolve(result)),
      ).end(bytes),
    );
    const photo = {
      public_id: uploaded.public_id,
      secure_url: uploaded.secure_url,
      format: uploaded.format,
      bytes: uploaded.bytes,
      created_at: new Date(),
    };
    const updateResult = await db.collection("reports").updateOne(
      {
        _id: id,
        reporter_id: session.user.id,
        state: { $nin: ["closed", "returned", "hidden"] },
        "photos.3": { $exists: false },
      },
      { $push: { photos: photo } as UpdateFilter<Document & { _id: string }> },
    );
    if (updateResult.modifiedCount !== 1) {
      await cloudinary.uploader.destroy(uploaded.public_id, { type: "authenticated", resource_type: "image" }).catch(() => undefined);
      return NextResponse.json({ error: "Maximum 4 photos per report." }, { status: 400 });
    }
    return NextResponse.json(
      { photo: { ...photo, url: signedPhotoUrl(photo.public_id) } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Photo upload failed", error);
    return NextResponse.json({ error: "Could not upload photo." }, { status: 503 });
  }
}

