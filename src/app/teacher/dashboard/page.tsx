"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/firebase";
import { boardService, submissionService } from "@/lib/supabase";
import { UserProfile, AssignmentBoard, Submission } from "@/lib/types";
import { BarChart3, Users, FileCheck, Clock, AlertCircle, RefreshCw, Filter } from "lucide-react";
import styles from "./page.module.css";

export default function TeacherDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [boards, setBoards] = useState<AssignmentBoard[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "teacher")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedStudents, fetchedSubs] = await Promise.all([
        authService.getRegisteredStudents(),
        submissionService.getAllSubmissions()
      ]);
      boardService.subscribeBoards(setBoards);
      setStudents(fetchedStudents);
      setSubmissions(fetchedSubs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "teacher") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดแดชบอร์ด...</p>
      </div>
    );
  }

  const filteredStudents = students.filter(s =>
    selectedRoom === "all" || s.room === selectedRoom
  );

  // Students who have never submitted any work
  const neverSubmitted = filteredStudents.filter(s =>
    !submissions.some(sub => sub.uid === s.uid || (sub.members?.some(m => m.room === s.room && m.studentNo === s.studentNo)))
  );

  // Students who are not registered (no room/studentNo)
  const notRegistered = students.filter(s => !s.room || !s.studentNo || !s.fullName);

  const gradedSubs = submissions.filter(s => s.status === "graded").length;
  const pendingSubs = submissions.filter(s => s.status === "pending").length;

  // Per-board completion rate
  const boardStats = boards.map(board => {
    const boardSubs = submissions.filter(s => s.boardId === board.id);
    const uniqueSubmitters = new Set<string>();
    boardSubs.forEach(s => {
      if (s.isGroup && s.members) {
        s.members.forEach(m => uniqueSubmitters.add(`${m.room}-${m.studentNo}`));
      } else {
        uniqueSubmitters.add(s.uid);
      }
    });
    const submitted = uniqueSubmitters.size;
    const total = filteredStudents.length || 1;
    return {
      board,
      submitted,
      total: filteredStudents.length,
      percent: Math.round((submitted / total) * 100),
    };
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <BarChart3 className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">แดชบอร์ดครู</h1>
            <p className={styles.subtitle}>ภาพรวมสถานการณ์ห้องเรียนและการส่งงาน</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div className={styles.filterGroup}>
            <Filter size={16} style={{ color: "var(--text-secondary)" }} />
            <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className={styles.filterSelect}>
              <option value="all">ทุกห้อง</option>
              {["1","2","3","4","5","6","12","13"].map(r => (
                <option key={r} value={r}>ม.4/{r}</option>
              ))}
            </select>
          </div>
          <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <RefreshCw size={16} /><span>รีเฟรช</span>
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-container`}>
          <Users size={24} style={{ color: "var(--accent-cyan)" }} />
          <div>
            <div className={styles.statVal}>{filteredStudents.length}</div>
            <div className={styles.statLabel}>นักเรียนทั้งหมด</div>
          </div>
        </div>
        <div className={`${styles.statCard} glass-container`}>
          <FileCheck size={24} style={{ color: "#10b981" }} />
          <div>
            <div className={styles.statVal}>{gradedSubs}</div>
            <div className={styles.statLabel}>งานที่ตรวจแล้ว</div>
          </div>
        </div>
        <div className={`${styles.statCard} glass-container`}>
          <Clock size={24} style={{ color: "#f59e0b" }} />
          <div>
            <div className={styles.statVal}>{pendingSubs}</div>
            <div className={styles.statLabel}>งานรอตรวจ</div>
          </div>
        </div>
        <div className={`${styles.statCard} glass-container`}>
          <AlertCircle size={24} style={{ color: "#ef4444" }} />
          <div>
            <div className={styles.statVal}>{neverSubmitted.length}</div>
            <div className={styles.statLabel}>ยังไม่ส่งงานเลย</div>
          </div>
        </div>
      </div>

      {/* Board Submission Rates */}
      <div className={`${styles.section} glass-container`}>
        <h2 className={styles.sectionTitle}>📊 อัตราการส่งงานแต่ละบอร์ด</h2>
        {boardStats.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>ยังไม่มีบอร์ดส่งงาน</p>
        ) : (
          <div className={styles.boardList}>
            {boardStats.map(({ board, submitted, total, percent }) => (
              <div key={board.id} className={styles.boardRow}>
                <div className={styles.boardInfo}>
                  <span className={styles.boardName}>{board.title}</span>
                  <span className={styles.boardMeta}>{board.type === "group" ? "งานกลุ่ม" : "งานเดี่ยว"}</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${percent}%`,
                      background: percent >= 80 ? "linear-gradient(90deg, #10b981, #059669)" :
                        percent >= 50 ? "linear-gradient(90deg, #f59e0b, #d97706)" :
                          "linear-gradient(90deg, #ef4444, #dc2626)"
                    }}
                  />
                </div>
                <span className={styles.progressLabel}>{submitted}/{total} ({percent}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students Who Haven't Submitted */}
      {neverSubmitted.length > 0 && (
        <div className={`${styles.section} glass-container`}>
          <h2 className={styles.sectionTitle}>⚠️ นักเรียนที่ยังไม่ส่งงานใดเลย ({neverSubmitted.length} คน)</h2>
          <div className={styles.studentChipGrid}>
            {neverSubmitted.map(s => (
              <div key={s.uid} className={styles.studentChip}>
                <span className={styles.chipRoom}>ม.4/{s.room}</span>
                <span className={styles.chipNo}>เลขที่ {s.studentNo}</span>
                <span className={styles.chipName}>{s.fullName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not Registered */}
      {notRegistered.length > 0 && (
        <div className={`${styles.section} glass-container`} style={{ borderColor: "rgba(239, 68, 68, 0.3)" }}>
          <h2 className={styles.sectionTitle}>🔴 บัญชีที่ข้อมูลไม่ครบ ({notRegistered.length} บัญชี)</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "12px" }}>
            บัญชีเหล่านี้ขาดชื่อ, ห้อง, หรือเลขที่ — ควรแก้ไขในหน้า &quot;จัดการนักเรียน&quot;
          </p>
          <div className={styles.studentChipGrid}>
            {notRegistered.map(s => (
              <div key={s.uid} className={`${styles.studentChip} ${styles.chipError}`}>
                <span>{s.email || s.displayName || s.uid}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
