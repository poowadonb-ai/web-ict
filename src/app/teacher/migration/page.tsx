"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { supabase } from "@/lib/supabase";
import { Database, Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import styles from "./page.module.css";


export default function MigrationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [isFetching, setIsFetching] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [data, setData] = useState<{
    users: any[];
    boards: any[];
    submissions: any[];
    lessons: any[];
    announcements: any[];
    redemptions: any[];
    settings: any[];
  } | null>(null);
  
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleFetchFirebase = async () => {
    setIsFetching(true);
    addLog("Starting Firebase data extraction...");
    try {
      const collections = ["users", "boards", "submissions", "lessons", "announcements", "redemptions", "settings"];
      const extracted: any = {};

      for (const colName of collections) {
        addLog(`Fetching collection: ${colName}...`);
        const snapshot = await getDocs(collection(db, colName));
        extracted[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        addLog(`Found ${snapshot.docs.length} documents in ${colName}.`);
      }

      setData(extracted as any);
      addLog("Successfully extracted all data from Firebase!");
      alert("ดึงข้อมูลจาก Firebase สำเร็จ!");
    } catch (error: any) {
      console.error(error);
      addLog(`Error fetching Firebase: ${error.message}`);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setIsFetching(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ict_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("Backup JSON downloaded.");
  };

  const handleMigrateToSupabase = async () => {
    if (!data) return;
    setIsMigrating(true);
    addLog("Starting migration to Supabase...");
    
    try {
      // 1. Settings
      if (data.settings && data.settings.length > 0) {
        addLog("Migrating settings...");
        for (const item of data.settings) {
          const payload = {
            id: item.id,
            data: item.data || item
          };
          await supabase.from('settings').upsert(payload);
        }
      }

      // 2. Users
      if (data.users && data.users.length > 0) {
        addLog(`Migrating ${data.users.length} users...`);
        const userBatch = data.users.map((u: any) => ({
          uid: u.id,
          email: u.email || null,
          display_name: u.displayName || null,
          role: u.role || "student",
          is_registered: u.isRegistered || false,
          full_name: u.fullName || null,
          grade: u.grade || null,
          room: u.room || null,
          student_no: u.studentNo || null,
          cards_collected: u.cardsCollected || [],
          packs_count: u.packsCount || 0,
          bonus_points: u.bonusPoints || 0,
          last_login_date: u.lastLoginDate || null,
          total_packs_opened: u.totalPacksOpened || 0,
          is_merged: u.isMerged || false,
        }));
        
        // Upsert in chunks to avoid large payload errors
        for (let i = 0; i < userBatch.length; i += 50) {
          const chunk = userBatch.slice(i, i + 50);
          const { error } = await supabase.from('users').upsert(chunk);
          if (error) throw new Error(`Users insert error: ${error.message}`);
        }
      }

      // 3. Lessons
      if (data.lessons && data.lessons.length > 0) {
        addLog(`Migrating ${data.lessons.length} lessons...`);
        const lessonBatch = data.lessons.map((l: any) => ({
          id: l.id,
          title: l.title,
          content: l.content || "",
          canva_url: l.canvaUrl || "",
          youtube_url: l.youtubeUrl || "",
          created_at: new Date(l.createdAt || Date.now()).getTime(),
          author_email: l.authorEmail || "",
          has_assignment: l.hasAssignment || false,
          assignment_id: l.assignmentId || null,
          assignment_type: l.assignmentType || "individual",
          target_rooms: l.targetRooms || []
        }));
        
        const { error } = await supabase.from('lessons').upsert(lessonBatch);
        if (error) throw new Error(`Lessons insert error: ${error.message}`);
      }

      // 4. Boards
      if (data.boards && data.boards.length > 0) {
        addLog(`Migrating ${data.boards.length} boards...`);
        const boardBatch = data.boards.map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description || "",
          type: b.type || "individual",
          lesson_id: b.lessonId || null,
          is_locked: b.isLocked || false,
          target_rooms: b.targetRooms || [],
          created_at: new Date(b.createdAt || Date.now()).getTime(),
        }));
        
        const { error } = await supabase.from('boards').upsert(boardBatch);
        if (error) throw new Error(`Boards insert error: ${error.message}`);
      }

      // 5. Submissions
      if (data.submissions && data.submissions.length > 0) {
        addLog(`Migrating ${data.submissions.length} submissions...`);
        const subBatch = data.submissions.map((s: any) => ({
          id: s.id,
          board_id: s.boardId,
          uid: s.uid,
          student_name: s.studentName || "",
          student_no: s.studentNo || "",
          grade_class: s.gradeClass || "",
          title: s.title || "",
          description: s.description || "",
          link_url: s.linkUrl || "",
          likes: s.likes || [],
          comments: s.comments || [],
          is_group: s.isGroup || false,
          members: s.members || [],
          status: s.status || "pending",
          score: s.score || 0,
          max_score: s.maxScore || 10,
          teacher_feedback: s.teacherFeedback || "",
          created_at: new Date(s.createdAt || Date.now()).getTime(),
        }));
        
        for (let i = 0; i < subBatch.length; i += 50) {
          const chunk = subBatch.slice(i, i + 50);
          const { error } = await supabase.from('submissions').upsert(chunk);
          if (error) throw new Error(`Submissions insert error: ${error.message}`);
        }
      }

      // 6. Announcements
      if (data.announcements && data.announcements.length > 0) {
        addLog(`Migrating ${data.announcements.length} announcements...`);
        const annBatch = data.announcements.map((a: any) => ({
          id: a.id,
          title: a.title,
          content: a.content || "",
          author_name: a.authorName || "",
          pinned: a.pinned || false,
          created_at: new Date(a.createdAt || Date.now()).getTime(),
        }));
        
        const { error } = await supabase.from('announcements').upsert(annBatch);
        if (error) throw new Error(`Announcements insert error: ${error.message}`);
      }

      // 7. Redemptions
      if (data.redemptions && data.redemptions.length > 0) {
        addLog(`Migrating ${data.redemptions.length} redemptions...`);
        const redBatch = data.redemptions.map((r: any) => ({
          id: r.id,
          student_uid: r.studentUid,
          student_name: r.studentName || "",
          student_room: r.studentRoom || "",
          student_grade: r.studentGrade || "",
          card_id: r.cardId,
          card_name: r.cardName || "",
          rarity: r.rarity || "common",
          bonus_points: r.bonusPoints || 0,
          status: r.status || "pending",
          created_at: new Date(r.createdAt || Date.now()).getTime(),
        }));
        
        const { error } = await supabase.from('redemptions').upsert(redBatch);
        if (error) throw new Error(`Redemptions insert error: ${error.message}`);
      }

      addLog("MIGRATION COMPLETELY SUCCESSFUL!");
      alert("ย้ายข้อมูลไป Supabase เสร็จสมบูรณ์!");
      
      // Update local storage so next reload uses Supabase
      localStorage.setItem("db_mode", "supabase");
      addLog("Database mode set to Supabase.");

    } catch (error: any) {
      console.error(error);
      addLog(`MIGRATION ERROR: ${error.message}`);
      alert("เกิดข้อผิดพลาดในการย้ายข้อมูล ดูรายละเอียดที่ Log");
    } finally {
      setIsMigrating(false);
    }
  };

  if (loading || !user || user.role !== "teacher") {
    return <div style={{ color: "white", padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Database Migration</h1>
      <p className={styles.subtitle}>โอนย้ายข้อมูลจาก Firebase ไปยัง Supabase แบบถาวร</p>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}><Database size={20} /> 1. โหลดข้อมูลจาก Firebase</h2>
        <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>ดึงข้อมูลทั้งหมดจากระบบเดิมมาเตรียมไว้ในเครื่อง</p>
        <button 
          className={`${styles.btn} ${styles.btnPrimary} ${isFetching ? styles.btnDisabled : ""}`}
          onClick={handleFetchFirebase}
          disabled={isFetching || isMigrating}
        >
          <Download size={18} />
          {isFetching ? "กำลังดึงข้อมูล..." : "ดึงข้อมูลจาก Firebase"}
        </button>
      </div>

      {data && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}><CheckCircle size={20} color="#10b981" /> ข้อมูลที่พร้อมย้าย</h2>
          <ul className={styles.statusList}>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>นักเรียน (Users)</span>
              <span className={styles.statusCount}>{data.users.length} รายการ</span>
            </li>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>ภาระงาน (Boards)</span>
              <span className={styles.statusCount}>{data.boards.length} รายการ</span>
            </li>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>ผลงานส่ง (Submissions)</span>
              <span className={styles.statusCount}>{data.submissions.length} รายการ</span>
            </li>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>บทเรียน (Lessons)</span>
              <span className={styles.statusCount}>{data.lessons.length} รายการ</span>
            </li>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>ประกาศ (Announcements)</span>
              <span className={styles.statusCount}>{data.announcements.length} รายการ</span>
            </li>
            <li className={styles.statusItem}>
              <span className={styles.statusName}>ขอแลกรางวัล (Redemptions)</span>
              <span className={styles.statusCount}>{data.redemptions.length} รายการ</span>
            </li>
          </ul>

          <div className={styles.buttonGroup}>
            <button 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleDownloadBackup}
              disabled={isMigrating}
            >
              <Download size={18} />
              ดาวน์โหลดเป็นไฟล์ JSON (Backup)
            </button>
            <button 
              className={`${styles.btn} ${styles.btnPrimary} ${isMigrating ? styles.btnDisabled : ""}`}
              style={{ background: "#10b981" }}
              onClick={handleMigrateToSupabase}
              disabled={isMigrating}
            >
              <Upload size={18} />
              {isMigrating ? "กำลังย้ายข้อมูล..." : "เริ่มย้ายข้อมูลไป Supabase"}
            </button>
          </div>
        </div>
      )}

      {(logs.length > 0) && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}><AlertCircle size={20} /> System Logs</h2>
          <div className={styles.logBox}>
            {logs.map((log, i) => (
              <div key={i} className={styles.logEntry}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
