"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, UserCheck, AlertCircle, Shield, RefreshCw } from "lucide-react";
import styles from "./page.module.css";

const generateCaptchaText = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude O, 0, I, 1, l
  let text = "";
  for (let i = 0; i < 5; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
};

export default function RegisterPage() {
  const { user, loading, registerProfile, signUpWithUsernamePassword } = useAuth();
  const router = useRouter();

  // Common Profile states
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("4");
  const [room, setRoom] = useState("2");
  const [studentNo, setStudentNo] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Room options per grade
  const ROOMS_BY_GRADE: Record<string, string[]> = {
    "4": ["2", "3", "4", "5", "6", "12", "13"],
    "5": ["2", "3"],
  };
  const roomOptions = ROOMS_BY_GRADE[grade] || ROOMS_BY_GRADE["4"];

  // Custom Signup credentials states (Used only when not logged in via Google)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");

  useEffect(() => {
    // Generate initial captcha on mount
    setCaptchaValue(generateCaptchaText());
  }, []);

  useEffect(() => {
    // If Google user is already fully registered, redirect
    if (user && user.isRegistered) {
      router.push("/classroom");
    }
  }, [user, router]);

  const refreshCaptcha = () => {
    setCaptchaValue(generateCaptchaText());
    setCaptchaInput("");
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดข้อมูลผู้ใช้...</p>
      </div>
    );
  }

  // Submit profile for Google-logged in users
  const handleGoogleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (!studentNo.trim() || isNaN(Number(studentNo)) || Number(studentNo) <= 0) {
      setError("กรุณากรอกเลขที่ให้ถูกต้อง (ตัวเลขที่มากกว่า 0)");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerProfile({
        fullName: fullName.trim(),
        grade,
        room,
        studentNo: studentNo.trim()
      });
      router.push("/classroom");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit complete credentials sign-up
  const handleCustomSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError("กรุณากรอกชื่อผู้ใช้");
      return;
    }
    if (!/^[a-zA-Z0-9_]{4,15}$/.test(cleanUsername)) {
      setError("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลข 4-15 ตัวอักษรเท่านั้น");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!fullName.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (!studentNo.trim() || isNaN(Number(studentNo)) || Number(studentNo) <= 0) {
      setError("กรุณากรอกเลขที่ให้ถูกต้อง");
      return;
    }
    if (captchaInput.trim().toUpperCase() !== captchaValue) {
      setError("รหัสป้องกันสแปม (CAPTCHA) ไม่ถูกต้อง กรุณาลองใหม่");
      refreshCaptcha();
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpWithUsernamePassword(
        cleanUsername,
        password,
        {
          fullName: fullName.trim(),
          grade,
          room,
          studentNo: studentNo.trim()
        }
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหมี่อีกครั้ง";
      setError(errMsg);
      refreshCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  // SVG CAPTCHA generator
  const renderSvgCaptcha = (text: string) => {
    const lines = [
      { x1: 10, y1: Math.random() * 40 + 5, x2: 140, y2: Math.random() * 40 + 5 },
      { x1: 15, y1: Math.random() * 40 + 5, x2: 135, y2: Math.random() * 40 + 5 },
      { x1: 5, y1: Math.random() * 40 + 5, x2: 145, y2: Math.random() * 40 + 5 },
      { x1: Math.random() * 30, y1: 5, x2: Math.random() * 30 + 110, y2: 45 },
    ];
    
    const dots = Array.from({ length: 30 }).map((_, i) => ({
      cx: Math.random() * 150,
      cy: Math.random() * 50,
      r: Math.random() * 1.5 + 0.5,
      key: i
    }));

    const textChars = text.split("").map((char, index) => {
      const x = 15 + index * 25 + Math.random() * 5;
      const y = 33 + (Math.random() * 6 - 3);
      const angle = Math.random() * 30 - 15;
      const fontSizes = [22, 24, 26, 28];
      const fontSize = fontSizes[Math.floor(Math.random() * fontSizes.length)];
      const colors = ["#a855f7", "#ec4899", "#06b6d4", "#22d3ee", "#c084fc", "#e879f9"];
      const fill = colors[Math.floor(Math.random() * colors.length)];
      return {
        char,
        x,
        y,
        fontSize,
        fill,
        transform: `rotate(${angle}, ${x}, ${y})`,
        key: index
      };
    });

    return (
      <svg width="150" height="50" style={{ background: "rgba(255, 255, 255, 0.05)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1.5" />
        ))}
        {dots.map(d => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill="rgba(255, 255, 255, 0.2)" />
        ))}
        {textChars.map(tc => (
          <text
            key={tc.key}
            x={tc.x}
            y={tc.y}
            fill={tc.fill}
            fontSize={tc.fontSize}
            fontFamily="'Courier New', Courier, monospace"
            fontWeight="900"
            transform={tc.transform}
            letterSpacing="2"
          >
            {tc.char}
          </text>
        ))}
      </svg>
    );
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.card} glass-container`}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Award className={styles.icon} />
          </div>
          <h1 className="gradient-text">ลงทะเบียนเข้าห้องเรียน</h1>
          <p className={styles.subtitle}>กรุณากรอกข้อมูลจริงเพื่อใช้ในการบันทึกคะแนนและส่งงาน</p>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {user ? (
          /* FLOW A: Logged in via Google, completing profiles */
          <form onSubmit={handleGoogleProfileSubmit} className={styles.form}>
            <div className={styles.userBrief}>
              <span className={styles.emailLabel}>ลงทะเบียนผ่าน Gmail:</span>
              <span className={styles.emailVal}>{user.email}</span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="fullName">ชื่อ - นามสกุล (ภาษาไทย)</label>
              <input
                id="fullName"
                type="text"
                placeholder="เด็กชาย / เด็กหญิง / นาย / นางสาว..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label htmlFor="grade">ระดับชั้น</label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => { setGrade(e.target.value); setRoom(ROOMS_BY_GRADE[e.target.value]?.[0] || "2"); }}
                  disabled={isSubmitting}
                >
                  <option value="4">มัธยมศึกษาปีที่ 4 (ม.4)</option>
                  <option value="5">มัธยมศึกษาปีที่ 5 (ม.5)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="room">ห้อง</label>
                <select
                  id="room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  disabled={isSubmitting}
                >
                  {roomOptions.map(r => (
                    <option key={r} value={r}>ม.{grade}/{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="studentNo">เลขที่</label>
              <input
                id="studentNo"
                type="number"
                min="1"
                max="60"
                placeholder="เช่น 15"
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={isSubmitting}>
              <UserCheck size={18} />
              <span>{isSubmitting ? "กำลังบันทึกข้อมูล..." : "ลงทะเบียนเข้าห้องเรียน"}</span>
            </button>
          </form>
        ) : (
          /* FLOW B: Direct Sign-up with Username/Password */
          <form onSubmit={handleCustomSignUpSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="regUsername">ชื่อผู้ใช้ (Username)</label>
              <input
                id="regUsername"
                type="text"
                placeholder="ภาษาอังกฤษหรือตัวเลข 4-15 หลัก เช่น somchai42"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label htmlFor="regPassword">รหัสผ่าน (Password)</label>
                <input
                  id="regPassword"
                  type="password"
                  placeholder="อย่างน้อย 6 หลัก"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="regConfirmPassword">ยืนยันรหัสผ่าน</label>
                <input
                  id="regConfirmPassword"
                  type="password"
                  placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="fullNameCustom">ชื่อ - นามสกุลจริง (ภาษาไทย)</label>
              <input
                id="fullNameCustom"
                type="text"
                placeholder="ระบุ คำนำหน้า ชื่อ และนามสกุล ให้ถูกต้องเพื่อเช็คคะแนน"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label htmlFor="gradeCustom">ระดับชั้น</label>
                <select
                  id="gradeCustom"
                  value={grade}
                  onChange={(e) => { setGrade(e.target.value); setRoom(ROOMS_BY_GRADE[e.target.value]?.[0] || "2"); }}
                  disabled={isSubmitting}
                >
                  <option value="4">ม.4</option>
                  <option value="5">ม.5</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="roomCustom">ห้องเรียน</label>
                <select
                  id="roomCustom"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  disabled={isSubmitting}
                >
                  {roomOptions.map(r => (
                    <option key={r} value={r}>ม.{grade}/{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="studentNoCustom">เลขที่</label>
              <input
                id="studentNoCustom"
                type="number"
                min="1"
                max="60"
                placeholder="เช่น 15"
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Captcha form block */}
            <div className={styles.formGroup}>
              <label htmlFor="captchaInput">รหัสป้องกันสแปม (CAPTCHA)</label>
              <div className={styles.captchaRow}>
                {renderSvgCaptcha(captchaValue)}
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="btn-secondary"
                  style={{ 
                    padding: "8px 12px", 
                    height: "50px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "6px" 
                  }}
                  title="รีเฟรชรหัสป้องกัน"
                  disabled={isSubmitting}
                >
                  <RefreshCw size={14} />
                  <span>เปลี่ยนภาพ</span>
                </button>
              </div>
              <input
                id="captchaInput"
                type="text"
                placeholder="กรอกตัวอักษร 5 หลักตามที่แสดงในรูปภาพด้านบน"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                disabled={isSubmitting}
                style={{ marginTop: "6px" }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "6px" }} disabled={isSubmitting}>
              <UserCheck size={18} />
              <span>{isSubmitting ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิกและลงทะเบียน"}</span>
            </button>

            <div className={styles.cancelLinkBox}>
              <Link href="/" className={styles.cancelLink}>
                ยกเลิกและกลับไปหน้าล็อกอิน
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

