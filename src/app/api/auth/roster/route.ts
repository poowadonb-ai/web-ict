import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

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
    const { teacherUid, action, studentUid, newPassword } = body;

    if (!teacherUid || !action || !studentUid) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ── Verify if the request is from a teacher ─────────────────────────────
    const { data: teacherUser, error: authError } = await supabase
      .from("users")
      .select("role")
      .eq("uid", teacherUid)
      .maybeSingle();

    if (authError || !teacherUser || teacherUser.role !== "teacher") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ในการทำรายการนี้" }, { status: 403 });
    }

    // ── Execute requested action ────────────────────────────────────────────
    if (action === "update_password") {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" },
          { status: 400 }
        );
      }

      const passwordHash = hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from("users")
        .update({ password_hash: passwordHash })
        .eq("uid", studentUid);

      if (updateError) {
        console.error("[roster-api] Update password error:", updateError);
        throw new Error(updateError.message);
      }

      return NextResponse.json({ message: "เปลี่ยนรหัสผ่านนักเรียนสำเร็จ" }, { status: 200 });
    } 
    
    if (action === "delete_student") {
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("uid", studentUid);

      if (deleteError) {
        console.error("[roster-api] Delete student error:", deleteError);
        throw new Error(deleteError.message);
      }

      return NextResponse.json({ message: "ลบบัญชีนักเรียนสำเร็จ" }, { status: 200 });
    }

    return NextResponse.json({ error: "ไม่พบการกระทำที่ระบุ" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Roster API error:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดของระบบ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
