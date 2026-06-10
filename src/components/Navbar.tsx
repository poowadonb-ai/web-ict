"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut, BookOpen, Layers, User, Award, ClipboardList, Gift } from "lucide-react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  if (!user) return null; // No navbar if user is not logged in

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/classroom" className={styles.logo}>
          <Award className={styles.logoIcon} />
          <span className="gradient-text-neon">ICT CLASSROOM</span>
        </Link>

        <nav className={styles.nav}>
          <Link 
            href="/classroom" 
            className={`${styles.navLink} ${isActive("/classroom") ? styles.active : ""}`}
          >
            <BookOpen size={18} />
            <span>บทเรียน</span>
          </Link>
          <Link 
            href="/padlet" 
            className={`${styles.navLink} ${isActive("/padlet") ? styles.active : ""}`}
          >
            <Layers size={18} />
            <span>กระดานส่งงาน</span>
          </Link>
          {user?.role === "student" && (
            <>
              <Link 
                href="/my-tasks" 
                className={`${styles.navLink} ${isActive("/my-tasks") ? styles.active : ""}`}
              >
                <ClipboardList size={18} />
                <span>งานของฉัน</span>
              </Link>
              <Link 
                href="/cards" 
                className={`${styles.navLink} ${isActive("/cards") ? styles.active : ""}`}
              >
                <Gift size={18} />
                <span>การ์ดของฉัน</span>
              </Link>
            </>
          )}
          {user?.role === "teacher" && (
            <>
              <Link 
                href="/gradebook" 
                className={`${styles.navLink} ${isActive("/gradebook") ? styles.active : ""}`}
              >
                <ClipboardList size={18} />
                <span>สมุดคะแนน</span>
              </Link>
              <Link 
                href="/teacher/cards" 
                className={`${styles.navLink} ${isActive("/teacher/cards") ? styles.active : ""}`}
              >
                <Gift size={18} />
                <span>แจกการ์ด</span>
              </Link>
            </>
          )}
        </nav>

        <div className={styles.profileArea}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <User size={18} />
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user.fullName || user.displayName || "User"}</span>
              <span className={styles.userRole}>
                {user.role === "teacher" ? (
                  <span className={styles.badgeTeacher}>คุณครู</span>
                ) : (
                  <span className={styles.badgeStudent}>
                    {user.grade && user.room ? `ม.${user.grade}/${user.room}` : "นักเรียน"} 
                    {user.studentNo ? ` เลขที่ ${user.studentNo}` : ""}
                  </span>
                )}
              </span>
            </div>
          </div>

          <button onClick={signOut} className={styles.logoutBtn} title="ออกจากระบบ">
            <LogOut size={18} />
            <span className={styles.logoutText}>ออกระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
}
