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

function mapUserFromDb(row: Record<string, unknown>) {
  return {
    uid: row.uid as string,
    email: row.email as string,
    displayName: row.display_name as string,
    role: row.role as "teacher" | "student",
    isRegistered: row.is_registered as boolean,
    fullName: row.full_name as string,
    grade: row.grade as string,
    room: row.room as string,
    studentNo: row.student_no as string,
    cardsCollected: (row.cards_collected as unknown[]) || [],
    packsCount: (row.packs_count as number) || 0,
    bonusPoints: (row.bonus_points as number) || 0,
    lastLoginDate: row.last_login_date as string,
    totalPacksOpened: (row.total_packs_opened as number) || 0,
    isMerged: (row.is_merged as boolean) || false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, uid, password } = body;

    if ((!username && !uid) || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const supabase = getSupabaseAdmin();

    // ── Find user by email or uid ─────────────────────────────────────────────
    let dbQuery = supabase
      .from("users")
      .select("uid, email, display_name, role, is_registered, full_name, grade, room, student_no, packs_count, bonus_points, last_login_date, total_packs_opened, is_merged, cards_collected, password_hash");

    if (uid) {
      console.log("[signin] looking for uid:", uid);
      dbQuery = dbQuery.eq("uid", uid);
    } else {
      const cleanUsername = username.trim().toLowerCase();
      const email = `${cleanUsername}@ictclassroom.local`;
      console.log("[signin] looking for email:", email);
      dbQuery = dbQuery.eq("email", email);
    }

    const { data: userRow, error } = await dbQuery.maybeSingle();

    if (error) {
      console.error("[signin] DB query error:", JSON.stringify(error));
      throw new Error(error.message);
    }

    console.log("[signin] userRow found:", userRow ? "YES" : "NO");

    if (!userRow) {
      return NextResponse.json(
        { error: "ไม่พบชื่อผู้ใช้นี้ในระบบ (สมัครก่อนค่อยครับ)" },
        { status: 401 }
      );
    }

    // ── Check password ────────────────────────────────────────────────────────
    console.log("[signin] hasPasswordHash:", !!userRow.password_hash);
    console.log("[signin] hashMatch:", userRow.password_hash === passwordHash);

    if (!userRow.password_hash || userRow.password_hash !== passwordHash) {
      return NextResponse.json(
        { error: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // ── Daily pack reward (if student and new day) ────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    let packsCount = (userRow.packs_count as number) || 0;
    let lastLoginDate = userRow.last_login_date as string;

    if (userRow.role === "student" && lastLoginDate !== today) {
      packsCount += 1;
      lastLoginDate = today;
      await supabase
        .from("users")
        .update({ packs_count: packsCount, last_login_date: today })
        .eq("uid", userRow.uid);
    }

    const profile = mapUserFromDb({
      ...userRow,
      packs_count: packsCount,
      last_login_date: lastLoginDate,
    });

    return NextResponse.json({ user: profile }, { status: 200 });
  } catch (err: unknown) {
    console.error("Signin API error:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
