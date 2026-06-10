"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Award, UserCheck, AlertCircle } from "lucide-react";
import styles from "./page.module.css";

export default function RegisterPage() {
  const { user, loading, registerProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");

  const [room, setRoom] = useState("2");
  const [studentNo, setStudentNo] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If not logged in, wait or redirect is handled by AuthProvider.
    // If user is already registered, redirect to classroom
    if (user && user.isRegistered) {
      router.push("/classroom");
    }
  }, [user, router]);

  if (loading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดข้อมูลผู้ใช้...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
        grade: "4", // Hard lock to ม.4
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

  return (
    <div className={styles.container}>
      <div className={`${styles.card} glass-container`}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Award className={styles.icon} />
          </div>
          <h1 className="gradient-text">ลงทะเบียนนักเรียนครั้งแรก</h1>
          <p className={styles.subtitle}>กรุณากรอกข้อมูลจริงเพื่อใช้ในการบันทึกคะแนนและส่งงาน</p>
        </div>

        <div className={styles.userBrief}>
          <span className={styles.emailLabel}>อีเมลที่เข้าสู่ระบบ:</span>
          <span className={styles.emailVal}>{user.email}</span>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
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
                value="4"
                disabled={true}
              >
                <option value="4">มัธยมศึกษาปีที่ 4 (ม.4)</option>
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
                <option value="2">ม.4/2</option>
                <option value="3">ม.4/3</option>
                <option value="4">ม.4/4</option>
                <option value="5">ม.4/5</option>
                <option value="6">ม.4/6</option>
                <option value="12">ม.4/12</option>
                <option value="13">ม.4/13</option>
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
      </div>
    </div>
  );
}
