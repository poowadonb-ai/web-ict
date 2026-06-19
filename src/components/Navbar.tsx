"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LogOut, BookOpen, Layers, Award, ClipboardList, Gift,
  BarChart3, Trophy, Menu, X, User, ChevronDown, Sparkles
} from "lucide-react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const close = () => setProfileOpen(false);
    window.addEventListener("click", close, { capture: true });
    return () => window.removeEventListener("click", close, { capture: true });
  }, [profileOpen]);

  if (!user) return null;

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const handleLinkClick = () => {
    setIsOpen(false);
    setProfileOpen(false);
  };

  const handleSignOut = () => {
    setIsOpen(false);
    setProfileOpen(false);
    signOut();
  };

  const studentLinks = [
    { href: "/classroom", icon: <BookOpen size={17} />, label: "บทเรียน" },
    { href: "/padlet",    icon: <Layers size={17} />,   label: "กระดานส่งงาน" },
    { href: "/my-tasks",  icon: <ClipboardList size={17} />, label: "งานของฉัน" },
    { href: "/cards",     icon: <Gift size={17} />,     label: "การ์ดของฉัน" },
    { href: "/album",     icon: <BookOpen size={17} />, label: "อัลบั้ม" },
    { href: "/leaderboard", icon: <Trophy size={17} />, label: "ตารางผู้นำ" },
  ];

  const teacherLinks = [
    { href: "/classroom",        icon: <BookOpen size={17} />,      label: "บทเรียน" },
    { href: "/padlet",           icon: <Layers size={17} />,        label: "กระดานส่งงาน" },
    { href: "/gradebook",        icon: <ClipboardList size={17} />, label: "สมุดคะแนน" },
    { href: "/teacher/dashboard", icon: <BarChart3 size={17} />,    label: "แดชบอร์ด" },
    { href: "/teacher/students",  icon: <User size={17} />,         label: "นักเรียน" },
    { href: "/teacher/cards",     icon: <Gift size={17} />,         label: "แจกการ์ด" },
    { href: "/leaderboard",       icon: <Trophy size={17} />,       label: "ตารางผู้นำ" },
  ];

  const links = user.role === "teacher" ? teacherLinks : studentLinks;

  const avatarUrl = (user as any).photoURL || null;
  const displayName = user.fullName || user.displayName || "User";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/classroom" className={styles.logo} onClick={handleLinkClick}>
          <Award className={styles.logoIcon} />
          <span className="gradient-text-neon">ICT CLASSROOM</span>
        </Link>

        {/* Mobile toggle */}
        <button
          className={styles.menuToggle}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`${styles.navWrapper} ${isOpen ? styles.navOpen : ""}`}>
          {/* Nav links */}
          <nav className={styles.nav}>
            {links.map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={handleLinkClick}
                className={`${styles.navLink} ${isActive(href) ? styles.active : ""}`}
              >
                {icon}
                <span>{label}</span>
                {isActive(href) && <span className={styles.activeIndicator} />}
              </Link>
            ))}
          </nav>

          {/* Profile area */}
          <div className={styles.profileArea}>
            {/* Profile dropdown button */}
            <div className={styles.profileDropdownWrapper}>
              <button
                className={styles.profileBtn}
                onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
              >
                <div className={styles.avatar}>
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={32}
                      height={32}
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span className={styles.avatarInitials}>{initials}</span>
                  )}
                  <span className="status-dot online" style={{ position: "absolute", bottom: -1, right: -1 }} />
                </div>
                <div className={styles.userDetails}>
                  <span className={styles.userName}>{displayName}</span>
                  <span className={styles.userRole}>
                    {user.role === "teacher" ? (
                      <span className={styles.badgeTeacher}>
                        <Sparkles size={10} style={{ display: "inline", marginRight: 3 }} />
                        คุณครู
                      </span>
                    ) : (
                      <span className={styles.badgeStudent}>
                        {user.grade && user.room ? `ม.${user.grade}/${user.room}` : "นักเรียน"}
                        {user.studentNo ? ` · เลขที่ ${user.studentNo}` : ""}
                      </span>
                    )}
                  </span>
                </div>
                <ChevronDown
                  size={15}
                  className={`${styles.chevron} ${profileOpen ? styles.chevronOpen : ""}`}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownAvatar}>
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt={displayName} width={42} height={42} className={styles.avatarImg} />
                      ) : (
                        <span className={styles.avatarInitials} style={{ fontSize: "1.1rem" }}>{initials}</span>
                      )}
                    </div>
                    <div>
                      <div className={styles.dropdownName}>{displayName}</div>
                      <div className={styles.dropdownEmail}>
                        {user.role === "teacher"
                          ? (user.email || "")
                          : (user.grade && user.room ? `ม.${user.grade}/${user.room} เลขที่ ${user.studentNo || ""}` : "")}
                      </div>
                    </div>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <button onClick={handleSignOut} className={styles.dropdownSignOut}>
                    <LogOut size={16} />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
