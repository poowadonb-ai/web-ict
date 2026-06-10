"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isMockMode } from "@/lib/firebase";
import { ShieldAlert, Sparkles, BookOpen, Layers, Award } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const { signIn, loading } = useAuth();
  const mockActive = isMockMode();
  const [mockEmail, setMockEmail] = useState("");

  const handleGoogleClick = () => {
    if (mockActive) {
      alert(
        "⚠️ ปุ่มนี้สำหรับล็อกอินผ่าน Google จริง\n\n" +
        "เนื่องจากตอนนี้ระบบรันอยู่ในโหมดจำลอง (เพราะคุณครูยังไม่ได้ใส่คีย์เชื่อมต่อในไฟล์ .env.local)\n\n" +
        "กรุณากรอกอีเมลจริงของคุณครูลงในช่องด้านล่าง แล้วกดปุ่มจำลองด้านล่างเพื่อทดสอบชั่วคราวได้เลยครับ!"
      );
    } else {
      signIn("student");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <div className={styles.badgesRow}>
          <span className={`${styles.systemBadge} ${mockActive ? styles.mockBadge : styles.firebaseBadge}`}>
            {mockActive ? "สถานะ: โหมดทดสอบ (Local Mock)" : "สถานะ: เชื่อมต่อ Firebase สำเร็จ"}
          </span>
        </div>

        <div className={styles.logoContainer}>
          <div className={styles.logoGlow}></div>
          <div className={styles.logoRing}></div>
          <div className={styles.iconBackground}>
            <Award className={styles.mainIcon} />
          </div>
        </div>

        <h1 className={`${styles.title} gradient-text-neon`}>
          ICT CLASSROOM
        </h1>
        <p className={styles.subtitle}>
          แพลตฟอร์มการเรียนรู้ออนไลน์และส่งงานแบบเรียลไทม์ สำหรับนักเรียนและครูยุคใหม่
        </p>

        <div className={`${styles.loginCard} glass-container`}>
          <h2 className={styles.cardTitle}>เข้าสู่ระบบเพื่อเริ่มเรียนรู้</h2>
          <p className={styles.cardDesc}>ใช้บัญชี Gmail ในการเข้าห้องเรียนสำหรับการลงทะเบียนและส่งงาน</p>

          {loading ? (
            <div className={styles.loadingWrapper}>
              <div className={styles.spinner}></div>
              <p>กำลังนำทางเข้าสู่ระบบ...</p>
            </div>
          ) : (
            <div className={styles.buttonStack}>
              {/* Actual Google Sign In Button */}
              <button 
                onClick={handleGoogleClick} 
                className={styles.googleBtn}
                title="เข้าสู่ระบบผ่านบัญชี Google จริง"
              >
                {/* Custom SVG Google Icon */}
                <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>ลงชื่อเข้าใช้ด้วย Google (Gmail)</span>
              </button>

              {/* Mock System Section (Developer / Tester Preview) */}
              {mockActive && (
                <div className={styles.mockSection}>
                  <div className={styles.divider}>
                    <span>หรือ ทดสอบระบบจำลอง (Developer Mock)</span>
                  </div>
                  <p className={styles.mockText}>
                    เนื่องจากคุณครูยังไม่ได้ใส่ข้อมูลตั้งค่า Firebase ใน `.env.local` ระบบจึงเปิดโหมดจำลองเพื่อให้คุณครูทดสอบหน้าเว็บได้ทันที:
                  </p>
                  <div className={styles.mockInputGroup}>
                    <label className={styles.mockInputLabel} htmlFor="mockEmailInput">
                      ระบุอีเมลที่ต้องการเข้าใช้งานจำลอง:
                    </label>
                    <input
                      id="mockEmailInput"
                      type="email"
                      placeholder="ตัวอย่าง: kruspoowadon@gmail.com"
                      value={mockEmail}
                      onChange={(e) => setMockEmail(e.target.value)}
                      className={styles.mockInput}
                    />
                  </div>
                  <div className={styles.mockButtons}>
                    <button 
                      onClick={() => signIn("teacher", mockEmail.trim() || undefined)} 
                      className={`${styles.mockBtn} ${styles.teacherMock}`}
                    >
                      <Sparkles size={16} />
                      <span>เข้าชมในฐานะ (ครู)</span>
                    </button>
                    <button 
                      onClick={() => signIn("student", mockEmail.trim() || undefined)} 
                      className={`${styles.mockBtn} ${styles.studentMock}`}
                    >
                      <BookOpen size={16} />
                      <span>เข้าชมในฐานะ (นักเรียน)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature Section */}
      <div className={styles.features}>
        <div className={styles.featureItem}>
          <div className={styles.featIconBox}>
            <BookOpen className={styles.featIcon} />
          </div>
          <h3>เรียนรู้ด้วย Canva</h3>
          <p>เข้าศึกษาเนื้อหาบทเรียนที่ครูแชร์ผ่าน Canva Presentation และสื่อ YouTube แบบเต็มรูปแบบในที่เดียว</p>
        </div>
        <div className={styles.featureItem}>
          <div className={styles.featIconBox}>
            <Layers className={styles.featIcon} />
          </div>
          <h3>กระดานส่งงานเรียลไทม์</h3>
          <p>แชร์ผลงานของคุณผ่านกระดานส่งงาน ร่วมโหวตผลงานยอดเยี่ยมด้วยปุ่มไลค์ และเขียนคอมเมนต์ติชมสร้างสรรค์</p>
        </div>
        <div className={styles.featureItem}>
          <div className={styles.featIconBox}>
            <ShieldAlert className={styles.featIcon} />
          </div>
          <h3>ล็อกอินปลอดภัย</h3>
          <p>ใช้ระบบ Google Sign-in ในการระบุตัวตน ปกป้องคะแนนและการส่งงานของนักเรียนทุกคน</p>
        </div>
      </div>
    </div>
  );
}
