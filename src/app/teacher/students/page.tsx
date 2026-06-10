"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, UserProfile } from "@/lib/firebase";
import { Users, Search, Filter, RefreshCw, Edit3, X } from "lucide-react";
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
    const matchesRoom = selectedRoom === "all" || student.room === selectedRoom;
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
              {["1","2", "3", "4", "5", "6", "12", "13"].map((r) => (
                <option key={r} value={r}>
                  ม.4/{r}
                </option>
              ))}
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
                  <td>ม.4/{student.room}</td>
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
                  <label>ห้อง (ม.4/...)</label>
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
    </div>
  );
}
