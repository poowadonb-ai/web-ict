"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { boardService, submissionService, AssignmentBoard, Submission } from "@/lib/firebase";
import { 
  ClipboardList, ExternalLink, 
  CornerDownRight, ArrowRight, HelpCircle
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

type TaskStatus = "not_submitted" | "pending" | "graded" | "resubmit";

interface TaskItem {
  board: AssignmentBoard;
  submission?: Submission;
  status: TaskStatus;
}

export default function MyTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [boards, setBoards] = useState<AssignmentBoard[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | TaskStatus>("all");

  useEffect(() => {
    // Redirect if teacher
    if (!authLoading && user && user.role === "teacher") {
      router.push("/gradebook");
      return;
    }
    // Redirect if not logged in
    if (!authLoading && !user) {
      router.push("/classroom");
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "student") return;

    let isMounted = true;

    const fetchSubs = async () => {
      if (!isMounted) return;
      const data = await submissionService.getAllSubmissions();
      console.log("[my-tasks DEBUG] getAllSubmissions returned:", data.length, "submissions");
      console.log("[my-tasks DEBUG] user.uid:", user?.uid);
      if (data.length > 0) {
        console.log("[my-tasks DEBUG] first submission uid:", data[0].uid, "boardId:", data[0].boardId);
      }
      if (isMounted) setSubmissions(data);
    };

    // Subscribe to all boards (realtime)
    const unsubBoards = boardService.subscribeBoards((data) => {
      if (isMounted) setBoards(data);
    });

    // Subscribe to all submissions (realtime)
    const unsubSubs = submissionService.subscribeAllSubmissions((data) => {
      if (isMounted) setSubmissions(data);
    });

    // Polling fallback every 10 seconds in case Realtime doesn't fire
    const pollInterval = setInterval(() => {
      void fetchSubs();
    }, 10000);

    // Refetch when user returns to this tab (e.g. after submitting on padlet)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchSubs();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Refetch when window gets focus
    const handleFocus = () => { void fetchSubs(); };
    window.addEventListener("focus", handleFocus);

    // Initial one-time fetch for guaranteed fresh data
    void fetchSubs();

    return () => {
      isMounted = false;
      if (typeof unsubBoards === "function") unsubBoards();
      if (typeof unsubSubs === "function") unsubSubs();
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);



  if (authLoading || !user || user.role !== "student") {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดข้อมูลการส่งงาน...</p>
      </div>
    );
  }

  const studentRoom = user.room || "";
  const studentNo = user.studentNo || "";

  // Filter boards targeting the student's room
  const targetedBoards = boards.filter((board) => {
    if (!board.targetRooms || board.targetRooms.length === 0) return true;
    return board.targetRooms.includes(studentRoom);
  });

  // Build task items
  const tasks: TaskItem[] = targetedBoards.map((board) => {
    // Find if the student has a submission (either own or as a group member)
    const sub = submissions.find((s) => {
      if (s.boardId !== board.id) return false;
      if (s.uid === user.uid) return true;
      if (String(s.studentNo) === String(studentNo) && s.gradeClass && s.gradeClass.includes(studentRoom)) return true;
      if (s.isGroup && s.members) {
        return s.members.some(
          (m) => m.room === studentRoom && String(m.studentNo) === String(studentNo)
        );
      }
      return false;
    });

    let status: TaskStatus = "not_submitted";
    if (sub) {
      if (sub.status === "graded") {
        status = "graded";
      } else if (sub.status === "resubmit") {
        status = "resubmit";
      } else {
        status = "pending";
      }
    }

    return { board, submission: sub, status };
  });

  // Calculate statistics
  const totalTasks = tasks.length;
  const submittedTasks = tasks.filter((t) => t.status !== "not_submitted").length;
  const gradedTasks = tasks.filter((t) => t.status === "graded").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const resubmitTasks = tasks.filter((t) => t.status === "resubmit").length;
  const notSubmittedTasks = tasks.filter((t) => t.status === "not_submitted").length;
  
  const completionRate = totalTasks > 0 ? Math.round((submittedTasks / totalTasks) * 100) : 0;

  // Filter tasks by active tab
  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "all") return true;
    return task.status === activeTab;
  });

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "graded":
        return <span className={`${styles.badge} ${styles.badgeGraded}`}>🟢 ตรวจแล้ว</span>;
      case "resubmit":
        return <span className={`${styles.badge} ${styles.badgeResubmit}`}>🟠 ส่งกลับแก้ไข</span>;
      case "pending":
        return <span className={`${styles.badge} ${styles.badgePending}`}>🟡 รอการตรวจ</span>;
      case "not_submitted":
        default:
        return <span className={`${styles.badge} ${styles.badgeNotSubmitted}`}>🔴 ยังไม่ส่ง</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <ClipboardList className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">งานของฉัน</h1>
            <p className={styles.subtitle}>
              ติดตามการส่งงาน สถานะตรวจการบ้าน และการปรับปรุงแก้ไขในห้อง ม.4/{studentRoom} เลขที่ {studentNo}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Cards */}
      <div className={styles.progressSection}>
        <div className={`${styles.progressCard} glass-container`}>
          <div className={styles.progressMain}>
            <div className={styles.progressText}>
              <span className={styles.progressTitle}>ความคืบหน้าการส่งงาน</span>
              <span className={styles.progressRatio}>{submittedTasks} / {totalTasks} ชิ้น</span>
            </div>
            <div className={styles.progressBarWrapper}>
              <div 
                className={styles.progressBar} 
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>
          <div className={styles.progressPercent}>{completionRate}%</div>
        </div>

        <div className={styles.statsSummary}>
          <div className={`${styles.statTile} glass-container ${styles.tileGraded}`}>
            <span className={styles.tileVal}>{gradedTasks}</span>
            <span className={styles.tileLabel}>ตรวจแล้ว</span>
          </div>
          <div className={`${styles.statTile} glass-container ${styles.tilePending}`}>
            <span className={styles.tileVal}>{pendingTasks}</span>
            <span className={styles.tileLabel}>รอตรวจ</span>
          </div>
          <div className={`${styles.statTile} glass-container ${styles.tileResubmit}`}>
            <span className={styles.tileVal}>{resubmitTasks}</span>
            <span className={styles.tileLabel}>ต้องแก้ไข</span>
          </div>
          <div className={`${styles.statTile} glass-container ${styles.tileNotSubmitted}`}>
            <span className={styles.tileVal}>{notSubmittedTasks}</span>
            <span className={styles.tileLabel}>ยังไม่ส่ง</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.tabsContainer}>
        <button 
          onClick={() => setActiveTab("all")} 
          className={`${styles.tabBtn} ${activeTab === "all" ? styles.tabActive : ""}`}
        >
          ทั้งหมด ({totalTasks})
        </button>
        <button 
          onClick={() => setActiveTab("not_submitted")} 
          className={`${styles.tabBtn} ${activeTab === "not_submitted" ? styles.tabActive : ""}`}
        >
          ยังไม่ส่ง ({notSubmittedTasks})
        </button>
        <button 
          onClick={() => setActiveTab("pending")} 
          className={`${styles.tabBtn} ${activeTab === "pending" ? styles.tabActive : ""}`}
        >
          รอการตรวจ ({pendingTasks})
        </button>
        <button 
          onClick={() => setActiveTab("resubmit")} 
          className={`${styles.tabBtn} ${activeTab === "resubmit" ? styles.tabActive : ""}`}
        >
          ส่งกลับแก้ไข ({resubmitTasks})
        </button>
        <button 
          onClick={() => setActiveTab("graded")} 
          className={`${styles.tabBtn} ${activeTab === "graded" ? styles.tabActive : ""}`}
        >
          ตรวจแล้ว ({gradedTasks})
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className={`${styles.emptyState} glass-container`}>
          <HelpCircle size={40} className={styles.emptyIcon} />
          <p>ไม่มีงานในหมวดหมู่นี้</p>
          <p className={styles.emptySub}>งานทั้งหมดจะแสดงตามตัวกรองที่คุณเลือก</p>
        </div>
      ) : (
        <div className={styles.tasksGrid}>
          {filteredTasks.map(({ board, submission, status }) => (
            <div key={board.id} className={`${styles.taskCard} glass-card`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  {getStatusBadge(status)}
                  <span className={`${styles.typeBadge} ${board.type === "group" ? styles.badgeGroup : styles.badgeIndiv}`}>
                    {board.type === "group" ? "งานกลุ่ม" : "งานเดี่ยว"}
                  </span>
                </div>
                <span className={styles.taskDate}>
                  {new Date(board.createdAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.boardTitle}>{board.title}</h3>
                <p className={styles.boardDesc}>{board.description}</p>

                {submission && (
                  <div className={styles.subDetail}>
                    <div className={styles.subTitleLine}>
                      <span className={styles.subLabel}>ชิ้นงานที่ส่ง:</span>
                      <span className={styles.subTitleVal}>{submission.title}</span>
                    </div>

                    {submission.description && (
                      <p className={styles.subDescVal}>{submission.description}</p>
                    )}

                    {submission.isGroup && submission.members && (
                      <div className={styles.membersSection}>
                        <span className={styles.subLabel}>สมาชิกกลุ่ม:</span>
                        <div className={styles.membersTags}>
                          {submission.members.map((m, idx) => (
                            <span key={idx} className={styles.memberTag}>
                              {m.name} (เลขที่ {m.studentNo})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <a 
                      href={submission.linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.linkButton}
                    >
                      <ExternalLink size={14} />
                      <span>เปิดดูลิงก์งานที่ส่ง</span>
                    </a>

                    {submission.teacherFeedback && (
                      <div className={styles.feedbackBox}>
                        <CornerDownRight size={16} className={styles.feedbackIcon} />
                        <div className={styles.feedbackContent}>
                          <span className={styles.feedbackTitle}>คำสั่งแก้ / ข้อเสนอแนะจากคุณครู</span>
                          <p className={styles.feedbackText}>{submission.teacherFeedback}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                {status === "not_submitted" && (
                  <Link href={`/padlet/${board.id}`} className={`${styles.actionBtn} ${styles.btnSubmit}`}>
                    <span>ไปที่บอร์ดเพื่อส่งงาน</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
                {status === "resubmit" && (
                  <Link href={`/padlet/${board.id}`} className={`${styles.actionBtn} ${styles.btnResubmit}`}>
                    <span>แก้ไข & ส่งใหม่อีกครั้ง</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
                {(status === "pending" || status === "graded") && (
                  <Link href={`/padlet/${board.id}`} className={`${styles.actionBtn} ${styles.btnView}`}>
                    <span>ดูกระดานส่งงานรวม</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
