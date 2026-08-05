"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/lib/supabase";
import { UserProfile } from "@/lib/types";
import { BookOpen, Layers, Award, Zap, ShieldAlert } from "lucide-react";
import styles from "./page.module.css";

/* ── Animated counter hook ── */
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setCount(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

/* ── Floating orb ── */
function Orb({ style }: { style: React.CSSProperties }) {
  return <div className={styles.orb} style={style} />;
}

export default function Home() {
  const { loading, signInWithUsernamePassword } = useAuth();

  // Tabs
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // Roster logic state
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("4");
  const [selectedRoom, setSelectedRoom] = useState("2");
  const [selectedStudentUid, setSelectedStudentUid] = useState("");
  
  // Manual credentials state (for teacher)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const studentsCount = useCounter(240, 1600, statsVisible);
  const lessonsCount = useCounter(36, 1400, statsVisible);
  const cardsCount = useCounter(128, 1800, statsVisible);

  const ROOMS_BY_GRADE: Record<string, string[]> = {
    "4": ["2", "3", "4", "5", "6", "12", "13"],
    "5": ["2", "3"],
  };
  const roomOptions = ROOMS_BY_GRADE[selectedGrade] || ROOMS_BY_GRADE["4"];

  // Load students for dropdown on mount
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const students = await authService.getRegisteredStudents();
        setAllStudents(students);
      } catch (err) {
        console.error("Error loading students for login dropdown:", err);
      }
    };
    loadStudents();
  }, []);

  // Reset student selection when grade or room changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedStudentUid("");
  }, [selectedGrade, selectedRoom]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.4 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    let loginUsernameOrUid = "";
    if (activeTab === "student") {
      if (!selectedStudentUid) {
        setLoginError("กรุณาเลือกชื่อนักเรียน");
        return;
      }
      loginUsernameOrUid = selectedStudentUid;
    } else {
      loginUsernameOrUid = username.trim() || "krupoowadon";
    }

    if (!password.trim()) {
      setLoginError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setIsLoggingIn(true);
    try {
      const studentProfile = activeTab === "student"
        ? allStudents.find((s) => s.uid === selectedStudentUid)
        : undefined;

      await signInWithUsernamePassword(loginUsernameOrUid, password.trim(), studentProfile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const filteredStudents = allStudents.filter(
    (s) =>
      String(s.grade ?? "").trim() === String(selectedGrade).trim() &&
      String(s.room ?? "").trim() === String(selectedRoom).trim()
  );


  return (
    <div className={styles.container}>
      {/* Decorative floating orbs */}
      <Orb style={{ top: "8%", left: "5%", width: 320, height: 320, background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)" }} />
      <Orb style={{ top: "20%", right: "3%", width: 260, height: 260, background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)" }} />
      <Orb style={{ bottom: "10%", left: "20%", width: 200, height: 200, background: "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)" }} />

      {/* ── HERO ── */}
      <div className={styles.heroSection}>
        <div className={styles.logoContainer}>
          <div className={styles.logoGlow} />
          <div className={styles.logoRing} />
          <div className={styles.logoRing2} />
          <div className={styles.iconBackground}>
            <Award className={styles.mainIcon} />
          </div>
        </div>

        <div className={styles.titleGroup}>
          <h1 className={`${styles.title} gradient-text-neon`}>
            ICT CLASSROOM
          </h1>
          <p className={styles.subtitle}>
            แพลตฟอร์มการเรียนรู้ออนไลน์และส่งงานแบบเรียลไทม์<br />
            สำหรับนักเรียนและครูยุคใหม่
          </p>
        </div>

        {/* Stats strip */}
        <div className={styles.statsStrip} ref={statsRef}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{studentsCount}+</span>
            <span className={styles.statLabel}>นักเรียน</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{lessonsCount}</span>
            <span className={styles.statLabel}>บทเรียน</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{cardsCount}+</span>
            <span className={styles.statLabel}>การ์ดสะสม</span>
          </div>
        </div>

        {/* ── LOGIN CARD ── */}
        <div className={`${styles.loginCard} glass-container`}>
          <div className={styles.cardGlowBorder} />

          {/* Login Tabs */}
          <div className={styles.tabHeader}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "student" ? styles.tabBtnActive : ""}`}
              onClick={() => { setActiveTab("student"); setLoginError(""); }}
            >
              🧑‍🎓 นักเรียน
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "teacher" ? styles.tabBtnActive : ""}`}
              onClick={() => { setActiveTab("teacher"); setLoginError(""); }}
            >
              🧑‍🏫 คุณครู
            </button>
          </div>

          <h2 className={styles.cardTitle}>
            {activeTab === "student" ? "เข้าห้องเรียนออนไลน์" : "ระบบสำหรับคุณครู"}
          </h2>
          <p className={styles.cardDesc}>
            {activeTab === "student" ? "เลือกชั้นเรียน ห้องเรียน และชื่อของตนเองเพื่อเข้าสู่ระบบ" : "กรอกชื่อผู้ใช้และรหัสผ่านครูเพื่อเข้าจัดการห้องเรียน"}
          </p>

          {(loading || isLoggingIn) ? (
            <div className={styles.loadingWrapper}>
              <div className={styles.spinnerRing} />
              <p>กำลังนำทางเข้าสู่ระบบ...</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className={styles.loginForm}>
              {loginError && (
                <div className={styles.loginErrorAlert}>⚠️ {loginError}</div>
              )}

              {activeTab === "student" ? (
                // ── Student Tab Inputs ──
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className={styles.formInputGroup}>
                      <label htmlFor="studentGrade">ระดับชั้น</label>
                      <select
                        id="studentGrade"
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className={styles.customInput}
                        style={{ height: "48px", background: "rgba(255, 255, 255, 0.05)" }}
                      >
                        <option value="4">ม.4</option>
                        <option value="5">ม.5</option>
                      </select>
                    </div>

                    <div className={styles.formInputGroup}>
                      <label htmlFor="studentRoom">ห้องเรียน</label>
                      <select
                        id="studentRoom"
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className={styles.customInput}
                        style={{ height: "48px", background: "rgba(255, 255, 255, 0.05)" }}
                      >
                        {roomOptions.map((r) => (
                          <option key={r} value={r}>ม.{selectedGrade}/{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formInputGroup}>
                    <label htmlFor="studentName">เลือกรายชื่อของนักเรียน</label>
                    <select
                      id="studentName"
                      value={selectedStudentUid}
                      onChange={(e) => setSelectedStudentUid(e.target.value)}
                      className={styles.customInput}
                      style={{ height: "48px", background: "rgba(255, 255, 255, 0.05)" }}
                      required
                    >
                      <option value="">-- เลือกชื่อของตนเอง --</option>
                      {filteredStudents.map((stud) => (
                        <option key={stud.uid} value={stud.uid}>
                          เลขที่ {stud.studentNo} - {stud.fullName}
                        </option>
                      ))}
                    </select>
                    {filteredStudents.length === 0 && (
                      <span className={styles.inputHint} style={{ color: "#fca5a5" }}>
                        ยังไม่มีรายชื่อนักเรียนในห้องเรียนนี้ (กรุณาแจ้งคุณครูเพื่อนำเข้ารายชื่อ)
                      </span>
                    )}
                  </div>
                </>
              ) : (
                // ── Teacher Tab Inputs ──
                <div className={styles.formInputGroup}>
                  <label htmlFor="loginUsername">
                    <span className={styles.inputIcon}>👤</span>
                    ชื่อผู้ใช้คุณครู
                  </label>
                  <input
                    id="loginUsername"
                    type="text"
                    placeholder="กรอกชื่อผู้ใช้ครู"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoggingIn}
                    className={styles.customInput}
                    autoComplete="username"
                  />
                </div>
              )}

              {/* Password Input (Shared) */}
              <div className={styles.formInputGroup}>
                <label htmlFor="loginPassword">
                  <span className={styles.inputIcon}>🔑</span>
                  รหัสผ่าน (Password)
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    id="loginPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอกรหัสผ่านของคุณ"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoggingIn}
                    className={styles.customInput}
                    required
                    autoComplete="current-password"
                    autoFocus={activeTab === "teacher"}
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`btn-primary ${styles.loginBtn}`}
                disabled={isLoggingIn || (activeTab === "student" && !selectedStudentUid)}
              >
                {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className={`${styles.features} stagger-children`}>
        {[
          { icon: <BookOpen />, title: "เรียนรู้ด้วย Canva", desc: "ศึกษาบทเรียน สไลด์ Canva และวิดีโอ YouTube ที่ครูแชร์ได้ในที่เดียว", color: "purple" },
          { icon: <Layers />, title: "กระดานส่งงาน Realtime", desc: "ส่งผลงาน โหวต Like และเขียน Comment แบบเรียลไทม์ ไม่ต้องรีเฟรช", color: "cyan" },
          { icon: <Zap />, title: "การ์ดสะสม & Gacha", desc: "รับการ์ดสะสมหายากจากครู เปิดแพ็คการ์ดและแข่งขัน Leaderboard", color: "pink" },
          { icon: <ShieldAlert />, title: "ระบบล็อกอินปลอดภัย", desc: "สร้างบัญชีด้วยชื่อผู้ใช้และรหัสผ่าน ปกป้องคะแนนและงานของนักเรียนทุกคน", color: "gold" },
        ].map((f, i) => (
          <div key={i} className={`${styles.featureItem} ${styles[`feat${f.color.charAt(0).toUpperCase() + f.color.slice(1)}`]}`}>
            <div className={`${styles.featIconBox} ${styles[`featIcon${f.color.charAt(0).toUpperCase() + f.color.slice(1)}`]}`}>
              {f.icon}
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
