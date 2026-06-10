"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, CARD_POOL, UserProfile } from "@/lib/firebase";
import { BookOpen } from "lucide-react";
import styles from "./page.module.css";

const RARITY_ORDER = ["holographic", "legendary", "epic", "rare", "common"];

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  holographic: { label: "โฮโลกราฟิก", color: "#e879f9", bg: "rgba(236, 72, 153, 0.15)", glow: "rgba(236, 72, 153, 0.6)" },
  legendary: { label: "ตำนาน", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", glow: "rgba(251, 191, 36, 0.6)" },
  epic: { label: "มหากาพย์", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", glow: "rgba(168, 85, 247, 0.5)" },
  rare: { label: "หายาก", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", glow: "rgba(59, 130, 246, 0.4)" },
  common: { label: "ทั่วไป", color: "#9ca3af", bg: "rgba(156, 163, 175, 0.08)", glow: "rgba(156, 163, 175, 0.2)" },
};

const renderStars = (rarity: string) => {
  let count = 2;
  let color = "var(--text-muted)";
  if (rarity === "rare") { count = 3; color = "#60a5fa"; }
  else if (rarity === "epic") { count = 4; color = "#c084fc"; }
  else if (rarity === "legendary") { count = 5; color = "#fbbf24"; }
  else if (rarity === "holographic") { count = 6; color = "#f472b6"; }
  
  return (
    <div className={styles.rarityStars} style={{ color }}>
      {"★".repeat(count)}
    </div>
  );
};

export default function AlbumPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      authService.getRegisteredStudents().then(students => {
        const me = students.find(s => s.uid === user.uid) || null;
        setProfile(me);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดอัลบั้มการ์ด...</p>
      </div>
    );
  }

  const owned = profile?.cardsCollected || [];
  const getCount = (cardId: string) => {
    const found = owned.find(c => c.cardId === cardId);
    return found ? (found.count || 0) : 0;
  };

  const totalCards = CARD_POOL.length;
  const ownedUnique = CARD_POOL.filter(card => getCount(card.id) > 0).length;
  const completionPct = Math.round((ownedUnique / totalCards) * 100);

  const filteredCards = filterRarity === "all"
    ? [...CARD_POOL].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    : CARD_POOL.filter(c => c.rarity === filterRarity);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <BookOpen className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">อัลบั้มการ์ด</h1>
            <p className={styles.subtitle}>สะสมครบทุกใบ กลายเป็นผู้พิชิต ICT!</p>
          </div>
        </div>
      </header>

      {/* Progress Section */}
      <div className={`${styles.progressSection} glass-container`}>
        <div className={styles.progressInfo}>
          <span className={styles.progressText}>ความสมบูรณ์ของอัลบั้ม</span>
          <span className={styles.progressCount}>{ownedUnique} / {totalCards} ใบ ({completionPct}%)</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
        </div>
        {completionPct === 100 && (
          <div className={styles.completeMsg}>🎉 คุณสะสมครบทุกใบแล้ว! ยอดเยี่ยมมาก!</div>
        )}
      </div>

      {/* Filter */}
      <div className={styles.filterRow}>
        {["all", ...RARITY_ORDER].map(r => {
          const cfg = r === "all" ? null : RARITY_CONFIG[r];
          return (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`${styles.filterBtn} ${filterRarity === r ? styles.filterBtnActive : ""}`}
              style={filterRarity === r && cfg ? { borderColor: cfg.color, color: cfg.color, background: cfg.bg } : {}}
            >
              {r === "all" ? "ทั้งหมด" : cfg!.label}
            </button>
          );
        })}
      </div>

      {/* Card Grid */}
      <div className={styles.grid}>
        {filteredCards.map(card => {
          const count = getCount(card.id);
          const hasCard = count > 0;
          const cfg = RARITY_CONFIG[card.rarity];
          const isHolo = card.rarity === "holographic";

          let rarityClass = styles.rarityCommon;
          if (card.rarity === "rare") rarityClass = styles.rarityRare;
          else if (card.rarity === "epic") rarityClass = styles.rarityEpic;
          else if (card.rarity === "legendary") rarityClass = styles.rarityLegendary;
          else if (card.rarity === "holographic") rarityClass = styles.rarityHolographic;

          return (
            <div
              key={card.id}
              className={`${styles.cardSlot} ${hasCard ? styles.owned : styles.locked} ${rarityClass}`}
            >
              {hasCard && <div className={styles.bgGlow} />}
              {hasCard && card.rarity === "legendary" && <div className={styles.legendaryRays} />}
              {hasCard && card.rarity === "holographic" && <div className={styles.holoFoil} />}
              {hasCard && (card.rarity === "epic" || card.rarity === "legendary" || card.rarity === "holographic") && (
                <div className={styles.particles}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              {hasCard && <div className={styles.shineSweep} />}

              {/* Rarity Badge & Stars */}
              <div className={styles.rarityHeader}>
                <div className={styles.rarityBadge} style={{ color: cfg.color, background: cfg.bg }}>
                  {cfg.label}
                </div>
                {renderStars(card.rarity)}
              </div>

              {/* Card Image or Silhouette */}
              <div className={styles.cardImageArea}>
                {hasCard ? (
                  card.imageUrl === "__HOLOGRAPHIC__" || imageErrors[card.id] ? (
                    <div className={styles.cyberHoloFallback}>
                      <div className={styles.cyberGrid} />
                      <div className={styles.cyberHoloRing} />
                      <div className={styles.cyberHoloSymbol}>✨</div>
                    </div>
                  ) : (
                    <img 
                      src={card.imageUrl} 
                      alt={card.name} 
                      className={styles.cardImg} 
                      onError={() => setImageErrors(prev => ({ ...prev, [card.id]: true }))}
                    />
                  )
                ) : (
                  <div className={styles.silhouette}>
                    <div className={styles.silhouetteInner}>???</div>
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div className={styles.cardInfo}>
                {hasCard ? (
                  <>
                    <div className={styles.cardName}>{card.name}</div>
                    <div className={styles.cardDesc}>{card.description}</div>
                    {count > 1 && <div className={styles.countBadge}>x{count}</div>}
                  </>
                ) : (
                  <>
                    <div className={styles.cardName} style={{ color: "#374151" }}>???</div>
                    <div className={styles.lockedMsg}>ยังไม่ได้รับการ์ดนี้</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
