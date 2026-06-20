"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, boardService, submissionService } from "@/lib/supabase";
import { UserProfile, AssignmentBoard, Submission } from "@/lib/types";
import { ClipboardList, Download, Search, Filter, RefreshCw, Award, Users, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";


export default function GradebookPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [boards, setBoards] = useState<AssignmentBoard[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Redirect if not teacher
    if (!authLoading && (!user || user.role !== "teacher")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch all registered students, boards, and submissions
      const fetchedStudents = await authService.getRegisteredStudents();
      const fetchedSubmissions = await submissionService.getAllSubmissions();
      
      // Subscribe to boards (since they are already cached / real-time)
      boardService.subscribeBoards((data) => {
        setBoards(data);
      });

      // Sort students: Room first (asc), Student Number (asc)
      const sortedStudents = [...fetchedStudents].sort((a, b) => {
        const roomA = Number(a.room || 0);
        const roomB = Number(b.room || 0);
        if (roomA !== roomB) return roomA - roomB;
        
        const noA = Number(a.studentNo || 0);
        const noB = Number(b.studentNo || 0);
        return noA - noB;
      });

      setStudents(sortedStudents);
      setSubmissions(fetchedSubmissions);
    } catch (err) {
      console.error("Error loading gradebook data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "teacher") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดสมุดคะแนน...</p>
      </div>
    );
  }

  // Helper to get student's score for a specific board
  const getStudentScore = (student: UserProfile, boardId: string) => {
    const boardSubs = submissions.filter(s => s.boardId === boardId);
    
    // Find matching submission (by uid or if group, by room & studentNo in members list)
    const sub = boardSubs.find(s => {
      if (s.uid === student.uid) return true;
      if (s.isGroup && s.members) {
        return s.members.some(m => m.room === student.room && m.studentNo === student.studentNo);
      }
      return false;
    });

    if (!sub) return { text: "ยังไม่ส่ง", score: null, max: null, status: "none", subId: null };
    
    if (sub.status === "resubmit") {
      return { text: "ส่งกลับแก้ไข", score: null, max: null, status: "resubmit", subId: sub.id };
    }
    
    if (sub.score !== undefined) {
      return { text: `${sub.score}/${sub.maxScore}`, score: sub.score, max: sub.maxScore, status: "graded", subId: sub.id };
    }
    
    return { text: "รอตรวจ", score: null, max: null, status: "pending", subId: sub.id };
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const gradeRoom = `${student.grade || "4"}-${student.room}`;
    const matchesRoom = selectedRoom === "all" || gradeRoom === selectedRoom;
    const matchesSearch = 
      (student.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentNo || "").includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  // Export to CSV (Thai Excel-compatible UTF-8 BOM)
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    // Header: เลขที่, ห้อง, ชื่อ-นามสกุล, คะแนนโบนัส, [ชื่องาน 1], [ชื่องาน 2]...
    const headers = ["เลขที่", "ห้อง", "ชื่อ-นามสกุล", "คะแนนโบนัส"];
    boards.forEach(b => {
      headers.push(`"${b.title.replace(/"/g, '""')}"`);
    });

    const csvRows = [headers.join(",")];

    filteredStudents.forEach(student => {
      const row = [
        student.studentNo || "-",
        `ม.${student.grade || "4"}/${student.room || "-"}`,
        `"${(student.fullName || "").replace(/"/g, '""')}"`,
        String(student.bonusPoints || 0)
      ];

      boards.forEach(b => {
        const scoreInfo = getStudentScore(student, b.id);
        row.push(scoreInfo.score !== null ? String(scoreInfo.score) : `"${scoreInfo.text}"`);
      });

      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    // UTF-8 BOM prefix
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `สมุดคะแนน_${selectedRoom === "all" ? "ทุกห้อง" : selectedRoom.replace("-", "/")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate stats
  const totalStudentsCount = filteredStudents.length;
  const gradedCount = submissions.filter(s => s.status === "graded").length;
  const pendingCount = submissions.filter(s => s.status === "pending").length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <ClipboardList className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">สมุดคะแนนและติดตามงาน</h1>
            <p className={styles.subtitle}>ตารางคะแนนรวมนักเรียนชั้น ม.4 และ ม.5 ตรวจสอบสถานะการส่งงานและส่งออก Excel</p>
          </div>
        </div>

        <div className={styles.actionButtons}>
          <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <RefreshCw size={16} />
            <span>รีเฟรชข้อมูล</span>
          </button>
          
          <button 
            onClick={handleExportCSV} 
            className="btn-primary" 
            style={{ display: "flex", gap: "6px", alignItems: "center" }}
            disabled={filteredStudents.length === 0}
          >
            <Download size={16} />
            <span>ส่งออก CSV (Excel)</span>
          </button>
        </div>
      </header>

      {/* Stats Panel */}
      <div className={styles.statsPanel}>
        <div className={`${styles.statCard} glass-container`}>
          <Users size={20} className={styles.statIconBlue} />
          <div>
            <div className={styles.statVal}>{totalStudentsCount} คน</div>
            <div className={styles.statLabel}>นักเรียนในตารางตัวกรอง</div>
          </div>
        </div>

        <div className={`${styles.statCard} glass-container`}>
          <Award size={20} className={styles.statIconGreen} />
          <div>
            <div className={styles.statVal}>{gradedCount} งาน</div>
            <div className={styles.statLabel}>ตรวจ/ประเมินแล้วทั้งหมด</div>
          </div>
        </div>

        <div className={`${styles.statCard} glass-container`}>
          <FileSpreadsheet size={20} className={styles.statIconYellow} />
          <div>
            <div className={styles.statVal}>{pendingCount} งาน</div>
            <div className={styles.statLabel}>รอตรวจ/ส่งงานใหม่</div>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className={`${styles.filterBar} glass-container`}>
        <div className={styles.filterGroup}>
          <Filter size={18} className={styles.filterIcon} />
          <select 
            value={selectedRoom} 
            onChange={(e) => setSelectedRoom(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="all">ทุกห้องเรียน</option>
            <optgroup label="ม.4">
              {["2", "3", "4", "5", "6", "12", "13"].map((r) => (
                <option key={`4-${r}`} value={`4-${r}`}>ห้อง ม.4/{r}</option>
              ))}
            </optgroup>
            <optgroup label="ม.5">
              {["2", "3"].map((r) => (
                <option key={`5-${r}`} value={`5-${r}`}>ห้อง ม.5/{r}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className={styles.searchGroup}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="ค้นหาตามชื่อ-นามสกุล หรือ เลขที่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Gradebook Table */}
      {filteredStudents.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ไม่พบรายชื่อนักเรียนตามตัวกรองที่เลือก</p>
          <p className={styles.emptySub}>กรุณาลงทะเบียนนักเรียน หรือปรับเปลี่ยนเงื่อนไขการค้นหา/ตัวกรองห้องเรียน</p>
        </div>
      ) : (
        <div className={`${styles.tableWrapper} glass-container`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thFixed}>เลขที่</th>
                <th className={styles.thFixed}>ห้อง</th>
                <th className={styles.thFixedName}>ชื่อ - นามสกุล</th>
                <th className={styles.thScore} style={{ minWidth: "90px", color: "var(--accent-cyan)" }}>คะแนนโบนัส</th>
                {boards.map(board => (
                  <th key={board.id} className={styles.thScore} title={board.title}>
                    <div className={styles.boardHeaderCell}>
                      <span className={styles.boardHeaderTitle}>{board.title}</span>
                      <span className={styles.boardHeaderType}>
                        ({board.type === "group" ? "กลุ่ม" : "เดี่ยว"})
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.uid}>
                  <td className={`${styles.tdFixed} ${styles.tdNo}`}>{student.studentNo}</td>
                  <td className={styles.tdFixed}>ม.{student.grade || "4"}/{student.room}</td>
                  <td className={`${styles.tdFixedName} ${styles.tdName}`}>{student.fullName}</td>
                  <td className={styles.tdScore} style={{ color: "#38a169", fontWeight: "bold", textAlign: "center" }}>
                    +{student.bonusPoints || 0}
                  </td>
                  {boards.map(board => {
                    const statusInfo = getStudentScore(student, board.id);
                    let badgeClass = styles.badgeNone;
                    
                    if (statusInfo.status === "graded") badgeClass = styles.badgeGraded;
                    else if (statusInfo.status === "pending") badgeClass = styles.badgePending;
                    else if (statusInfo.status === "resubmit") badgeClass = styles.badgeResubmit;

                    return (
                      <td key={board.id} className={styles.tdScore}>
                        {statusInfo.subId ? (
                          <Link href={`/padlet/${board.id}`} className={`${styles.scoreBadge} ${badgeClass}`}>
                            {statusInfo.text}
                          </Link>
                        ) : (
                          <span className={`${styles.scoreBadge} ${badgeClass}`}>
                            {statusInfo.text}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
