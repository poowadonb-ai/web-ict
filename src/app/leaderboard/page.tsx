"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { authService, getCardPool, syncCardsFromFirestore, UserProfile } from "@/lib/firebase";
import { Trophy, Medal, Crown, RefreshCw, Filter } from "lucide-react";
import styles from "./page.module.css";

interface LeaderboardEntry {
  student: UserProfile;
  holoCount: number;
  legendaryCount: number;
  epicCount: number;
  rareCount: number;
  commonCount: number;
  totalCards: number;
  score: number;
}

function getCardCounts(student: UserProfile) {
  const cards = student.cardsCollected || [];
  let holo = 0, legendary = 0, epic = 0, rare = 0, common = 0;
  cards.forEach((c) => {
    const card = getCardPool().find((p) => p.id === c.cardId);
    if (!card) return;
    const count = c.count || 0;
    if (card.rarity === "holographic") holo += count;
    else if (card.rarity === "legendary") legendary += count;
    else if (card.rarity === "epic") epic += count;
    else if (card.rarity === "rare") rare += count;
    else common += count;
  });
  return { holo, legendary, epic, rare, common, total: holo + legendary + epic + rare + common };
}

// Weighted score for ranking
function calcScore(counts: ReturnType<typeof getCardCounts>) {
  return counts.holo * 10000 + counts.legendary * 500 + counts.epic * 50 + counts.rare * 10 + counts.common;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      await syncCardsFromFirestore();
      const students = await authService.getRegisteredStudents();
      const ranked: LeaderboardEntry[] = students.map((s) => {
        const counts = getCardCounts(s);
        return {
          student: s,
          holoCount: counts.holo,
          legendaryCount: counts.legendary,
          epicCount: counts.epic,
          rareCount: counts.rare,
          commonCount: counts.common,
          totalCards: counts.total,
          score: calcScore(counts),
        };
      });
      ranked.sort((a, b) => b.score - a.score || b.totalCards - a.totalCards);
      setEntries(ranked);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดตารางผู้นำ...</p>
      </div>
    );
  }

  const filtered = entries.filter(e =>
    selectedRoom === "all" || `${e.student.grade || "4"}-${e.student.room}` === selectedRoom
  );

  const myRank = filtered.findIndex(e => e.student.uid === user?.uid) + 1;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Trophy className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">ตารางผู้นำ</h1>
            <p className={styles.subtitle}>จัดอันดับตามความหายากของการ์ดสะสม</p>
          </div>
        </div>
        <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <RefreshCw size={16} />
          <span>รีเฟรช</span>
        </button>
      </header>

      {/* Filter */}
      <div className={`${styles.filterBar} glass-container`}>
        <Filter size={18} style={{ color: "var(--text-secondary)" }} />
        <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className={styles.filterSelect}>
          <option value="all">ทุกห้องเรียน</option>
          <optgroup label="ม.4">
            {["2","3","4","5","6","12","13"].map(r => (
              <option key={`4-${r}`} value={`4-${r}`}>ม.4/{r}</option>
            ))}
          </optgroup>
          <optgroup label="ม.5">
            {["2","3"].map(r => (
              <option key={`5-${r}`} value={`5-${r}`}>ม.5/{r}</option>
            ))}
          </optgroup>
        </select>
        {myRank > 0 && user?.role === "student" && (
          <span className={styles.myRankBadge}>อันดับของคุณ: #{myRank}</span>
        )}
      </div>

      {/* Top 3 Podium */}
      {filtered.length >= 3 && (
        <div className={styles.podium}>
          {/* 2nd */}
          <div className={`${styles.podiumItem} ${styles.podiumSecond}`}>
            <Medal className={styles.medalSilver} size={32} />
            <div className={styles.podiumName}>{filtered[1].student.fullName?.split(" ")[0]}</div>
            <div className={styles.podiumRoom}>ม.{filtered[1].student.grade || "4"}/{filtered[1].student.room}</div>
            <div className={styles.podiumCards}>{filtered[1].totalCards} ใบ</div>
            <div className={`${styles.podiumBase} ${styles.podiumBase2}`}>#2</div>
          </div>
          {/* 1st */}
          <div className={`${styles.podiumItem} ${styles.podiumFirst}`}>
            <Crown className={styles.crownGold} size={40} />
            <div className={styles.podiumName}>{filtered[0].student.fullName?.split(" ")[0]}</div>
            <div className={styles.podiumRoom}>ม.{filtered[0].student.grade || "4"}/{filtered[0].student.room}</div>
            <div className={styles.podiumCards}>{filtered[0].totalCards} ใบ</div>
            {filtered[0].holoCount > 0 && <div className={styles.holoBadge}>✨ HOLO x{filtered[0].holoCount}</div>}
            <div className={`${styles.podiumBase} ${styles.podiumBase1}`}>#1</div>
          </div>
          {/* 3rd */}
          <div className={`${styles.podiumItem} ${styles.podiumThird}`}>
            <Medal className={styles.medalBronze} size={32} />
            <div className={styles.podiumName}>{filtered[2].student.fullName?.split(" ")[0]}</div>
            <div className={styles.podiumRoom}>ม.{filtered[2].student.grade || "4"}/{filtered[2].student.room}</div>
            <div className={styles.podiumCards}>{filtered[2].totalCards} ใบ</div>
            <div className={`${styles.podiumBase} ${styles.podiumBase3}`}>#3</div>
          </div>
        </div>
      )}

      {/* Full List */}
      <div className={`${styles.tableWrapper} glass-container`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>อันดับ</th>
              <th>ชื่อ-นามสกุล</th>
              <th>ห้อง</th>
              <th style={{ color: "#e879f9" }}>✨ Holo</th>
              <th style={{ color: "#fbbf24" }}>🟠 Legend</th>
              <th style={{ color: "#a855f7" }}>🟣 Epic</th>
              <th style={{ color: "#3b82f6" }}>🔵 Rare</th>
              <th style={{ color: "#9ca3af" }}>⬜ Common</th>
              <th>รวม</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 30).map((entry, idx) => {
              const isMe = entry.student.uid === user?.uid;
              return (
                <tr key={entry.student.uid} className={isMe ? styles.myRow : ""}>
                  <td className={styles.rankCell}>
                    <div className={styles.rankWrapper}>
                      {idx === 0 && <Crown size={18} style={{ color: "#fbbf24" }} />}
                      {idx === 1 && <Medal size={18} style={{ color: "#d1d5db" }} />}
                      {idx === 2 && <Medal size={18} style={{ color: "#cd7c3a" }} />}
                      {idx > 2 && <span className={styles.rankNum}>#{idx + 1}</span>}
                    </div>
                  </td>
                  <td className={styles.nameCell}>
                    <div className={styles.nameWrapper}>
                      {entry.student.fullName}
                      {isMe && <span className={styles.meBadge}>คุณ</span>}
                    </div>
                  </td>
                  <td>ม.{entry.student.grade || "4"}/{entry.student.room}</td>
                  <td className={styles.holoCell}>{entry.holoCount > 0 ? `✨ ${entry.holoCount}` : "-"}</td>
                  <td>{entry.legendaryCount > 0 ? entry.legendaryCount : "-"}</td>
                  <td>{entry.epicCount > 0 ? entry.epicCount : "-"}</td>
                  <td>{entry.rareCount > 0 ? entry.rareCount : "-"}</td>
                  <td>{entry.commonCount > 0 ? entry.commonCount : "-"}</td>
                  <td><strong>{entry.totalCards}</strong></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "30px" }}>ยังไม่มีข้อมูลนักเรียน</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
