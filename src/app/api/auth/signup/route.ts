import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// ─── Server-side Supabase (bypasses RLS) ───────────────────────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey || serviceKey.includes("your-service-role-key")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่าใน .env.local");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hashPassword(password: string): string {
  return createHash("sha256")
    .update(password + "ict-classroom-salt-2024")
    .digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, fullName, grade, room, studentNo } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!username || !password || !fullName || !grade || !room || !studentNo) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{4,20}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลข 4-20 ตัว" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    }

    const email = `${cleanUsername}@ictclassroom.local`;
    const uid = `user-${cleanUsername}`;
    const passwordHash = hashPassword(password);
    const today = new Date().toISOString().split("T")[0];

    // ── Check if this is the teacher account ────────────────────────────────
    const teacherUsername = (process.env.TEACHER_USERNAME || "").toLowerCase();
    const teacherPassword = process.env.TEACHER_PASSWORD || "";
    const isTeacher = teacherUsername && cleanUsername === teacherUsername;

    // If claiming to be teacher, verify against TEACHER_PASSWORD
    if (isTeacher && teacherPassword && password !== teacherPassword) {
      return NextResponse.json(
        { error: "รหัสผ่านครูไม่ถูกต้อง" },
        { status: 403 }
      );
    }

    const role = isTeacher ? "teacher" : "student";
    const isRegistered = true; // both teacher and student are registered on signup

    const supabase = getSupabaseAdmin();

    // ── Check if username already exists ─────────────────────────────────────
    const { data: existing } = await supabase
      .from("users")
      .select("uid")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น" },
        { status: 409 }
      );
    }

    // ── Validation: teacher signup doesn't need grade/room/studentNo ───────────────
    if (!isTeacher && (!fullName || !grade || !room || !studentNo)) {
      return NextResponse.json({ error: "ข้อมูลนักเรียนไม่ครบถ้วน" }, { status: 400 });
    }

    const packsCount = isTeacher ? 0 : 3;

    // ── Insert user into users table ────────────────────────────────────────
    const { error: dbError } = await supabase.from("users").insert({
      uid,
      email,
      display_name: fullName,
      role,
      is_registered: isRegistered,
      full_name: fullName,
      grade: grade || "",
      room: room || "",
      student_no: studentNo || "",
      packs_count: packsCount,
      last_login_date: today,
      password_hash: passwordHash,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      throw new Error(dbError.message);
    }

    // ── Return user profile (no password_hash) ─────────────────────────────
    const profile = {
      uid,
      email,
      displayName: fullName,
      role,
      isRegistered,
      fullName,
      grade: grade || "",
      room: room || "",
      studentNo: studentNo || "",
      cardsCollected: [],
      packsCount,
      bonusPoints: 0,
      lastLoginDate: today,
      totalPacksOpened: 0,
      isMerged: false,
    };

    return NextResponse.json({ user: profile }, { status: 201 });
  } catch (err: unknown) {
    console.error("Signup API error:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสมัครสมาชิก";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
