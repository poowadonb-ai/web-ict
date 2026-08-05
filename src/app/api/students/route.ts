import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch all registered students from Supabase (bypasses RLS)
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "student")
      .eq("is_registered", true)
      .order("room", { ascending: true });

    if (error) {
      console.error("[/api/students] Supabase error:", error);
      return NextResponse.json({ students: [], error: error.message }, { status: 500 });
    }

    const students = (data || []).map((row: Record<string, unknown>) => ({
      uid: row.uid as string,
      email: row.email as string,
      displayName: row.display_name as string,
      role: "student" as const,
      isRegistered: true,
      fullName: row.full_name as string,
      grade: String(row.grade ?? ""),
      room: String(row.room ?? ""),
      studentNo: String(row.student_no ?? ""),
      packsCount: (row.packs_count as number) || 0,
      bonusPoints: (row.bonus_points as number) || 0,
      cardsCollected: (row.cards_collected as unknown[]) || [],
      lastLoginDate: row.last_login_date as string,
      totalPacksOpened: (row.total_packs_opened as number) || 0,
      isMerged: (row.is_merged as boolean) || false,
    }));

    return NextResponse.json({ students });
  } catch (err: unknown) {
    console.error("[/api/students] Unexpected error:", err);
    return NextResponse.json({ students: [], error: String(err) }, { status: 500 });
  }
}
