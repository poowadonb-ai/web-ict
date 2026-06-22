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

    let activeUser = userRow;

    // ── Auto-register student if they exist in Firestore but not yet in Supabase ──
    if (!activeUser && body.autoRegister) {
      const { fullName, grade, room, studentNo } = body.autoRegister;
      const today = new Date().toISOString().split("T")[0];
      const email = uid 
        ? `${uid}@ictclassroom.local` 
        : `${username.trim().toLowerCase()}@ictclassroom.local`;
      const finalUid = uid || `user-${username.trim().toLowerCase()}`;

      console.log("[signin] Auto-registering student in Supabase on first sign-in:", finalUid);
      
      const { error: insertError } = await supabase.from("users").insert({
        uid: finalUid,
        email,
        display_name: fullName,
        role: "student",
        is_registered: true,
        full_name: fullName,
        grade: grade || "",
        room: room || "",
        student_no: studentNo || "",
        packs_count: 3,
        last_login_date: today,
        password_hash: passwordHash,
      });

      if (insertError) {
        console.error("[signin] Auto-register DB insert error:", insertError);
        throw new Error(insertError.message);
      }

      activeUser = {
        uid: finalUid,
        email,
        display_name: fullName,
        role: "student",
        is_registered: true,
        full_name: fullName,
        grade: grade || "",
        room: room || "",
        student_no: studentNo || "",
        packs_count: 3,
        bonus_points: 0,
        last_login_date: today,
        total_packs_opened: 0,
        is_merged: false,
        cards_collected: [],
        password_hash: passwordHash
      };
    }

    console.log("[signin] activeUser found:", activeUser ? "YES" : "NO");

    if (!activeUser) {
      return NextResponse.json(
        { error: "ไม่พบชื่อผู้ใช้นี้ในระบบ" },
        { status: 401 }
      );
    }

    // ── Check password ────────────────────────────────────────────────────────
    console.log("[signin] hasPasswordHash:", !!activeUser.password_hash);
    console.log("[signin] hashMatch:", activeUser.password_hash === passwordHash);

    // Bypass check: If student and they use "123456", allow login and optionally update their hash
    const isStudentDefaultPassword = String(password).trim() === "123456";

    if (!isStudentDefaultPassword && (!activeUser.password_hash || activeUser.password_hash !== passwordHash)) {
      return NextResponse.json(
        { error: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // If they used the default password but their hash is missing/different, update it in the background
    if (isStudentDefaultPassword && activeUser.password_hash !== passwordHash) {
      (async () => {
        try {
          await supabase.from("users").update({ password_hash: passwordHash }).eq("uid", activeUser.uid);
          console.log(`[signin] Updated default password hash for ${activeUser.uid}`);
        } catch (err) {
          console.error(`[signin] Failed to update password hash:`, err);
        }
      })();
    }

    // ── Daily pack reward (if student and new day) ────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    let packsCount = (activeUser.packs_count as number) || 0;
    let lastLoginDate = activeUser.last_login_date as string;

    if (activeUser.role === "student" && lastLoginDate !== today) {
      packsCount += 1;
      lastLoginDate = today;
      await supabase
        .from("users")
        .update({ packs_count: packsCount, last_login_date: today })
        .eq("uid", activeUser.uid);
    }

    const profile = mapUserFromDb({
      ...activeUser,
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
