import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.AWS_S3_BUCKET ?? "";

export async function POST(req: NextRequest) {
  if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    return NextResponse.json({ error: "S3 not configured — add AWS_* vars to .env.local" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Unique key: artwork/<timestamp>-<filename>
    const ext = file.name.split(".").pop() ?? "bin";
    const key = `artwork/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    }));

    const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com/${key}`;
    return NextResponse.json({ publicUrl, key });
  } catch (err: any) {
    console.error("[S3 upload error]", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
