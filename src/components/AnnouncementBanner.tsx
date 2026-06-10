"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { announcementService, Announcement } from "@/lib/firebase";
import { Megaphone, X, Pin, Plus, Trash2 } from "lucide-react";
import styles from "./AnnouncementBanner.module.css";

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = announcementService.subscribeAnnouncements(setAnnouncements);
    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  const isTeacher = user?.role === "teacher";

  const visible = announcements
    .filter(a => !dismissed.includes(a.id))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt)
    .slice(0, isTeacher ? 999 : 3);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await announcementService.addAnnouncement(
        newTitle,
        newContent,
        user?.fullName || user?.displayName || "คุณครู",
        isPinned
      );
      setNewTitle(""); setNewContent(""); setIsPinned(false); setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ลบประกาศนี้ใช่หรือไม่?")) return;
    await announcementService.deleteAnnouncement(id);
  };

  if (visible.length === 0 && !isTeacher) return null;

  return (
    <div className={styles.wrapper}>
      {visible.map(ann => (
        <div key={ann.id} className={`${styles.banner} ${ann.pinned ? styles.pinned : ""}`}>
          <div className={styles.bannerLeft}>
            {ann.pinned ? <Pin size={16} className={styles.pinIcon} /> : <Megaphone size={16} className={styles.megaIcon} />}
            <div>
              <span className={styles.bannerTitle}>{ann.title}</span>
              <span className={styles.bannerContent}> — {ann.content}</span>
              <span className={styles.bannerMeta}>โดย {ann.authorName} · {new Date(ann.createdAt).toLocaleDateString("th-TH")}</span>
            </div>
          </div>
          <div className={styles.bannerActions}>
            {isTeacher && (
              <button onClick={() => handleDelete(ann.id)} className={styles.deleteBtn} title="ลบประกาศ">
                <Trash2 size={14} />
              </button>
            )}
            {!isTeacher && (
              <button onClick={() => setDismissed(p => [...p, ann.id])} className={styles.closeBtn}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      ))}

      {isTeacher && (
        <div className={styles.teacherBar}>
          <button onClick={() => setShowForm(!showForm)} className={styles.addBtn}>
            <Plus size={14} />
            เพิ่มประกาศ
          </button>
          {showForm && (
            <form onSubmit={handleAdd} className={styles.form}>
              <input
                placeholder="หัวข้อประกาศ"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className={styles.input}
                required
                disabled={saving}
              />
              <input
                placeholder="เนื้อหาประกาศ"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className={styles.input}
                required
                disabled={saving}
              />
              <label className={styles.pinLabel}>
                <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
                ปักหมุด (แสดงก่อน)
              </label>
              <button type="submit" className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "โพสต์ประกาศ"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                ยกเลิก
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
