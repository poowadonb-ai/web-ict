"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { boardService, submissionService } from "@/lib/supabase";
import { AssignmentBoard, Submission } from "@/lib/types";
import { getCanvaEmbedUrl, getYouTubeEmbedUrl, resolveCanvaUrlIfNeeded } from "@/lib/utils";
import { 
  ArrowLeft, Plus, Heart, MessageSquare, Send, Trash2, 
  ExternalLink, User, FileText, Video, X, Lock, Unlock, Edit3, UserPlus, Users,
  Filter, Clock, CheckCircle2, AlertTriangle, RefreshCw
} from "lucide-react";
import styles from "./page.module.css";

export default function PadletBoardPage() {
  const { id } = useParams();
  const boardId = id as string;
  const router = useRouter();
  const { user, loading } = useAuth();

  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Submission Form State
  const [subTitle, setSubTitle] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subLink, setSubLink] = useState("");
  const [groupMembers, setGroupMembers] = useState<{ name: string; room: string; studentNo: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingSubId, setEditingSubId] = useState(""); // For resubmission

  // Comments Section Expand State
  const [expandedComments, setExpandedComments] = useState<{ [subId: string]: boolean }>({});
  const [commentInputs, setCommentInputs] = useState<{ [subId: string]: string }>({});

  // Grading Modal State (Teacher Only)
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradingSubId, setGradingSubId] = useState("");
  const [gradeScore, setGradeScore] = useState("");
  const [gradeMaxScore, setGradeMaxScore] = useState("10");
  const [gradeStatus, setGradeStatus] = useState<"graded" | "resubmit">("graded");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [awardPack, setAwardPack] = useState(true);
  const [isGradingSubmitting, setIsGradingSubmitting] = useState(false);

  // Bulk Grading Modal State
  const [showBulkGradeModal, setShowBulkGradeModal] = useState(false);
  const [bulkGradeScope, setBulkGradeScope] = useState<"pending" | "all">("pending");
  const [bulkGradeScore, setBulkGradeScore] = useState("");
  const [bulkGradeMaxScore, setBulkGradeMaxScore] = useState("10");
  const [bulkGradeStatus, setBulkGradeStatus] = useState<"graded" | "resubmit">("graded");
  const [bulkGradeFeedback, setBulkGradeFeedback] = useState("");
  const [bulkAwardPack, setBulkAwardPack] = useState(true);
  const [isBulkGradingSubmitting, setIsBulkGradingSubmitting] = useState(false);

  // Filters State
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Extract room number from gradeClass (e.g. "ม.4/3" -> "3")
  const getRoomFromGradeClass = (gradeClass: string): string => {
    if (!gradeClass) return "";
    const parts = gradeClass.split("/");
    if (parts.length > 1) {
      return parts[1];
    }
    return "";
  };

  // Get all unique room numbers from a submission (including group members)
  const getSubmissionRooms = (sub: Submission): string[] => {
    const rooms: string[] = [];
    const primaryRoom = getRoomFromGradeClass(sub.gradeClass);
    if (primaryRoom) rooms.push(primaryRoom);
    
    if (sub.isGroup && sub.members) {
      sub.members.forEach(m => {
        if (m.room && !rooms.includes(String(m.room))) {
          rooms.push(String(m.room));
        }
      });
    }
    return rooms;
  };

  useEffect(() => {
    if (!user || !boardId) return;

    // Fetch board info
    const unsubBoards = boardService.subscribeBoards((boards) => {
      const activeBoard = boards.find(b => b.id === boardId);
      if (activeBoard) {
        setBoard(activeBoard);
      }
    });

    // Subscribe to submissions
    const unsubSubmissions = submissionService.subscribeSubmissions(boardId, (data) => {
      setSubmissions(data);
    });

    return () => {
      if (typeof unsubBoards === "function") unsubBoards();
      if (typeof unsubSubmissions === "function") unsubSubmissions();
    };
  }, [user, boardId]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดกระดานส่งงาน...</p>
      </div>
    );
  }

  const handleToggleLock = async () => {
    if (!board) return;
    try {
      const newLockStatus = !board.isLocked;
      await boardService.toggleLockBoard(boardId, newLockStatus);
      // Local state is updated by subscription, but update manually just in case
      setBoard(prev => prev ? { ...prev, isLocked: newLockStatus } : null);
    } catch {
      alert("เกิดข้อผิดพลาดในการตั้งค่าปิดรับงาน");
    }
  };

  const handleOpenSubmitModal = (previousSub?: Submission) => {
    setError("");
    if (previousSub) {
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
    if (index === 0) return;
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
    setError("");

    if (!subTitle.trim()) {
      setError("กรุณากรอกหัวข้องานที่ส่ง");
      return;
    }
    if (!subLink.trim()) {
      setError("กรุณาแนบลิงก์ส่งงาน");
      return;
    }

    if (board?.type === "group") {
      // Validate members
      for (let i = 0; i < groupMembers.length; i++) {
        const m = groupMembers[i];
        if (!m.name.trim()) {
          setError(`กรุณากรอกชื่อสมาชิกคนที่ ${i + 1}`);
          return;
        }
        if (!m.studentNo.trim() || isNaN(Number(m.studentNo)) || Number(m.studentNo) <= 0) {
          setError(`กรุณากรอกเลขที่ของคนที่ ${i + 1} ให้ถูกต้อง`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const resolvedLink = await resolveCanvaUrlIfNeeded(subLink.trim());
      if (editingSubId) {
        // Delete the previous submission first to update it cleanly
        await submissionService.deleteSubmission(editingSubId);
      }

      await submissionService.addSubmission(
        boardId,
        subTitle.trim(),
        subDesc.trim(),
        resolvedLink,
        board?.type === "group",
        board?.type === "group" ? groupMembers : []
      );
      
      setSubTitle("");
      setSubDesc("");
      setSubLink("");
      setEditingSubId("");
      setShowSubmitModal(false);
      window.location.reload();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งงาน";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmission = async (subId: string) => {
    if (confirm("คุณต้องการลบงานนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      try {
        await submissionService.deleteSubmission(subId);
        window.location.reload();
      } catch {
        alert("เกิดข้อผิดพลาดในการลบงาน");
      }
    }
  };

  const handleToggleLike = async (subId: string) => {
    try {
      await submissionService.toggleLike(subId);
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handleAddComment = async (subId: string) => {
    const text = commentInputs[subId] || "";
    if (!text.trim()) return;

    try {
      await submissionService.addComment(subId, text.trim());
      setCommentInputs(prev => ({ ...prev, [subId]: "" }));
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const toggleCommentsView = (subId: string) => {
    setExpandedComments(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  const handleOpenGradeModal = (sub: Submission) => {
    setGradingSubId(sub.id);
    setGradeScore(sub.score !== undefined ? String(sub.score) : "");
    setGradeMaxScore(sub.maxScore !== undefined ? String(sub.maxScore) : "10");
    setGradeStatus(sub.status === "resubmit" ? "resubmit" : "graded");
    setGradeFeedback(sub.teacherFeedback || "");
    setAwardPack(true);
    setShowGradeModal(true);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubId) return;

    const scoreNum = Number(gradeScore);
    const maxScoreNum = Number(gradeMaxScore);

    if (isNaN(scoreNum) || scoreNum < 0) {
      alert("กรุณากรอกคะแนนที่ถูกต้อง");
      return;
    }
    if (isNaN(maxScoreNum) || maxScoreNum <= 0 || scoreNum > maxScoreNum) {
      alert("กรุณากรอกคะแนนเต็มให้ถูกต้อง และคะแนนที่ได้ต้องไม่เกินคะแนนเต็ม");
      return;
    }

    setIsGradingSubmitting(true);
    try {
      await submissionService.gradeSubmission(
        gradingSubId,
        scoreNum,
        maxScoreNum,
        gradeStatus,
        gradeFeedback.trim(),
        awardPack
      );
      setShowGradeModal(false);
      window.location.reload();
    } catch {
      alert("เกิดข้อผิดพลาดในการบันทึกการประเมิน");
    } finally {
      setIsGradingSubmitting(false);
    }
  };

  const handleSaveBulkGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId) return;

    const scoreNum = Number(bulkGradeScore);
    const maxScoreNum = Number(bulkGradeMaxScore);

    if (isNaN(scoreNum) || scoreNum < 0) {
      alert("กรุณากรอกคะแนนที่ถูกต้อง");
      return;
    }
    if (isNaN(maxScoreNum) || maxScoreNum <= 0 || scoreNum > maxScoreNum) {
      alert("กรุณากรอกคะแนนเต็มให้ถูกต้อง และคะแนนที่ได้ต้องไม่เกินคะแนนเต็ม");
      return;
    }

    setIsBulkGradingSubmitting(true);
    try {
      await submissionService.gradeAllSubmissions(
        boardId,
        scoreNum,
        maxScoreNum,
        bulkGradeStatus,
        bulkGradeFeedback.trim(),
        bulkAwardPack,
        bulkGradeScope === "pending"
      );
      setShowBulkGradeModal(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกการประเมินทั้งหมด");
    } finally {
      setIsBulkGradingSubmitting(false);
    }
  };

  // Dynamically extract unique rooms from submissions
  const roomsInSubmissions = Array.from(
    new Set(
      submissions.flatMap(getSubmissionRooms)
    )
  ).filter(Boolean);

  // Combine targetRooms and rooms present in submissions
  const availableRooms = Array.from(
    new Set([
      ...(board?.targetRooms || []),
      ...roomsInSubmissions
    ])
  ).sort((a, b) => Number(a) - Number(b));

  // Filter submissions based on user selection
  const filteredSubmissions = submissions.filter(sub => {
    // 1. Room filter
    let matchesRoom = true;
    if (selectedRoom !== "all") {
      const subRoom = getRoomFromGradeClass(sub.gradeClass);
      if (sub.isGroup && sub.members) {
        const memberRooms = sub.members.map(m => String(m.room));
        matchesRoom = subRoom === selectedRoom || memberRooms.includes(selectedRoom);
      } else {
        matchesRoom = subRoom === selectedRoom;
      }
    }

    // 2. Status filter
    let matchesStatus = true;
    if (selectedStatus !== "all") {
      if (selectedStatus === "graded") {
        matchesStatus = sub.status === "graded";
      } else if (selectedStatus === "pending") {
        matchesStatus = sub.status === "pending" || !sub.status;
      } else if (selectedStatus === "resubmit") {
        matchesStatus = sub.status === "resubmit";
      }
    }

    return matchesRoom && matchesStatus;
  });

  const isTeacher = user?.role === "teacher";
  const isLocked = board?.isLocked;

  const getQuickScores = () => {
    const maxVal = Number(gradeMaxScore);
    if (isNaN(maxVal) || maxVal <= 0) return [];
    
    if (maxVal === 10) {
      return [10, 9, 8, 7, 6, 5];
    }
    if (maxVal === 20) {
      return [20, 19, 18, 17, 16, 15];
    }
    
    // Fallback for other max scores
    const options = [];
    for (let i = 0; i <= 5; i++) {
      const val = maxVal - i;
      if (val >= 0) options.push(val);
    }
    return options;
  };

  // Find user's active submission
  const studentSubmission = submissions.find(s => {
    if (!user) return false;
    if (s.uid === user.uid) return true;
    if (s.isGroup && s.members) {
      return s.members.some(m => m.room === user.room && m.studentNo === user.studentNo);
    }
    return false;
  });

  const isTargeted = isTeacher || !board || !board.targetRooms || board.targetRooms.length === 0 || (user?.room && board.targetRooms.includes(user.room));

  if (board && !isTargeted) {
    return (
      <div className={styles.container}>
        <div className={`${styles.emptyState} glass-container`} style={{ maxWidth: "600px", margin: "40px auto" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <X size={48} style={{ color: "#ef4444", filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))" }} />
          </div>
          <h2 style={{ color: "white", fontSize: "1.5rem", marginTop: "12px" }}>ไม่มีสิทธิ์เข้าถึงบอร์ดส่งงานนี้</h2>
          <p className={styles.emptySub} style={{ margin: "8px 0 20px" }}>
            บอร์ดส่งงานนี้กำหนดให้ส่งเฉพาะห้อง ม.4/{board.targetRooms?.join(", ม.4/")} เท่านั้น (ห้องเรียนของคุณคือ ม.4/{user?.room})
          </p>
          <button onClick={() => router.push("/padlet")} className="btn-primary" style={{ alignSelf: "center" }}>
            กลับไปยังกระดานส่งงานทั้งหมด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.push("/padlet")} className={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>กลับไปยังกระดานส่งงานทั้งหมด</span>
        </button>

        {board && (
          <div className={styles.boardHeaderArea}>
            <div className={styles.boardDetail}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 className="gradient-text">{board.title}</h1>
                <span className={`${styles.badgeType} ${board.type === "group" ? styles.badgeGroup : styles.badgeIndividual}`}>
                  {board.type === "group" ? "งานกลุ่ม" : "งานเดี่ยว"}
                </span>
                {isLocked && (
                  <span className={`${styles.badgeType} ${styles.badgeStatusResubmit}`}>
                    ปิดรับงานแล้ว
                  </span>
                )}
              </div>
              <p className={styles.boardDesc}>{board.description}</p>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {isTeacher && (
                <>
                  <button 
                    onClick={handleToggleLock} 
                    className={`${styles.lockBtn} ${isLocked ? styles.btnLocked : styles.btnUnlocked}`}
                  >
                    {isLocked ? (
                      <>
                        <Lock size={16} />
                        <span>ปิดรับส่งงานอยู่ (คลิกเปิดบอร์ด)</span>
                      </>
                    ) : (
                      <>
                        <Unlock size={16} />
                        <span>เปิดรับส่งงานอยู่ (คลิกปิดบอร์ด)</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setBulkGradeScore("");
                      setBulkGradeMaxScore("10");
                      setBulkGradeStatus("graded");
                      setBulkGradeFeedback("");
                      setBulkAwardPack(true);
                      setBulkGradeScope("pending");
                      setShowBulkGradeModal(true);
                    }}
                    className={styles.bulkGradeBtn}
                  >
                    <Edit3 size={16} />
                    <span>ตรวจให้คะแนนทั้งหมด</span>
                  </button>
                </>
              )}

              {/* Submitting button logic */}
              {studentSubmission ? (
                studentSubmission.status === "resubmit" && !isLocked ? (
                  <button 
                    onClick={() => handleOpenSubmitModal(studentSubmission)} 
                    className="btn-primary"
                  >
                    <Edit3 size={18} />
                    <span>แก้ไขและส่งใหม่</span>
                  </button>
                ) : (
                  <button className="btn-secondary" disabled>
                    ส่งงานเรียบร้อยแล้ว
                  </button>
                )
              ) : isLocked ? (
                <button className="btn-secondary" disabled>
                  ปิดรับงานชิ้นนี้แล้ว
                </button>
              ) : (
                <button onClick={() => handleOpenSubmitModal()} className="btn-primary">
                  <Plus size={18} />
                  <span>{board?.type === "group" ? "ส่งงานกลุ่ม" : "ส่งชิ้นงานของฉัน"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Filter Bar */}
      {submissions.length > 0 && (
        <div className={`${styles.filterBar} glass-container`}>
          <div className={styles.filterSection}>
            {/* Room Filter Dropdown */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabelArea}>
                <Filter size={16} className={styles.filterIcon} />
                <span className={styles.filterLabel}>ห้องเรียน</span>
              </div>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">ทุกห้องเรียน</option>
                {availableRooms.map(room => (
                  <option key={room} value={room}>
                    ห้อง ม.4/{room}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Buttons */}
            <div className={styles.filterGroup}>
              <div className={styles.filterLabelArea}>
                <span className={styles.filterLabel}>สถานะตรวจงาน</span>
              </div>
              <div className={styles.statusFilters}>
                <button
                  type="button"
                  onClick={() => setSelectedStatus("all")}
                  className={`${styles.filterBtn} ${selectedStatus === "all" ? styles.filterBtnActive : ""}`}
                >
                  ทั้งหมด ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus("pending")}
                  className={`${styles.filterBtn} ${selectedStatus === "pending" ? styles.filterBtnActive : ""} ${styles.statusPendingBtn}`}
                >
                  <Clock size={14} />
                  <span>ยังไม่ตรวจ ({submissions.filter(s => s.status === "pending" || !s.status).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus("graded")}
                  className={`${styles.filterBtn} ${selectedStatus === "graded" ? styles.filterBtnActive : ""} ${styles.statusGradedBtn}`}
                >
                  <CheckCircle2 size={14} />
                  <span>ตรวจแล้ว ({submissions.filter(s => s.status === "graded").length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus("resubmit")}
                  className={`${styles.filterBtn} ${selectedStatus === "resubmit" ? styles.filterBtnActive : ""} ${styles.statusResubmitBtn}`}
                >
                  <AlertTriangle size={14} />
                  <span>ส่งกลับแก้ไข ({submissions.filter(s => s.status === "resubmit").length})</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className={styles.filterSummary}>
            พบ {filteredSubmissions.length} งาน จากทั้งหมด {submissions.length} งาน
          </div>
        </div>
      )}

      {/* Grid of Submissions */}
      {submissions.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ยังไม่มีการส่งชิ้นงานในกระดานนี้</p>
          <p className={styles.emptySub}>เป็นคนแรกที่ส่งชิ้นงานโดยคลิกที่ปุ่มส่งงานด้านบน</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <p>ไม่พบชิ้นงานที่ตรงกับตัวกรองห้องเรียน หรือสถานะการตรวจที่เลือก</p>
          <p className={styles.emptySub}>ลองปรับเปลี่ยนหรือรีเซ็ตตัวกรองเพื่อเรียกดูข้อมูลอื่น</p>
          <button 
            onClick={() => { setSelectedRoom("all"); setSelectedStatus("all"); }} 
            className="btn-secondary"
            style={{ alignSelf: "center", marginTop: "12px", display: "flex", gap: "6px", alignItems: "center" }}
          >
            <RefreshCw size={14} />
            <span>รีเซ็ตตัวกรอง</span>
          </button>
        </div>
      ) : (
        <div className={styles.padletGrid}>
          {filteredSubmissions.map((sub) => {
            const hasLiked = user ? sub.likes.includes(user.uid) : false;
            const canvaEmbed = getCanvaEmbedUrl(sub.linkUrl);
            const ytEmbed = getYouTubeEmbedUrl(sub.linkUrl);
            const isOwner = user?.uid === sub.uid;
            
            // Check if user is a member of this group submission
            const isGroupMember = sub.isGroup && sub.members && user && sub.members.some(
              m => m.room === user.room && m.studentNo === user.studentNo
            );

            return (
              <div key={sub.id} className={`${styles.padletCard} glass-container`}>
                <header className={styles.cardHeader}>
                  <div className={styles.authorInfo}>
                    <div className={styles.authorAvatar}>
                      {sub.isGroup ? <Users size={14} /> : <User size={14} />}
                    </div>
                    <div>
                      <h4 className={styles.authorName}>{sub.studentName}</h4>
                      <div className={styles.authorMeta}>
                        <span className={styles.gradeClass}>{sub.gradeClass}</span>
                        {!sub.isGroup && sub.studentNo && <span className={styles.studentNo}>เลขที่ {sub.studentNo}</span>}
                        {sub.isGroup && <span className={styles.studentNo} style={{color: "var(--accent-purple)"}}>ส่งแบบกลุ่ม</span>}
                      </div>
                    </div>
                  </div>
                  {(isOwner || isTeacher) && (
                    <button 
                      onClick={() => handleDeleteSubmission(sub.id)}
                      className={styles.deleteBtn}
                      title="ลบโพสนี้"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </header>

                <div className={styles.cardBody}>
                  {/* Status tags */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {sub.status === "graded" ? (
                      <span className={`${styles.badgeType} ${styles.badgeStatusGraded}`}>
                        ตรวจแล้ว
                      </span>
                    ) : sub.status === "resubmit" ? (
                      <span className={`${styles.badgeType} ${styles.badgeStatusResubmit}`}>
                        ส่งกลับแก้ไข
                      </span>
                    ) : (
                      <span className={`${styles.badgeType} ${styles.badgeStatusPending}`}>
                        รอตรวจ
                      </span>
                    )}

                    {/* Private Score rendering: Only show score to TEACHER. Students do NOT see the score. */}
                    {isTeacher && sub.score !== undefined && (
                      <span className={styles.scoreTeacherText} style={{ fontSize: "0.85rem", padding: "4px", background: "rgba(6,182,212,0.1)", borderRadius: "4px" }}>
                        คะแนน: {sub.score}/{sub.maxScore}
                      </span>
                    )}
                  </div>

                  <h3 className={styles.cardTitle}>{sub.title}</h3>
                  {sub.description && <p className={styles.cardDesc}>{sub.description}</p>}

                  {/* Group Members List badge */}
                  {sub.isGroup && sub.members && sub.members.length > 0 && (
                    <div className={styles.groupMembersBadge}>
                      <strong>👥 สมาชิกกลุ่ม ({sub.members.length} คน):</strong>
                      <div className={styles.membersListInline}>
                        {sub.members.map((m, idx) => (
                          <span key={idx} className={styles.memberTag}>
                            {idx + 1}. {m.name} (ห้อง {m.room} เลขที่ {m.studentNo})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Canva Embed or YouTube Embed or Preview */}
                  {canvaEmbed ? (
                    <div className={styles.attachmentBox}>
                      <div className={styles.attachmentLabel}>
                        <FileText size={14} />
                        <span>ชิ้นงาน Canva (ลิงก์แนบ)</span>
                      </div>
                      <div className="canva-wrapper">
                        <iframe 
                          src={canvaEmbed} 
                          allowFullScreen
                          allow="fullscreen"
                        ></iframe>
                      </div>
                      <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                        <span>เปิดดูชิ้นงานเต็มจอ</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : ytEmbed ? (
                    <div className={styles.attachmentBox}>
                      <div className={styles.attachmentLabel}>
                        <Video size={14} style={{ color: "#ef4444" }} />
                        <span>วิดีโอ YouTube (ลิงก์แนบ)</span>
                      </div>
                      <div className={styles.videoWrapper}>
                        <iframe
                          src={ytEmbed}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>
                      <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                        <span>เปิดดูวิดีโอในหน้าใหม่</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : (
                    <div className={styles.attachmentLinkBox}>
                      <div className={styles.attachmentLabel}>
                        <ExternalLink size={14} />
                        <span>ลิงก์ชิ้นงานแนบ</span>
                      </div>
                      <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.attachmentLink}>
                        <span className={styles.linkText}>{sub.linkUrl}</span>
                        <ExternalLink size={14} className={styles.linkIcon} />
                      </a>
                    </div>
                  )}

                  {/* Teacher Feedback shown to owner/members or teacher */}
                  {sub.teacherFeedback && (isOwner || isGroupMember || isTeacher) && (
                    <div className={styles.feedbackAlert}>
                      <div className={styles.feedbackTitle}>💬 ข้อแนะนำจากคุณครู:</div>
                      <p>{sub.teacherFeedback}</p>
                    </div>
                  )}
                </div>

                {/* Interaction Footer */}
                <footer className={styles.cardFooter}>
                  <button 
                    onClick={() => handleToggleLike(sub.id)} 
                    className={`${styles.likeBtn} ${hasLiked ? styles.liked : ""}`}
                  >
                    <Heart size={16} fill={hasLiked ? "currentColor" : "none"} />
                    <span>{sub.likes.length} ถูกใจ</span>
                  </button>

                  <button onClick={() => toggleCommentsView(sub.id)} className={styles.commentBtn}>
                    <MessageSquare size={16} />
                    <span>{sub.comments.length} ความคิดเห็น</span>
                  </button>
                </footer>

                {/* Teacher Grading Panel Action */}
                {isTeacher && (
                  <div className={styles.gradeHeaderArea}>
                    <button onClick={() => handleOpenGradeModal(sub)} className={styles.gradeBtn}>
                      <Edit3 size={12} />
                      <span>{sub.status === "graded" ? "แก้ไขผลการประเมิน" : "ประเมิน/ให้คะแนน"}</span>
                    </button>
                  </div>
                )}

                {/* Comment Section (Expandable) */}
                {expandedComments[sub.id] && (
                  <div className={styles.commentSection}>
                    <div className={styles.commentsList}>
                      {sub.comments.length === 0 ? (
                        <p className={styles.noComments}>ยังไม่มีข้อคิดเห็น ร่วมเป็นคนแรกที่เขียนข้อความชื่นชมเพื่อน</p>
                      ) : (
                        sub.comments.map((comment) => (
                          <div key={comment.id} className={styles.commentItem}>
                            <div className={styles.commentMeta}>
                              <span className={styles.commentAuthor}>{comment.authorName}</span>
                              <span className={styles.commentTime}>
                                {new Date(comment.createdAt).toLocaleDateString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })} น.
                              </span>
                            </div>
                            <p className={styles.commentContent}>{comment.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className={styles.commentForm}>
                      <input
                        type="text"
                        placeholder="พิมพ์แสดงความคิดเห็น..."
                        value={commentInputs[sub.id] || ""}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddComment(sub.id);
                        }}
                      />
                      <button onClick={() => handleAddComment(sub.id)} className={styles.sendCommentBtn}>
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Assignment Modal */}
      {showSubmitModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>{editingSubId ? "แก้ไขและส่งงานใหม่" : "ส่งชิ้นงานกิจกรรม"}</h3>
              <button onClick={() => setShowSubmitModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            {error && <div className={styles.modalError}>{error}</div>}

            <form onSubmit={handleSubmitWork} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>หัวข้อชิ้นงาน</label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: โปสเตอร์แนะนำตัวกลุ่ม 3 หรือ โปสเตอร์สมพงษ์"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>แนวคิดในการทำงาน / คำอธิบาย</label>
                <textarea
                  placeholder="เขียนอธิบายชิ้นงานสั้นๆ สำหรับกิจกรรมนี้..."
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>แนบลิงก์ชิ้นงาน (Canva / Drive / อื่นๆ)</label>
                <input
                  type="url"
                  placeholder="วางลิงก์ผลงาน เช่น https://www.canva.com/design/..."
                  value={subLink}
                  onChange={(e) => setSubLink(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Group members registry */}
              {board?.type === "group" && (
                <div className={styles.membersRegistry}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h5 className={styles.registryTitle}>รายชื่อสมาชิกกลุ่ม (เฉพาะ ม.4)</h5>
                    <button 
                      type="button" 
                      onClick={handleAddMemberRow} 
                      className="btn-secondary" 
                      style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                      disabled={isSubmitting}
                    >
                      <UserPlus size={12} style={{ marginRight: "4px" }} />
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
                        disabled={isSubmitting || index === 0} // Submitter is read-only
                      />
                      <select
                        value={member.room}
                        onChange={(e) => handleUpdateMember(index, "room", e.target.value)}
                        disabled={isSubmitting || index === 0}
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
                        disabled={isSubmitting || index === 0}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberRow(index)}
                        className={styles.removeRowBtn}
                        disabled={isSubmitting || index === 0}
                        title="ลบสมาชิก"
                      >
                        <Trash2 size={12} />
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
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "กำลังส่งงาน..." : "ส่งงาน"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Grading Modal */}
      {showGradeModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>ประเมินและให้คะแนนผลงานนักเรียน</h3>
              <button onClick={() => setShowGradeModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveGrade} className={styles.modalForm}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className={styles.formGroup}>
                  <label>คะแนนที่ได้</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="เช่น 9.5"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    required
                    disabled={isGradingSubmitting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>คะแนนเต็ม</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="เช่น 10"
                    value={gradeMaxScore}
                    onChange={(e) => setGradeMaxScore(e.target.value)}
                    required
                    disabled={isGradingSubmitting}
                  />
                </div>
              </div>

              {/* Quick score buttons */}
              {getQuickScores().length > 0 && (
                <div className={styles.formGroup}>
                  <label>ปุ่มให้คะแนนด่วน</label>
                  <div className={styles.quickScoresContainer}>
                    {getQuickScores().map((val) => {
                      const isMax = val === Number(gradeMaxScore);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setGradeScore(String(val))}
                          className={`${styles.quickScoreBtn} ${Number(gradeScore) === val ? styles.quickScoreBtnActive : ""}`}
                          disabled={isGradingSubmitting}
                        >
                          {isMax ? "เต็ม" : ""} {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>สถานะประเมิน</label>
                <select
                  value={gradeStatus}
                  onChange={(e) => setGradeStatus(e.target.value as "graded" | "resubmit")}
                  disabled={isGradingSubmitting}
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px 16px",
                    color: "white"
                  }}
                >
                  <option value="graded">ตรวจแล้ว (สมบูรณ์)</option>
                  <option value="resubmit">ส่งกลับแก้ไข (มีจุดต้องปรับปรุง)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>คำแนะนำ / ข้อเสนอแนะจากครู</label>
                <textarea
                  placeholder="เขียนอธิบายสั้นๆ เช่น จัดวางสวยงามมาก / ลิงก์เข้าไม่ได้กรุณาแชร์สิทธิการดู..."
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  rows={3}
                  disabled={isGradingSubmitting}
                />
              </div>

              <div className={styles.formGroup} style={{ flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "8px", background: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <input
                  type="checkbox"
                  id="awardPackCheck"
                  checked={awardPack}
                  onChange={(e) => setAwardPack(e.target.checked)}
                  disabled={isGradingSubmitting}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
                <label htmlFor="awardPackCheck" style={{ marginBottom: 0, cursor: "pointer", color: "#34d399", fontWeight: "bold" }}>
                  🎁 มอบรางวัลพิเศษ 1 ซอง (ชิ้นงานคุณภาพดีเยี่ยม)
                </label>
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowGradeModal(false)} 
                  className="btn-secondary"
                  disabled={isGradingSubmitting}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isGradingSubmitting}
                >
                  {isGradingSubmitting ? "กำลังบันทึก..." : "บันทึกผล"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      {/* Teacher Bulk Grading Modal */}
      {showBulkGradeModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-container`}>
            <header className={styles.modalHeader}>
              <h3>ประเมินและให้คะแนนงานทั้งหมดพร้อมกัน</h3>
              <button onClick={() => setShowBulkGradeModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveBulkGrade} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>เลือกขอบเขตการตรวจ</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="bulkScope"
                      value="pending"
                      checked={bulkGradeScope === "pending"}
                      onChange={() => setBulkGradeScope("pending")}
                      disabled={isBulkGradingSubmitting}
                    />
                    <span>เฉพาะงานที่ยังไม่ตรวจ / รอตรวจ ({submissions.filter(s => s.status === "pending" || !s.status).length} งาน)</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="bulkScope"
                      value="all"
                      checked={bulkGradeScope === "all"}
                      onChange={() => setBulkGradeScope("all")}
                      disabled={isBulkGradingSubmitting}
                    />
                    <span>งานทั้งหมดในบอร์ดชิ้นนี้ ({submissions.length} งาน - จะเขียนทับงานที่เคยตรวจแล้ว)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className={styles.formGroup}>
                  <label>คะแนนที่ได้</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="เช่น 10"
                    value={bulkGradeScore}
                    onChange={(e) => setBulkGradeScore(e.target.value)}
                    required
                    disabled={isBulkGradingSubmitting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>คะแนนเต็ม</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="เช่น 10"
                    value={bulkGradeMaxScore}
                    onChange={(e) => setBulkGradeMaxScore(e.target.value)}
                    required
                    disabled={isBulkGradingSubmitting}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>สถานะประเมิน</label>
                <select
                  value={bulkGradeStatus}
                  onChange={(e) => setBulkGradeStatus(e.target.value as "graded" | "resubmit")}
                  disabled={isBulkGradingSubmitting}
                  className={styles.modalSelect}
                >
                  <option value="graded">ตรวจแล้ว (สมบูรณ์)</option>
                  <option value="resubmit">ส่งกลับแก้ไข (มีจุดต้องปรับปรุง)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>คำแนะนำ / ข้อเสนอแนะจากครู (ส่งให้ทุกคนเหมือนกัน)</label>
                <textarea
                  placeholder="ตัวอย่าง: ตรวจแล้วผ่านเกณฑ์ / ชิ้นงานสวยงาม..."
                  value={bulkGradeFeedback}
                  onChange={(e) => setBulkGradeFeedback(e.target.value)}
                  rows={2}
                  disabled={isBulkGradingSubmitting}
                />
              </div>

              <div className={styles.formGroup} style={{ flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "8px", background: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <input
                  type="checkbox"
                  id="bulkAwardPackCheck"
                  checked={bulkAwardPack}
                  onChange={(e) => setBulkAwardPack(e.target.checked)}
                  disabled={isBulkGradingSubmitting}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
                <label htmlFor="bulkAwardPackCheck" style={{ marginBottom: 0, cursor: "pointer", color: "#34d399", fontWeight: "bold" }}>
                  🎁 มอบรางวัลพิเศษ 1 ซอง แก่ทุกคนที่ได้รับการตรวจในรอบนี้ (ค่าเริ่มต้น: เลือก)
                </label>
              </div>

              <footer className={styles.modalFooter}>
                <button 
                  type="button" 
                  onClick={() => setShowBulkGradeModal(false)} 
                  className="btn-secondary"
                  disabled={isBulkGradingSubmitting}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isBulkGradingSubmitting}
                >
                  {isBulkGradingSubmitting ? "กำลังบันทึกคะแนน..." : "บันทึกผลคะแนนทั้งหมด"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
