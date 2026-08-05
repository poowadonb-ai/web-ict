"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { Users, Search, Filter, RefreshCw, Edit3, X, AlertTriangle, GitMerge, Trash2, Key, Upload } from "lucide-react";
import styles from "./page.module.css";

export default function ManageStudentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editNo, setEditNo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate detection state
  const [duplicatePairs, setDuplicatePairs] = useState<{ student1: UserProfile; student2: UserProfile; reason: string }[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePair, setMergePair] = useState<{ student1: UserProfile; student2: UserProfile; reason: string } | null>(null);
  const [primaryUid, setPrimaryUid] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);
  const [isDuplicatesExpanded, setIsDuplicatesExpanded] = useState(false);

  // Roster Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importGrade, setImportGrade] = useState("4");
  const [importRoom, setImportRoom] = useState("2");
  const [importNamesText, setImportNamesText] = useState("");
  const [importStartNo, setImportStartNo] = useState("1");
  const [importPassword, setImportPassword] = useState("123456");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);

  // Student Password Change States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStudent, setPasswordStudent] = useState<UserProfile | null>(null);
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Simple Levenshtein distance
  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) tmp[i] = [i];
    for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  };

  const areNamesSimilar = (name1: string, name2: string): boolean => {
    const n1 = name1.replace(/\s+/g, "").toLowerCase();
    const n2 = name2.replace(/\s+/g, "").toLowerCase();
    if (n1 === n2) return true;
    if (n1.length > 5 && n2.length > 5) {
      if (n1.includes(n2) || n2.includes(n1)) return true;
    }
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return false;
    const dist = getLevenshteinDistance(n1, n2);
    const similarity = 1 - dist / maxLen;
    return similarity >= 0.75;
  };

  const findDuplicates = (studentList: UserProfile[]) => {
    const pairs: { student1: UserProfile; student2: UserProfile; reason: string }[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < studentList.length; i++) {
      for (let j = i + 1; j < studentList.length; j++) {
        const s1 = studentList[i];
        const s2 = studentList[j];
        
        let isDuplicate = false;
        let reason = "";

        const sameClassRoom = s1.grade === s2.grade && s1.room === s2.room;
        const sameNo = s1.studentNo && s2.studentNo && s1.studentNo === s2.studentNo;

        if (sameClassRoom && sameNo) {
          isDuplicate = true;
          reason = `ห้องเดียวกัน (ม.${s1.grade || "4"}/${s1.room}) และเลขที่เดียวกัน (${s1.studentNo})`;
        } else if (s1.fullName && s2.fullName && areNamesSimilar(s1.fullName, s2.fullName)) {
          isDuplicate = true;
          reason = "ชื่อสะกดคล้ายกันมาก";
        }

        if (isDuplicate) {
          const pairId = [s1.uid, s2.uid].sort().join("-");
          if (!visited.has(pairId)) {
            visited.add(pairId);
            pairs.push({ student1: s1, student2: s2, reason });
          }
        }
      }
    }
    setDuplicatePairs(pairs);
  };

  useEffect(() => {
    // Redirect if not teacher
    if (!authLoading && (!user || user.role !== "teacher")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedStudents = await authService.getRegisteredStudents();
      // Sort by room then number
      const sortedStudents = [...fetchedStudents].sort((a, b) => {
        const roomA = Number(a.room || 0);
        const roomB = Number(b.room || 0);
        if (roomA !== roomB) return roomA - roomB;
        
        const noA = Number(a.studentNo || 0);
        const noB = Number(b.studentNo || 0);
        return noA - noB;
      });
      setStudents(sortedStudents);
      findDuplicates(sortedStudents);
    } catch (err) {
      console.error("Error loading students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "teacher") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleOpenPasswordReset = (student: UserProfile) => {
    setPasswordStudent(student);
    setNewStudentPassword("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStudent || !user) return;
    if (newStudentPassword.length < 6) {
      setPasswordError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError("");
    try {
      const res = await fetch("/api/auth/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherUid: user.uid,
          action: "update_password",
          studentUid: passwordStudent.uid,
          newPassword: newStudentPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");

      alert("เปลี่ยนรหัสผ่านนักเรียนสำเร็จ!");
      setShowPasswordModal(false);
      setPasswordStudent(null);
      setNewStudentPassword("");
    } catch (err) {
      console.error("Error updating password:", err);
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน";
      setPasswordError(errMsg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleImportRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setImportError("");
    
    const names = importNamesText
      .split("\n")
      .map(n => n.trim())
      .filter(n => n.length > 0);
      
    if (names.length === 0) {
      setImportError("กรุณากรอกรายชื่อนักเรียนอย่างน้อย 1 คน");
      return;
    }
    
    if (importPassword.length < 6) {
      setImportError("รหัสผ่านเริ่มต้นต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsImporting(true);
    setImportTotal(names.length);
    setImportProgress(0);

    const startNo = parseInt(importStartNo) || 1;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const studentNo = String(startNo + i);
      
      // Clean names that might have a number prefix (e.g. "1. นายสมชาย" or "1 นายสมชาย")
      const cleanedName = name.replace(/^\d+[\s\.\,\-\_]*/, "").trim();
      
      // Generate standard username: std_4_2_15
      const username = `std_${importGrade}_${importRoom}_${studentNo}`;

      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password: importPassword,
            fullName: cleanedName,
            grade: importGrade,
            room: importRoom,
            studentNo,
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          console.error(`Failed to import ${cleanedName}:`, data.error);
          failCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to import ${cleanedName}:`, err);
        failCount++;
      }
      
      setImportProgress(i + 1);
    }
    
    setIsImporting(false);
    alert(`นำเข้ารายชื่อเสร็จสิ้น! สำเร็จ ${successCount} คน, ล้มเหลว ${failCount} คน`);
    setShowImportModal(false);
    setImportNamesText("");
    loadData();
  };

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดข้อมูลนักเรียน...</p>
      </div>
    );
  }

  // Filter students
  const filteredStudents = students.filter(student => {
    const gradeRoom = `${student.grade || "4"}-${student.room}`;
    const matchesRoom = selectedRoom === "all" || gradeRoom === selectedRoom;
    const matchesSearch = 
      (student.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentNo || "").includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  const handleOpenEdit = (student: UserProfile) => {
    setEditingStudent(student);
    setEditName(student.fullName || "");
    setEditGrade(student.grade || "4");
    setEditRoom(student.room || "1");
    setEditNo(student.studentNo || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editName.trim() || !editGrade || !editRoom || !editNo) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateStudentProfile(editingStudent.uid, {
        fullName: editName.trim(),
        grade: editGrade,
        room: editRoom,
        studentNo: editNo
      });
      setShowEditModal(false);
      loadData(); // Reload to get updated data
    } catch (err) {
      console.error("Error updating student:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMerge = async () => {
    if (!mergePair) return;
    const targetUid = primaryUid;
    const sourceUid = mergePair.student1.uid === primaryUid ? mergePair.student2.uid : mergePair.student1.uid;
    
    if (!targetUid || !sourceUid) {
      alert("กรุณาเลือกบัญชีหลักที่ต้องการเก็บไว้");
      return;
    }

    if (!confirm("คุณแน่ใจหรือไม่ที่จะรวม 2 บัญชีนี้เข้าด้วยกัน? การดำเนินการนี้ไม่สามารถย้อนกลับได้")) {
      return;
    }

    setIsMerging(true);
    try {
      await authService.mergeStudents(sourceUid, targetUid);
      setShowMergeModal(false);
      setMergePair(null);
      alert("รวมบัญชีนักเรียนเรียบร้อยแล้ว!");
      loadData();
    } catch (err) {
      console.error("Merge error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`เกิดข้อผิดพลาดในการรวมบัญชี: ${errMsg}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleOpenDelete = (student: UserProfile) => {
    setDeletingStudent(student);
    setDeleteConfirmText("");
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingStudent) return;
    if (deleteConfirmText.trim() !== "ยืนยัน") {
      alert("กรุณาพิมพ์คำว่า ยืนยัน ให้ถูกต้อง");
      return;
    }

    setIsDeleting(true);
    try {
      // Delete in Firestore/database mode database
      await authService.deleteStudent(deletingStudent.uid);

      // ALSO delete in Supabase if in firebase mode (since Supabase credentials need cleanup)
      const isFirebase = process.env.NEXT_PUBLIC_DATABASE_MODE === "firebase";
      if (isFirebase && user) {
        try {
          await fetch("/api/auth/roster", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teacherUid: user.uid,
              action: "delete_student",
              studentUid: deletingStudent.uid
            })
          });
        } catch (supabaseErr) {
          console.error("Error deleting credentials in Supabase:", supabaseErr);
        }
      }

      setShowDeleteModal(false);
      setDeletingStudent(null);
      alert("ลบข้อมูลนักเรียนเรียบร้อยแล้ว!");
      loadData();
    } catch (err) {
      console.error("Error deleting student:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`เกิดข้อผิดพลาดในการลบข้อมูล: ${errMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Users className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">จัดการข้อมูลนักเรียน</h1>
            <p className={styles.subtitle}>ตรวจสอบรายชื่อ แก้ไขชื่อ ห้อง และเลขที่ของนักเรียน</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={() => {
              setImportGrade("4");
              setImportRoom("2");
              setImportNamesText("");
              setImportStartNo("1");
              setImportPassword("123456");
              setImportError("");
              setShowImportModal(true);
            }} 
            className="btn-primary" 
            style={{ display: "flex", gap: "6px", alignItems: "center", background: "linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%)" }}
          >
            <Upload size={16} />
            <span>นำเข้ารายชื่อห้องเรียน</span>
          </button>
          <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <RefreshCw size={16} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </header>

      {/* Filters Area */}
      <div className={`${styles.filterBar} glass-container`}>
        <div className={styles.panelControls}>
          <div className={styles.filterGroup}>
            <Filter size={18} style={{color: "var(--text-secondary)"}} />
            <select 
              value={selectedRoom} 
              onChange={(e) => setSelectedRoom(e.target.value)}
            >
              <option value="all">ทุกห้องเรียน</option>
              <optgroup label="ม.4">
                {["2","3","4","5","6","12","13"].map((r) => (
                  <option key={`4-${r}`} value={`4-${r}`}>ม.4/{r}</option>
                ))}
              </optgroup>
              <optgroup label="ม.5">
                {["2","3"].map((r) => (
                  <option key={`5-${r}`} value={`5-${r}`}>ม.5/{r}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className={styles.searchGroup}>
            <Search size={18} style={{color: "var(--text-secondary)"}} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ-นามสกุล หรือ เลขที่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Duplicate Alert Area */}
      {duplicatePairs.length > 0 && (
        <div className={`${styles.duplicateSection} glass-container`}>
          <div className={styles.duplicateHeader}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <AlertTriangle className={styles.warningIcon} size={22} />
              <div>
                <h3>พบข้อมูลบัญชีนักเรียนซ้ำซ้อน ({duplicatePairs.length} รายการที่น่าสงสัย)</h3>
                <p>ระบบตรวจพบบัญชีที่เลขที่ชนกันหรือชื่อสะกดคล้ายคลึงกัน คุณสามารถเลือกเปรียบเทียบและรวมข้อมูลได้</p>
              </div>
            </div>
            <button 
              onClick={() => setIsDuplicatesExpanded(!isDuplicatesExpanded)}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              {isDuplicatesExpanded ? "ซ่อนรายชื่อ" : `ตรวจสอบรายชื่อ (${duplicatePairs.length})`}
            </button>
          </div>
          
          {isDuplicatesExpanded && (
            <div className={styles.duplicateListContainer}>
              <div className={styles.duplicateList}>
                {duplicatePairs.map((pair, index) => (
                  <div key={index} className={styles.duplicateCard}>
                    <div className={styles.duplicateGrid}>
                      <div className={styles.duplicateStudent}>
                        <span className={styles.studentLabel}>บัญชีที่ 1</span>
                        <strong className={styles.studentName}>{pair.student1.fullName}</strong>
                        <span className={styles.studentMeta}>ม.{pair.student1.grade || "4"}/{pair.student1.room} เลขที่ {pair.student1.studentNo}</span>
                        <span className={styles.studentEmail}>{pair.student1.email}</span>
                      </div>
                      <div className={styles.mergeArrowArea}>
                        <GitMerge size={20} className={styles.mergeIcon} />
                      </div>
                      <div className={styles.duplicateStudent}>
                        <span className={styles.studentLabel}>บัญชีที่ 2</span>
                        <strong className={styles.studentName}>{pair.student2.fullName}</strong>
                        <span className={styles.studentMeta}>ม.{pair.student2.grade || "4"}/{pair.student2.room} เลขที่ {pair.student2.studentNo}</span>
                        <span className={styles.studentEmail}>{pair.student2.email}</span>
                      </div>
                    </div>
                    <div className={styles.duplicateFooter}>
                      <span className={styles.reasonTag}>สาเหตุ: {pair.reason}</span>
                      <button
                        onClick={() => {
                          setMergePair(pair);
                          setPrimaryUid(pair.student2.uid); // Default to target (newer/second)
                          setShowMergeModal(true);
                        }}
                        className={styles.mergeBtn}
                      >
                        <GitMerge size={14} />
                        เปรียบเทียบ & รวมข้อมูล
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {filteredStudents.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ไม่พบรายชื่อนักเรียน</p>
          <p className={styles.emptySub}>ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรองห้องเรียน</p>
        </div>
      ) : (
        <div className={`${styles.tableWrapper} glass-container`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>เลขที่</th>
                <th>ชื่อ - นามสกุล</th>
                <th>ชื่อผู้ใช้ (Username)</th>
                <th>ซองการ์ดที่มี</th>
                <th>การ์ดในคอลเลกชัน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => {
                const studentUsername = student.email ? student.email.split("@")[0] : "-";
                return (
                  <tr key={student.uid}>
                    <td>ม.{student.grade || "4"}/{student.room}</td>
                    <td>{student.studentNo}</td>
                    <td className={styles.studentNameCell}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span>{student.fullName}</span>
                        {student.isMerged && (
                          <span className={styles.mergedBadge} title="บัญชีนี้ผ่านการรวมประวัติเนื่องจากการสมัครซ้ำ">
                            <GitMerge size={12} />
                            รวมบัญชีแล้ว
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", color: "var(--accent-cyan-light)" }}>
                      {studentUsername}
                    </td>
                    <td style={{ color: "var(--accent-purple)", fontWeight: "bold" }}>
                      {student.packsCount || 0} ซอง
                    </td>
                    <td>
                      {student.cardsCollected ? student.cardsCollected.reduce((acc, c) => acc + (c.count || 0), 0) : 0} ใบ
                    </td>
                    <td className={styles.actionCell}>
                      <button 
                        onClick={() => handleOpenEdit(student)}
                        className={styles.editBtn}
                      >
                        <Edit3 size={14} />
                        แก้ไข
                      </button>
                      <button 
                        onClick={() => handleOpenPasswordReset(student)}
                        className={styles.editBtn}
                        style={{ border: "1px solid rgba(168, 85, 247, 0.4)", color: "var(--accent-purple-light)" }}
                      >
                        <Key size={14} />
                        เปลี่ยนรหัส
                      </button>
                      <button 
                        onClick={() => handleOpenDelete(student)}
                        className={styles.deleteBtn}
                      >
                        <Trash2 size={14} />
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingStudent && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3 className="gradient-text">แก้ไขข้อมูลนักเรียน</h3>
              <button onClick={() => setShowEditModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className={styles.formGroup}>
                <label>ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div className={styles.formGroup}>
                  <label>ระดับชั้น</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    disabled={isSaving}
                    required
                  >
                    <option value="4">ม.4</option>
                    <option value="5">ม.5</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>ห้อง</label>
                  <select
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    disabled={isSaving}
                    required
                  >
                    {[...Array(14)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        ห้อง {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>เลขที่</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={editNo}
                    onChange={(e) => setEditNo(e.target.value)}
                    disabled={isSaving}
                    required
                  />
                </div>
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="btn-secondary"
                  disabled={isSaving}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && mergePair && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.mergeModal} glass-container`}>
            <header className={styles.modalHeader}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <GitMerge className="gradient-text" size={24} />
                <h3 className="gradient-text">เปรียบเทียบและรวมบัญชีนักเรียน</h3>
              </div>
              <button onClick={() => { setShowMergeModal(false); setMergePair(null); }} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <div className={styles.mergeModalContent}>
              <p className={styles.modalDesc}>
                กรุณาตรวจสอบข้อมูลและเลือก <strong>&quot;บัญชีหลัก (ที่จะเก็บไว้ใช้งาน)&quot;</strong> ระบบจะโอนย้ายการ์ด ซองการ์ด คะแนนโบนัส และงานทั้งหมดไปยังบัญชีหลัก และลบบัญชีรองออก
              </p>

              <div className={styles.compareGrid}>
                {/* Student 1 Card */}
                <div 
                  className={`${styles.compareCard} ${primaryUid === mergePair.student1.uid ? styles.compareCardSelected : ""}`}
                  onClick={() => setPrimaryUid(mergePair.student1.uid)}
                >
                  <div className={styles.compareCardHeader}>
                    <input 
                      type="radio" 
                      name="primaryAccount"
                      checked={primaryUid === mergePair.student1.uid}
                      onChange={() => setPrimaryUid(mergePair.student1.uid)}
                      id="s1-radio"
                    />
                    <label htmlFor="s1-radio" className={styles.radioLabel}>
                      {primaryUid === mergePair.student1.uid ? "บัญชีหลัก (เก็บไว้)" : "บัญชีรอง (จะถูกรวมแล้วลบ)"}
                    </label>
                  </div>
                  <div className={styles.compareCardBody}>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ชื่อ-นามสกุล</span>
                      <strong className={styles.compareVal}>{mergePair.student1.fullName}</strong>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>อีเมล</span>
                      <span className={styles.compareVal}>{mergePair.student1.email || "-"}</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ห้อง / เลขที่</span>
                      <span className={styles.compareVal}>ม.{mergePair.student1.grade || "4"}/{mergePair.student1.room} เลขที่ {mergePair.student1.studentNo}</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ซองการ์ดที่มี</span>
                      <span className={styles.compareVal} style={{color: "var(--accent-purple)", fontWeight: "bold"}}>{mergePair.student1.packsCount || 0} ซอง</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>การ์ดสะสม</span>
                      <span className={styles.compareVal}>{mergePair.student1.cardsCollected ? mergePair.student1.cardsCollected.reduce((acc, c) => acc + (c.count || 0), 0) : 0} ใบ</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>คะแนนโบนัส</span>
                      <span className={styles.compareVal} style={{color: "var(--accent-blue)", fontWeight: "bold"}}>{mergePair.student1.bonusPoints || 0} คะแนน</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>เข้าสู่ระบบล่าสุด</span>
                      <span className={styles.compareVal}>{mergePair.student1.lastLoginDate || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Student 2 Card */}
                <div 
                  className={`${styles.compareCard} ${primaryUid === mergePair.student2.uid ? styles.compareCardSelected : ""}`}
                  onClick={() => setPrimaryUid(mergePair.student2.uid)}
                >
                  <div className={styles.compareCardHeader}>
                    <input 
                      type="radio" 
                      name="primaryAccount"
                      checked={primaryUid === mergePair.student2.uid}
                      onChange={() => setPrimaryUid(mergePair.student2.uid)}
                      id="s2-radio"
                    />
                    <label htmlFor="s2-radio" className={styles.radioLabel}>
                      {primaryUid === mergePair.student2.uid ? "บัญชีหลัก (เก็บไว้)" : "บัญชีรอง (จะถูกรวมแล้วลบ)"}
                    </label>
                  </div>
                  <div className={styles.compareCardBody}>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ชื่อ-นามสกุล</span>
                      <strong className={styles.compareVal}>{mergePair.student2.fullName}</strong>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>อีเมล</span>
                      <span className={styles.compareVal}>{mergePair.student2.email || "-"}</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ห้อง / เลขที่</span>
                      <span className={styles.compareVal}>ม.{mergePair.student2.grade || "4"}/{mergePair.student2.room} เลขที่ {mergePair.student2.studentNo}</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>ซองการ์ดที่มี</span>
                      <span className={styles.compareVal} style={{color: "var(--accent-purple)", fontWeight: "bold"}}>{mergePair.student2.packsCount || 0} ซอง</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>การ์ดสะสม</span>
                      <span className={styles.compareVal}>{mergePair.student2.cardsCollected ? mergePair.student2.cardsCollected.reduce((acc, c) => acc + (c.count || 0), 0) : 0} ใบ</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>คะแนนโบนัส</span>
                      <span className={styles.compareVal} style={{color: "var(--accent-blue)", fontWeight: "bold"}}>{mergePair.student2.bonusPoints || 0} คะแนน</span>
                    </div>
                    <div className={styles.compareRow}>
                      <span className={styles.compareLabel}>เข้าสู่ระบบล่าสุด</span>
                      <span className={styles.compareVal}>{mergePair.student2.lastLoginDate || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.mergeSummary} glass-container`}>
                <h4 style={{margin: "0 0 10px 0", color: "var(--accent-purple)"}}>ผลลัพธ์หลังรวมข้อมูลบัญชี:</h4>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: "0.85rem"}}>
                  <div>ชื่อบัญชีที่ใช้ต่อ: <strong>{primaryUid === mergePair.student1.uid ? mergePair.student1.fullName : mergePair.student2.fullName}</strong></div>
                  <div>อีเมลที่เข้าใช้งาน: <strong>{primaryUid === mergePair.student1.uid ? mergePair.student1.email : mergePair.student2.email}</strong></div>
                  <div>ยอดซองการ์ดรวม: <strong style={{color: "var(--accent-purple)"}}>{(mergePair.student1.packsCount || 0) + (mergePair.student2.packsCount || 0)} ซอง</strong></div>
                  <div>คะแนนโบนัสรวม: <strong style={{color: "var(--accent-blue)"}}>{(mergePair.student1.bonusPoints || 0) + (mergePair.student2.bonusPoints || 0)} คะแนน</strong></div>
                </div>
              </div>

              <div className={styles.mergeWarning}>
                <AlertTriangle size={16} />
                <span>คำเตือน: ข้อมูลบัญชีรองจะถูกรวมและลบออกจากระบบอย่างถาวร ไม่สามารถยกเลิกการกระทำนี้ได้ในภายหลัง</span>
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <button 
                type="button" 
                onClick={() => { setShowMergeModal(false); setMergePair(null); }} 
                className="btn-secondary"
                disabled={isMerging}
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={handleMerge}
                className="btn-primary"
                disabled={isMerging}
                style={{ background: "linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%)" }}
              >
                {isMerging ? "กำลังรวมข้อมูล..." : "ยืนยันการรวมบัญชี"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      {showDeleteModal && deletingStudent && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`} style={{ borderColor: "rgba(239, 68, 68, 0.3)" }}>
            <header className={styles.modalHeader}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#ef4444" }}>
                <AlertTriangle size={22} />
                <h3 style={{ color: "#ef4444", margin: 0 }}>ลบข้อมูลนักเรียน</h3>
              </div>
              <button onClick={() => { setShowDeleteModal(false); setDeletingStudent(null); }} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleDeleteConfirm} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <p className={styles.modalDesc} style={{ fontSize: "0.95rem", lineHeight: "1.5" }}>
                คุณต้องการลบข้อมูลบัญชีของ <strong>{deletingStudent.fullName}</strong> (ม.{deletingStudent.grade || "4"}/{deletingStudent.room} เลขที่ {deletingStudent.studentNo}) ใช่หรือไม่?
              </p>
              
              <div className={styles.mergeWarning} style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#ef4444", padding: "12px 16px", borderRadius: "10px", display: "flex", gap: "10px", alignItems: "center", fontSize: "0.85rem" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>การลบนี้จะลบการ์ดสะสมทั้งหมด ซองการ์ด และประวัติงานอย่างถาวร ไม่สามารถย้อนกลับได้</span>
              </div>

              <div className={styles.formGroup}>
                <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  พิมพ์คำว่า <strong style={{ color: "var(--text-primary)" }}>ยืนยัน</strong> เพื่อดำเนินการลบ:
                </label>
                <input
                  type="text"
                  placeholder='พิมพ์คำว่า "ยืนยัน"'
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  disabled={isDeleting}
                  required
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    color: "white",
                    fontSize: "1rem"
                  }}
                />
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => { setShowDeleteModal(false); setDeletingStudent(null); }} 
                  className="btn-secondary"
                  disabled={isDeleting}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isDeleting || deleteConfirmText.trim() !== "ยืนยัน"}
                  style={{ 
                    background: deleteConfirmText.trim() === "ยืนยัน" ? "#ef4444" : "rgba(255, 255, 255, 0.05)", 
                    color: deleteConfirmText.trim() === "ยืนยัน" ? "white" : "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    cursor: deleteConfirmText.trim() === "ยืนยัน" ? "pointer" : "not-allowed"
                  }}
                >
                  {isDeleting ? "กำลังลบ..." : "ลบข้อมูลอย่างถาวร"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Roster Import Modal */}
      {showImportModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`} style={{ maxWidth: "560px" }}>
            <header className={styles.modalHeader}>
              <h3 className="gradient-text">นำเข้ารายชื่อห้องเรียน (Import Roster)</h3>
              <button onClick={() => !isImporting && setShowImportModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            {isImporting ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px 0", alignItems: "center", justifyContent: "center" }}>
                <div className={styles.spinner} />
                <p style={{ fontWeight: "bold" }}>กำลังนำเข้ารายชื่อนักเรียน...</p>
                <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${(importProgress / importTotal) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--accent-purple), var(--accent-blue))", transition: "width 0.2s ease" }} />
                </div>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  ความคืบหน้า: {importProgress} / {importTotal} คน
                </span>
              </div>
            ) : (
              <form onSubmit={handleImportRoster} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {importError && (
                  <div className={styles.mergeWarning} style={{ background: "rgba(239, 68, 68, 0.08)", color: "#ef4444", padding: "10px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {importError}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className={styles.formGroup}>
                    <label>ระดับชั้น</label>
                    <select value={importGrade} onChange={(e) => setImportGrade(e.target.value)} required>
                      <option value="4">ม.4</option>
                      <option value="5">ม.5</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>ห้องเรียน</label>
                    <select value={importRoom} onChange={(e) => setImportRoom(e.target.value)} required>
                      {importGrade === "4" ? (
                        ["2","3","4","5","6","12","13"].map((r) => (
                          <option key={r} value={r}>ม.4/{r}</option>
                        ))
                      ) : (
                        ["2","3"].map((r) => (
                          <option key={r} value={r}>ม.5/{r}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className={styles.formGroup}>
                    <label>เลขที่เริ่มต้น</label>
                    <input
                      type="number"
                      min="1"
                      value={importStartNo}
                      onChange={(e) => setImportStartNo(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>รหัสผ่านเริ่มต้นสำหรับทุกคน</label>
                    <input
                      type="text"
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder="เช่น 123456"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>รายชื่อนักเรียน (พิมพ์ 1 ชื่อต่อ 1 บรรทัด)</label>
                  <textarea
                    value={importNamesText}
                    onChange={(e) => setImportNamesText(e.target.value)}
                    placeholder="เช่น:&#10;นายสมชาย ใจดี&#10;เด็กหญิงสมศรี รักเรียน"
                    rows={8}
                    required
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "10px",
                      padding: "12px",
                      color: "white",
                      width: "100%",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    * สามารถคัดลอกจาก Excel วางลงไปตรงๆ ได้เลย ระบบจะล้างเลขที่นำหน้าให้อัตโนมัติ
                  </span>
                </div>

                <footer className={styles.modalFooter}>
                  <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary">
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn-primary" style={{ background: "linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%)" }}>
                    เริ่มนำเข้ารายชื่อ
                  </button>
                </footer>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordStudent && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3 className="gradient-text">เปลี่ยนรหัสผ่านนักเรียน</h3>
              <button onClick={() => setShowPasswordModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>บัญชีเป้าหมาย:</p>
                <strong style={{ fontSize: "1.05rem" }}>{passwordStudent.fullName}</strong>
                <span style={{ display: "block", fontSize: "0.85rem", color: "var(--accent-cyan-light)", marginTop: "2px" }}>
                  ม.{passwordStudent.grade || "4"}/{passwordStudent.room} เลขที่ {passwordStudent.studentNo} (Username: {passwordStudent.email?.split("@")[0] || "-"})
                </span>
              </div>

              {passwordError && (
                <div className={styles.mergeWarning} style={{ background: "rgba(239, 68, 68, 0.08)", color: "#ef4444", padding: "10px", borderRadius: "8px" }}>
                  {passwordError}
                </div>
              )}

              <div className={styles.formGroup}>
                <label>รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                <input
                  type="text"
                  placeholder="กรอกรหัสผ่านใหม่ที่นี่"
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                  required
                />
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowPasswordModal(false)} 
                  className="btn-secondary"
                  disabled={isUpdatingPassword}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? "กำลังเปลี่ยน..." : "บันทึกรหัสใหม่"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
