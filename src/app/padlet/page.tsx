"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { boardService, AssignmentBoard } from "@/lib/firebase";
import { Plus, Trash2, Calendar, ClipboardList, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export default function PadletPage() {
  const { user, loading } = useAuth();
  const [boards, setBoards] = useState<AssignmentBoard[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"individual" | "group">("individual");
  const [targetRoomsState, setTargetRoomsState] = useState<string[]>(["2", "3", "4", "5", "6", "12", "13"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    // Subscribe to boards
    const unsubscribe = boardService.subscribeBoards((data) => {
      setBoards(data);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [user]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดกระดานส่งงาน...</p>
      </div>
    );
  }

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("กรุณากรอกหัวข้อกระดานส่งงาน");
      return;
    }

    setIsSubmitting(true);
    try {
      await boardService.addBoard(title.trim(), description.trim(), type, targetRoomsState);
      setTitle("");
      setDescription("");
      setType("individual");
      setTargetRoomsState(["2", "3", "4", "5", "6", "12", "13"]);
      setShowAddModal(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างกระดานส่งงาน";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Stop redirection link click
    e.stopPropagation();

    if (confirm("คุณครูต้องการลบกระดานส่งงานนี้ใช่หรือไม่? ข้อมูลงานของนักเรียนในกระดานนี้ทั้งหมดจะถูกลบออกด้วย และไม่สามารถย้อนกลับได้")) {
      try {
        await boardService.deleteBoard(id);
      } catch {
        alert("เกิดข้อผิดพลาดในการลบกระดานส่งงาน");
      }
    }
  };

  const isTeacher = user?.role === "teacher";
  
  const filteredBoards = boards.filter((board) => {
    if (isTeacher) return true;
    return !board.targetRooms || board.targetRooms.length === 0 || (user?.room && board.targetRooms.includes(user.room));
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <ClipboardList className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">ส่งงานและกิจกรรม</h1>
            <p className={styles.subtitle}>เลือกกระดานกิจกรรมเพื่อส่งชิ้นงาน แลกเปลี่ยนความเห็น หรือชื่นชมผลงานของเพื่อนๆ</p>
          </div>
        </div>

        {isTeacher && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={18} />
            <span>สร้างกระดานส่งงานใหม่</span>
          </button>
        )}
      </div>

      {filteredBoards.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ยังไม่มีกระดานส่งงานในขณะนี้</p>
          {isTeacher && <p className={styles.emptySub}>กดปุ่ม &quot;สร้างกระดานส่งงานใหม่&quot; ด้านบน เพื่อเริ่มสั่งงานแรก</p>}
        </div>
      ) : (
        <div className={styles.boardsGrid}>
          {filteredBoards.map((board) => (
            <Link key={board.id} href={`/padlet/${board.id}`} className={`${styles.boardCard} glass-card`}>
              <div className={styles.boardHeader}>
                <div className={styles.boardMeta}>
                  <Calendar size={14} className={styles.metaIcon} />
                  <span>{new Date(board.createdAt).toLocaleDateString("th-TH")}</span>
                </div>
                {isTeacher && (
                  <button 
                    onClick={(e) => handleDeleteBoard(e, board.id)}
                    className={styles.deleteBtn}
                    title="ลบกระดานส่งงาน"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className={styles.boardBadges}>
                <span className={`${styles.typeBadge} ${board.type === "group" ? styles.badgeGroup : styles.badgeIndiv}`}>
                  {board.type === "group" ? "งานกลุ่ม" : "งานเดี่ยว"}
                </span>
                {board.targetRooms && board.targetRooms.length > 0 && (
                  <span className={styles.roomBadge}>
                    ม.4/{board.targetRooms.join(", ")}
                  </span>
                )}
              </div>

              <h2 className={styles.boardTitle}>{board.title}</h2>
              <p className={styles.boardDesc}>{board.description || "คลิกเพื่อดูกระดานคำชี้แจงและส่งงาน"}</p>

              <div className={styles.boardFooter}>
                <span className={styles.enterText}>เข้าสู่บอร์ดส่งงาน</span>
                <ChevronRight size={16} className={styles.footerIcon} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Board Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>สร้างกระดานส่งงานใหม่</h3>
              <button onClick={() => setShowAddModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            {error && <div className={styles.modalError}>{error}</div>}

            <form onSubmit={handleCreateBoard} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>หัวข้อ / ชื่องาน</label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: ใบงานที่ 1.1 แนะนำตัวด้วยโปสเตอร์สุดปัง"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>คำสั่ง / คำชี้แจงในการส่งงาน</label>
                <textarea
                  placeholder="อธิบายรายละเอียด เช่น ให้นักเรียนแนบลิงก์ Canva พร้อมเขียนอธิบายผลงาน 3 บรรทัด..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>รูปแบบการส่งงาน</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="boardType"
                      value="individual"
                      checked={type === "individual"}
                      onChange={() => setType("individual")}
                      disabled={isSubmitting}
                    />
                    <span>งานเดี่ยว (ส่งแยกรายบุคคล)</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="boardType"
                      value="group"
                      checked={type === "group"}
                      onChange={() => setType("group")}
                      disabled={isSubmitting}
                    />
                    <span>งานกลุ่ม (ส่งตัวแทนกลุ่ม ระบุชื่อสมาชิก)</span>
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>ห้องเรียนที่มอบหมาย (ต้องส่งงานนี้)</label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "4px 0" }}>
                  {["2", "3", "4", "5", "6", "12", "13"].map((r) => {
                    const isChecked = targetRoomsState.includes(r);
                    return (
                      <label key={r} className={styles.checkboxLabel} style={{ marginTop: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetRoomsState(prev => [...prev, r]);
                            } else {
                              setTargetRoomsState(prev => prev.filter(x => x !== r));
                            }
                          }}
                          disabled={isSubmitting}
                        />
                        <span>ม.4/{r}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "กำลังสร้าง..." : "สร้างบอร์ด"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
