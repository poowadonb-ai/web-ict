"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, UserProfile } from "@/lib/firebase";
import { Users, Search, Filter, RefreshCw, Edit3, X, AlertTriangle, GitMerge, Check, Trash2 } from "lucide-react";
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
      loadData();
    }
  }, [user]);

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
    setEditRoom(student.room || "1");
    setEditNo(student.studentNo || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editName.trim() || !editRoom || !editNo) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateStudentProfile(editingStudent.uid, {
        fullName: editName.trim(),
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
    } catch (err: any) {
      console.error("Merge error:", err);
      alert("เกิดข้อผิดพลาดในการรวมบัญชี: " + (err.message || String(err)));
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
      await authService.deleteStudent(deletingStudent.uid);
      setShowDeleteModal(false);
      setDeletingStudent(null);
      alert("ลบข้อมูลนักเรียนเรียบร้อยแล้ว!");
      loadData();
    } catch (err: any) {
      console.error("Error deleting student:", err);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล: " + (err.message || String(err)));
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

        <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <RefreshCw size={16} />
          <span>รีเฟรชข้อมูล</span>
        </button>
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
                <th>ซองการ์ดที่มี</th>
                <th>การ์ดในคอลเลกชัน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.uid}>
                  <td>ม.{student.grade || "4"}/{student.room}</td>
                  <td>{student.studentNo}</td>
                  <td className={styles.studentNameCell}>{student.fullName}</td>
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
                      onClick={() => handleOpenDelete(student)}
                      className={styles.deleteBtn}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className={styles.formGroup}>
                  <label>ห้อง (ม.{editingStudent?.grade || "4"}/...)</label>
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
                กรุณาตรวจสอบข้อมูลและเลือก <strong>"บัญชีหลัก (ที่จะเก็บไว้ใช้งาน)"</strong> ระบบจะโอนย้ายการ์ด ซองการ์ด คะแนนโบนัส และงานทั้งหมดไปยังบัญชีหลัก และลบบัญชีรองออก
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
    </div>
  );
}
