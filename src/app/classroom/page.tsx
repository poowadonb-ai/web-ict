"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  lessonService, 
  boardService, 
  submissionService, 
  Lesson, 
  AssignmentBoard, 
  Submission 
} from "@/lib/firebase";
import { getYouTubeEmbedUrl, getCanvaEmbedUrl } from "@/lib/utils";
import { 
  Plus, Trash2, Calendar, FileText, Video, ExternalLink, X, BookOpen, 
  ClipboardList, Users, Edit, UserPlus, Trash, ChevronRight 
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import AnnouncementBanner from "@/components/AnnouncementBanner";

export default function ClassroomPage() {
  const { user, loading } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [boards, setBoards] = useState<AssignmentBoard[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Lesson Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [canvaUrl, setCanvaUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [hasAssignment, setHasAssignment] = useState(false);
  const [assignmentType, setAssignmentType] = useState<"individual" | "group">("individual");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [targetRoomsState, setTargetRoomsState] = useState<string[]>(["2", "3", "4", "5", "6", "12", "13"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Student Submission Modal State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState("");
  const [activeBoardType, setActiveBoardType] = useState<"individual" | "group">("individual");
  const [subTitle, setSubTitle] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subLink, setSubLink] = useState("");
  const [groupMembers, setGroupMembers] = useState<{ name: string; room: string; studentNo: string }[]>([]);
  const [submittingWork, setSubmittingWork] = useState(false);
  const [subError, setSubError] = useState("");
  const [editingSubId, setEditingSubId] = useState(""); // For "ส่งกลับแก้ไข" case

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to lessons
    const unsubLessons = lessonService.subscribeLessons((data) => {
      setLessons(data);
    });

    // Subscribe to boards
    const unsubBoards = boardService.subscribeBoards((data) => {
      setBoards(data);
    });

    // Subscribe to all submissions
    const unsubSubs = submissionService.subscribeAllSubmissions((data) => {
      setSubmissions(data);
    });

    return () => {
      if (typeof unsubLessons === "function") unsubLessons();
      if (typeof unsubBoards === "function") unsubBoards();
      if (typeof unsubSubs === "function") unsubSubs();
    };
  }, [user]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดบทเรียน...</p>
      </div>
    );
  }

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("กรุณากรอกหัวข้อบทเรียน");
      return;
    }

    setIsSubmitting(true);
    try {
      await lessonService.addLesson(
        title.trim(),
        content.trim(),
        canvaUrl.trim(),
        youtubeUrl.trim(),
        hasAssignment,
        assignmentType,
        hasAssignment ? assignmentDescription.trim() : "",
        hasAssignment ? targetRoomsState : []
      );
      
      // Reset Form & Close Modal
      setTitle("");
      setContent("");
      setCanvaUrl("");
      setYoutubeUrl("");
      setHasAssignment(false);
      setAssignmentType("individual");
      setAssignmentDescription("");
      setTargetRoomsState(["2", "3", "4", "5", "6", "12", "13"]);
      setShowAddModal(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกบทเรียน";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    const confirmMsg = lesson.hasAssignment 
      ? "คุณครูต้องการลบบทเรียนนี้ใช่หรือไม่? กระดานส่งงานและข้อมูลการส่งงานของนักเรียนที่เชื่อมโยงอยู่จะถูกลบไปด้วย!" 
      : "คุณครูต้องการลบบทเรียนนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้";
    
    if (confirm(confirmMsg)) {
      try {
        await lessonService.deleteLesson(lesson.id);
        if (lesson.hasAssignment && lesson.assignmentId) {
          await boardService.deleteBoard(lesson.assignmentId);
        }
      } catch {
        alert("เกิดข้อผิดพลาดในการลบบทเรียน");
      }
    }
  };

  const handleOpenSubmitModal = (boardId: string, type: "individual" | "group", previousSub?: Submission) => {
    setActiveBoardId(boardId);
    setActiveBoardType(type);
    setSubError("");
    
    if (previousSub) {
      // Load previous submission details for editing
      setSubTitle(previousSub.title);
      setSubDesc(previousSub.description);
      setSubLink(previousSub.linkUrl);
      setEditingSubId(previousSub.id);
      if (previousSub.isGroup && previousSub.members) {
        setGroupMembers(previousSub.members);
      } else {
        setGroupMembers([{ name: user?.fullName || "", room: user?.room || "1", studentNo: user?.studentNo || "" }]);
      }
    } else {
      // Clear for new submission
      setSubTitle("");
      setSubDesc("");
      setSubLink("");
      setEditingSubId("");
      setGroupMembers([{ name: user?.fullName || "", room: user?.room || "1", studentNo: user?.studentNo || "" }]);
    }
    setShowSubmitModal(true);
  };

  const handleAddMemberRow = () => {
    setGroupMembers(prev => [...prev, { name: "", room: "1", studentNo: "" }]);
  };

  const handleRemoveMemberRow = (index: number) => {
    if (index === 0) return; // Cannot remove the first member (submitter)
    setGroupMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMember = (index: number, field: "name" | "room" | "studentNo", value: string) => {
    setGroupMembers(prev => prev.map((member, i) => {
      if (i === index) {
        return { ...member, [field]: value };
      }
      return member;
    }));
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError("");

    if (!subTitle.trim()) {
      setSubError("กรุณากรอกหัวข้องานที่ส่ง");
      return;
    }
    if (!subLink.trim()) {
      setSubError("กรุณาแนบลิงก์ส่งงาน");
      return;
    }

    if (activeBoardType === "group") {
      // Validate members
      for (let i = 0; i < groupMembers.length; i++) {
        const m = groupMembers[i];
        if (!m.name.trim()) {
          setSubError(`กรุณากรอกชื่อสมาชิกคนที่ ${i + 1}`);
          return;
        }
        if (!m.studentNo.trim() || isNaN(Number(m.studentNo)) || Number(m.studentNo) <= 0) {
          setSubError(`กรุณากรอกเลขที่ของคนที่ ${i + 1} ให้ถูกต้อง`);
          return;
        }
      }
    }

    setSubmittingWork(true);
    try {
      if (editingSubId) {
        // Delete previous submission first
        await submissionService.deleteSubmission(editingSubId);
      }
      
      await submissionService.addSubmission(
        activeBoardId,
        subTitle.trim(),
        subDesc.trim(),
        subLink.trim(),
        activeBoardType === "group",
        activeBoardType === "group" ? groupMembers : []
      );

      setShowSubmitModal(false);
      setSubTitle("");
      setSubDesc("");
      setSubLink("");
      setEditingSubId("");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งงาน";
      setSubError(errMsg);
    } finally {
      setSubmittingWork(false);
    }
  };

  const isTeacher = user?.role === "teacher";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <BookOpen className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">แหล่งเรียนรู้ออนไลน์</h1>
            <p className={styles.subtitle}>ศึกษาบทเรียน สื่อการสอน Canva และวิดีโอจากครูผู้สอนได้ที่นี่</p>
          </div>
        </div>

        {isTeacher && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={18} />
            <span>สร้างบทเรียนใหม่</span>
          </button>
        )}
      </div>

      <AnnouncementBanner />

      {lessons.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ยังไม่มีบทเรียนในขณะนี้</p>
          {isTeacher && <p className={styles.emptySub}>กดปุ่ม &quot;สร้างบทเรียนใหม่&quot; ด้านบน เพื่อเริ่มสร้างบทเรียนแรกของคุณครู</p>}
        </div>
      ) : (
        <div className={styles.lessonList}>
          {lessons.map((lesson) => {
            const ytEmbed = getYouTubeEmbedUrl(lesson.youtubeUrl);
            const canvaEmbed = getCanvaEmbedUrl(lesson.canvaUrl);
            const isShortLink = lesson.canvaUrl && lesson.canvaUrl.includes("canva.link");

            // Board and Submission checking
            const linkedBoard = boards.find(b => b.id === lesson.assignmentId);
            const isLocked = linkedBoard?.isLocked;
            const boardSubmissions = submissions.filter(s => s.boardId === lesson.assignmentId);
            
            const studentSubmission = boardSubmissions.find(s => {
              if (!user) return false;
              if (s.uid === user.uid) return true;
              if (s.isGroup && s.members) {
                return s.members.some(m => m.room === user.room && m.studentNo === user.studentNo);
              }
              return false;
            });

            const isTargeted = isTeacher || !lesson.targetRooms || lesson.targetRooms.length === 0 || (user?.room && lesson.targetRooms.includes(user.room));

            return (
              <article key={lesson.id} className={`${styles.lessonCard} glass-container`}>
                <header className={styles.cardHeader}>
                  <div className={styles.cardMeta}>
                    <Calendar size={14} className={styles.metaIcon} />
                    <span>{new Date(lesson.createdAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })} น.</span>
                  </div>
                  {isTeacher && (
                    <button 
                      onClick={() => handleDeleteLesson(lesson)} 
                      className={styles.deleteBtn}
                      title="ลบบทเรียน"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </header>

                <h2 className={styles.lessonTitle}>{lesson.title}</h2>
                <p className={styles.lessonContent}>{lesson.content}</p>

                {isShortLink && (
                  <div style={{ margin: "12px 0", padding: "16px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: "0.85rem", lineHeight: "1.5" }}>
                    <p style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#f87171" }}>⚠️ ตรวจพบลิงก์ย่อ (canva.link) ซึ่งไม่สามารถเปิดพรีวิวได้โดยตรง</p>
                    <p style={{ marginTop: "6px" }}>เนื่องจาก Canva บล็อกไม่ให้ดึงลิงก์สั้น `canva.link` มาแสดงในหน้าเว็บโดยตรงเพื่อความปลอดภัย</p>
                    <p style={{ marginTop: "8px" }}>👉 **วิธีแก้ไขง่ายๆ ใน 3 ขั้นตอน:**</p>
                    <ol style={{ paddingLeft: "20px", marginTop: "4px" }}>
                      <li><a href={lesson.canvaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "#38bdf8", fontWeight: "bold" }}>คลิกที่นี่เพื่อเปิดลิงก์สไลด์ของคุณครูในแท็บใหม่</a></li>
                      <li>คัดลอกลิงก์แบบยาวทั้งหมดจากช่องที่อยู่เบราว์เซอร์ด้านบน (ซึ่งจะขึ้นต้นด้วย <code>https://www.canva.com/design/...</code>)</li>
                      <li>นำลิงก์ยาวที่คัดลอกมานั้น มาสร้างบทเรียนใหม่อีกครั้งครับ!</li>
                    </ol>
                  </div>
                )}

                {/* Media Grid */}
                <div className={styles.mediaContainer}>
                  {canvaEmbed && (
                    <div className={styles.mediaWrapper}>
                      <div className={styles.mediaLabel}>
                        <FileText size={16} />
                        <span>สไลด์บทเรียน Canva</span>
                      </div>
                      <div className="canva-wrapper">
                        <iframe 
                          src={canvaEmbed} 
                          allowFullScreen 
                          allow="fullscreen"
                        ></iframe>
                      </div>
                      <a 
                        href={lesson.canvaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={styles.openExternal}
                      >
                        <span>เปิดสไลด์ในหน้าใหม่</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}

                  {ytEmbed && (
                    <div className={styles.mediaWrapper}>
                      <div className={styles.mediaLabel}>
                        <Video size={16} />
                        <span>วิดีโอประกอบการเรียนรู้</span>
                      </div>
                      <div className={styles.videoWrapper}>
                        <iframe
                          src={ytEmbed}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>
                    </div>
                  )}
                </div>

                {/* Integrated Assignment Section */}
                {lesson.hasAssignment && lesson.assignmentId && isTargeted && (
                  <div className={styles.assignmentSection}>
                    <div className={styles.assignmentHeader}>
                      <h4 className={styles.assignmentTitle}>
                        <ClipboardList size={18} style={{ color: "var(--accent-cyan)" }} />
                        <span>งานกิจกรรม: {linkedBoard ? linkedBoard.title : `ส่งงานประจำบทเรียน`}</span>
                      </h4>
                      <div className={styles.assignmentBadges}>
                        <span className={`${styles.badgeType} ${lesson.assignmentType === "group" ? styles.badgeGroup : styles.badgeIndividual}`}>
                          {lesson.assignmentType === "group" ? (
                            <>
                              <Users size={12} style={{ display: "inline", marginRight: "4px" }} />
                              งานกลุ่ม
                            </>
                          ) : (
                            "งานเดี่ยว"
                          )}
                        </span>

                        {/* Submission status badge */}
                        {studentSubmission ? (
                          studentSubmission.status === "graded" ? (
                            <span className={`${styles.badgeType} ${styles.badgeStatusGraded}`}>
                              ตรวจแล้ว
                            </span>
                          ) : studentSubmission.status === "resubmit" ? (
                            <span className={`${styles.badgeType} ${styles.badgeStatusResubmit}`}>
                              ส่งกลับแก้ไข
                            </span>
                          ) : (
                            <span className={`${styles.badgeType} ${styles.badgeStatusPending}`}>
                              ส่งแล้ว (รอตรวจ)
                            </span>
                          )
                        ) : isLocked ? (
                          <span className={`${styles.badgeType} ${styles.badgeStatusClosed}`}>
                            ปิดรับงานแล้ว
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isTeacher && lesson.targetRooms && lesson.targetRooms.length > 0 && (
                      <div style={{ fontSize: "0.82rem", color: "var(--accent-cyan)", margin: "0 0 8px 0", fontWeight: 600 }}>
                        📢 มอบหมายห้อง: {lesson.targetRooms.map(r => `ม.4/${r}`).join(", ")}
                      </div>
                    )}

                    <p className={styles.assignmentDesc}>
                      {linkedBoard?.description || "คำชี้แจง: แนบลิงก์ชิ้นงานผลงาน Canva หรือเว็บไซต์ของคุณ"}
                    </p>

                    {/* Teacher Resubmit Comment */}
                    {studentSubmission && studentSubmission.status === "resubmit" && studentSubmission.teacherFeedback && (
                      <div className={styles.feedbackAlert}>
                        <div className={styles.feedbackTitle}>⚠️ ข้อเสนอแนะจากคุณครูให้แก้ไข:</div>
                        <p>{studentSubmission.teacherFeedback}</p>
                      </div>
                    )}

                    <div className={styles.assignmentActions}>
                      {/* Submission button */}
                      {studentSubmission ? (
                        <>
                          <Link href={`/padlet/${lesson.assignmentId}`} className="btn-secondary">
                            <span>ดูผลงานบนกระดาน ({boardSubmissions.length} งาน)</span>
                            <ChevronRight size={14} />
                          </Link>

                          {studentSubmission.status === "resubmit" && !isLocked && (
                            <button 
                              onClick={() => handleOpenSubmitModal(lesson.assignmentId!, lesson.assignmentType || "individual", studentSubmission)}
                              className="btn-primary"
                            >
                              <Edit size={16} />
                              <span>แก้ไขและส่งใหม่</span>
                            </button>
                          )}
                        </>
                      ) : isLocked ? (
                        <button className="btn-secondary" disabled>
                          ปิดรับการส่งงานแล้ว
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleOpenSubmitModal(lesson.assignmentId!, lesson.assignmentType || "individual")} 
                            className="btn-primary"
                          >
                            <Plus size={16} />
                            <span>{lesson.assignmentType === "group" ? "ส่งงานกลุ่ม" : "ส่งงานเดี่ยว"}</span>
                          </button>
                          <Link href={`/padlet/${lesson.assignmentId}`} className="btn-secondary">
                            <span>ดูกระดานส่งงาน ({boardSubmissions.length})</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Add Lesson Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>สร้างบทเรียนใหม่</h3>
              <button onClick={() => setShowAddModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            {error && <div className={styles.modalError}>{error}</div>}

            <form onSubmit={handleAddLesson} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>หัวข้อบทเรียน</label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: หน่วยการเรียนรู้ที่ 1 การใช้งานโปรแกรม Canva เบื้องต้น"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>รายละเอียด / เนื้อหาบทเรียน</label>
                <textarea
                  placeholder="เขียนคำแนะนำ คำอธิบาย หรือรายละเอียดเพิ่มเติมให้นักเรียนทราบ..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>ลิงก์สไลด์นำเสนอ Canva</label>
                <input
                  type="url"
                  placeholder="วางลิงก์นำเสนอ Canva หรือลิงก์แชร์ดูงานได้ที่นี่"
                  value={canvaUrl}
                  onChange={(e) => setCanvaUrl(e.target.value)}
                  disabled={isSubmitting}
                />
                <span className={styles.inputTip}>ตัวอย่าง: https://www.canva.com/design/.../view</span>
              </div>

              <div className={styles.formGroup}>
                <label>ลิงก์วิดีโอประกอบการสอน YouTube</label>
                <input
                  type="url"
                  placeholder="วางลิงก์แชร์ YouTube หรือลิงก์วิดีโอได้ที่นี่"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isSubmitting}
                />
                <span className={styles.inputTip}>ตัวอย่าง: https://www.youtube.com/watch?v=xxx หรือ https://youtu.be/xxx</span>
              </div>

              {/* Assignment linkages */}
              <div className={styles.formGroup} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={hasAssignment}
                    onChange={(e) => setHasAssignment(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <span>ต้องการแนบการส่งงานในบทเรียนนี้ (สร้างบอร์ด Padlet อัตโนมัติ)</span>
                </label>
              </div>

              {hasAssignment && (
                <>
                  <div className={styles.formGroup}>
                    <label>รูปแบบการทำงาน</label>
                    <select
                      value={assignmentType}
                      onChange={(e) => setAssignmentType(e.target.value as "individual" | "group")}
                      disabled={isSubmitting}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "12px 16px",
                        color: "white"
                      }}
                    >
                      <option value="individual">งานเดี่ยว</option>
                      <option value="group">งานกลุ่ม</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>คำสั่ง / คำชี้แจงในการสั่งงาน</label>
                    <textarea
                      placeholder="เช่น ออกแบบโปสเตอร์แนะนำตัวตามเงื่อนไขที่กำหนด แล้วแนบลิงก์ Canva..."
                      value={assignmentDescription}
                      onChange={(e) => setAssignmentDescription(e.target.value)}
                      rows={3}
                      disabled={isSubmitting}
                    />
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
                </>
              )}

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
                  {isSubmitting ? "กำลังบันทึก..." : "โพสบทเรียน"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Student Submit Assignment Modal */}
      {showSubmitModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>{editingSubId ? "แก้ไขและส่งงานใหม่" : "ส่งชิ้นงานของตนเอง"}</h3>
              <button onClick={() => setShowSubmitModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            {subError && <div className={styles.modalError}>{subError}</div>}

            <form onSubmit={handleSubmitWork} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>หัวข้อชิ้นงาน</label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: โปสเตอร์แนะนำตัวเองของกลุ่ม 1 หรือ โปสเตอร์สมชาย"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  required
                  disabled={submittingWork}
                />
              </div>

              <div className={styles.formGroup}>
                <label>คำอธิบายเพิ่มเติม / แนวคิด</label>
                <textarea
                  placeholder="อธิบายรายละเอียดผลงานสั้นๆ เพื่อให้ครูตรวจ..."
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  rows={2}
                  disabled={submittingWork}
                />
              </div>

              <div className={styles.formGroup}>
                <label>แนบลิงก์ผลงาน (Canva / อื่นๆ)</label>
                <input
                  type="url"
                  placeholder="วางลิงก์ https://www.canva.com/design/..."
                  value={subLink}
                  onChange={(e) => setSubLink(e.target.value)}
                  required
                  disabled={submittingWork}
                />
              </div>

              {/* Group members registry */}
              {activeBoardType === "group" && (
                <div className={styles.membersRegistry}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h5 className={styles.registryTitle}>รายชื่อสมาชิกกลุ่ม (เฉพาะ ม.4)</h5>
                    <button 
                      type="button" 
                      onClick={handleAddMemberRow} 
                      className="btn-secondary" 
                      style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                      disabled={submittingWork}
                    >
                      <UserPlus size={14} style={{ marginRight: "4px" }} />
                      เพิ่มสมาชิก
                    </button>
                  </div>

                  {groupMembers.map((member, index) => (
                    <div key={index} className={styles.memberRow}>
                      <input
                        type="text"
                        placeholder="ชื่อ-นามสกุลสมาชิก"
                        value={member.name}
                        onChange={(e) => handleUpdateMember(index, "name", e.target.value)}
                        required
                        disabled={submittingWork || index === 0} // Row 0 is pre-filled user
                      />
                      <select
                        value={member.room}
                        onChange={(e) => handleUpdateMember(index, "room", e.target.value)}
                        disabled={submittingWork || index === 0}
                      >
                        {[...Array(12)].map((_, i) => (
                          <option key={i + 1} value={String(i + 1)}>
                            ห้อง {i + 1}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="เลขที่"
                        min="1"
                        max="60"
                        value={member.studentNo}
                        onChange={(e) => handleUpdateMember(index, "studentNo", e.target.value)}
                        required
                        disabled={submittingWork || index === 0}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberRow(index)}
                        className={styles.removeRowBtn}
                        disabled={submittingWork || index === 0}
                        title="ลบสมาชิก"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowSubmitModal(false)} 
                  className="btn-secondary"
                  disabled={submittingWork}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submittingWork}
                >
                  {submittingWork ? "กำลังส่งงาน..." : "ส่งงาน"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
