import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cardId = formData.get("cardId") as string | null;

    if (!file || !cardId) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์หรือ cardId" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ภาพ JPG, PNG, WebP, GIF เท่านั้น" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "ขนาดไฟล์ต้องไม่เกิน 5MB" },
        { status: 400 }
      );
    }

    // Determine file extension
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extMap[file.type] || "jpg";

    // Sanitize card ID for use as filename (e.g. "card-7" → "card-7")
    const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeCardId}.${ext}`;

    // Resolve absolute path to public/cards/
    const publicCardsDir = path.join(process.cwd(), "public", "cards");

    // Create directory if it doesn't exist
    if (!existsSync(publicCardsDir)) {
      await mkdir(publicCardsDir, { recursive: true });
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(publicCardsDir, filename);
    await writeFile(filePath, buffer);

    const imageUrl = `/cards/${filename}`;

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปโหลด กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
