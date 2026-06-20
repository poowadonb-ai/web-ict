"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, getCardPool, syncCardsFromFirestore } from "@/lib/supabase";
import { UserProfile, Card } from "@/lib/types";
import { BookOpen, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import styles from "./page.module.css";

const RARITY_ORDER = ["holographic", "legendary", "epic", "rare", "common"];

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  holographic: { label: "SSS", color: "#e879f9", bg: "rgba(236, 72, 153, 0.15)", glow: "rgba(236, 72, 153, 0.6)" },
  legendary: { label: "SS", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", glow: "rgba(251, 191, 36, 0.6)" },
  epic: { label: "S", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", glow: "rgba(168, 85, 247, 0.5)" },
  rare: { label: "A", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", glow: "rgba(59, 130, 246, 0.4)" },
  common: { label: "B", color: "#9ca3af", bg: "rgba(156, 163, 175, 0.08)", glow: "rgba(156, 163, 175, 0.2)" },
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

  // 3D Card Viewer states
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const [shimmerStyle, setShimmerStyle] = useState<React.CSSProperties>({});
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCard(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isHovered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTiltStyle({
        transform: `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(${zoomScale})`,
        transition: "transform 0.3s ease",
      });
    }
  }, [zoomScale, isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const px = x / box.width - 0.5;
    const py = y / box.height - 0.5;
    const rotateX = -py * 25;
    const rotateY = px * 25;
    const shimmerX = (x / box.width) * 100;
    const shimmerY = (y / box.height) * 100;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${zoomScale})`,
      transition: "none",
    });

    setShimmerStyle({
      "--shimmer-x": `${shimmerX}%`,
      "--shimmer-y": `${shimmerY}%`,
      opacity: 0.65,
    } as React.CSSProperties);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTiltStyle({
      transform: `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(${zoomScale})`,
      transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
    });
    setShimmerStyle({
      opacity: 0,
      transition: "opacity 0.5s ease",
    });
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      syncCardsFromFirestore().then(() => {
        authService.getStudentProfile(user.uid).then(me => {
          setProfile(me);
          setLoading(false);
        }).catch(() => setLoading(false));
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

  const totalCards = getCardPool().length;
  const ownedUnique = getCardPool().filter(card => getCount(card.id) > 0).length;
  const completionPct = Math.round((ownedUnique / totalCards) * 100);

  const filteredCards = filterRarity === "all"
    ? [...getCardPool()].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    : getCardPool().filter(c => c.rarity === filterRarity);

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

          let rarityClass = styles.rarityCommon;
          if (card.rarity === "rare") rarityClass = styles.rarityRare;
          else if (card.rarity === "epic") rarityClass = styles.rarityEpic;
          else if (card.rarity === "legendary") rarityClass = styles.rarityLegendary;
          else if (card.rarity === "holographic") rarityClass = styles.rarityHolographic;

          return (
            <div
              key={card.id}
              className={`${styles.cardSlot} ${hasCard ? styles.owned : styles.locked} ${rarityClass}`}
              onClick={() => {
                if (hasCard) {
                  setSelectedCard(card);
                  setZoomScale(1.0);
                  setIsHovered(false);
                  setTiltStyle({
                    transform: `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1.0)`,
                  });
                  setShimmerStyle({
                    opacity: 0,
                  });
                }
              }}
              style={hasCard ? { cursor: "pointer" } : undefined}
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
                    /* eslint-disable-next-line @next/next/no-img-element */
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

      {/* 3D Card Viewer Modal */}
      {selectedCard && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCard(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setSelectedCard(null)} aria-label="ปิด">
              <X size={24} />
            </button>
            
            <div className={styles.viewerRow}>
              {/* Left Column: 3D Interactive Card */}
              <div className={styles.viewerColumn}>
                <div className={styles.largeCardWrapper}>
                  <div 
                    className={`${styles.largeCard} ${
                      selectedCard.rarity === "rare" ? styles.rarityRare :
                      selectedCard.rarity === "epic" ? styles.rarityEpic :
                      selectedCard.rarity === "legendary" ? styles.rarityLegendary :
                      selectedCard.rarity === "holographic" ? styles.rarityHolographic :
                      styles.rarityCommon
                    }`}
                    style={tiltStyle}
                    onMouseMove={handleMouseMove}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className={styles.bgGlow} />
                    {selectedCard.rarity === "legendary" && <div className={styles.legendaryRays} />}
                    {selectedCard.rarity === "holographic" && <div className={styles.holoFoil} />}
                    
                    {/* The Interactive Shimmer Overlay */}
                    <div 
                      className={styles.holoShimmerOverlay} 
                      style={shimmerStyle}
                    />

                    {/* Card Particles for Epic/Legendary/Holo */}
                    {(selectedCard.rarity === "epic" || selectedCard.rarity === "legendary" || selectedCard.rarity === "holographic") && (
                      <div className={styles.particles}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    )}
                    <div className={styles.shineSweep} />

                    <div className={styles.rarityHeader}>
                      <div className={styles.rarityBadge} style={{ 
                        color: RARITY_CONFIG[selectedCard.rarity].color, 
                        background: RARITY_CONFIG[selectedCard.rarity].bg 
                      }}>
                        {RARITY_CONFIG[selectedCard.rarity].label}
                      </div>
                      {renderStars(selectedCard.rarity)}
                    </div>

                    <div className={styles.largeCardImageArea}>
                      {selectedCard.imageUrl === "__HOLOGRAPHIC__" || imageErrors[selectedCard.id] ? (
                        <div className={styles.cyberHoloFallback}>
                          <div className={styles.cyberGrid} />
                          <div className={styles.cyberHoloRing} />
                          <div className={styles.cyberHoloSymbol}>✨</div>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={selectedCard.imageUrl} 
                          alt={selectedCard.name} 
                          className={styles.cardImg} 
                        />
                      )}
                    </div>

                    <div className={styles.largeCardInfo}>
                      <div className={styles.largeCardName}>{selectedCard.name}</div>
                      <div className={styles.largeCardRarityName} style={{ color: RARITY_CONFIG[selectedCard.rarity].color }}>
                        ระดับ: {
                          selectedCard.rarity === "holographic" ? "Holographic (SSS)" :
                          selectedCard.rarity === "legendary" ? "Legendary (SS)" :
                          selectedCard.rarity === "epic" ? "Epic (S)" :
                          selectedCard.rarity === "rare" ? "Rare (A)" :
                          "Common (B)"
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className={styles.controlsRow}>
                  <button 
                    className={styles.controlBtn} 
                    onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.1))}
                    title="ซูมออก"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <span className={styles.zoomValue}>{Math.round(zoomScale * 100)}%</span>
                  <button 
                    className={styles.controlBtn} 
                    onClick={() => setZoomScale(prev => Math.min(2.0, prev + 0.1))}
                    title="ซูมเข้า"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button 
                    className={styles.controlBtn} 
                    onClick={() => setZoomScale(1.0)}
                    title="รีเซ็ต"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>

              {/* Right Column: Card Details Info */}
              <div className={styles.detailsColumn}>
                <div className={styles.detailsHeader}>
                  <span className={styles.categoryBadge}>ข้อมูลการ์ด</span>
                  <h2 className={styles.detailsTitle}>{selectedCard.name}</h2>
                  <div className={styles.bonusPointsBadge}>
                    โบนัสคะแนน: +{selectedCard.bonusPoints || 0} คะแนน
                  </div>
                </div>

                <div className={styles.detailsDivider} />

                <div className={styles.detailsBody}>
                  <div className={styles.infoSection}>
                    <h4>คำอธิบายการ์ด</h4>
                    <p className={styles.detailsDesc}>{selectedCard.description || "ไม่มีคำอธิบายสำหรับการ์ดใบนี้"}</p>
                  </div>

                  <div className={styles.infoSection}>
                    <h4>ประเภทความสามารถ</h4>
                    <p className={styles.detailsType}>
                      {selectedCard.type === "cosmetic" ? "🎨 ตกแต่งโปรไฟล์ความสวยงาม" :
                       selectedCard.type === "bonus" ? "⭐ เพิ่มคะแนนพิเศษเมื่อสะสมสำเร็จ" :
                       selectedCard.type === "privilege" ? "🔑 สิทธิพิเศษในการเรียนการสอน" :
                       selectedCard.type === "computer_act" ? "⚖️ การ์ด พรบ คอมพิวเตอร์ (Rank A)" :
                       "🃏 การ์ดสะสมทั่วไป"}
                    </p>
                  </div>
                </div>

                <div className={styles.detailsDivider} />
                
                <div className={styles.interactionTip}>
                  💡 เคล็ดลับ: เลื่อนเมาส์บนตัวการ์ดเพื่อเอียงมุมมอง 3 มิติ และสะท้อนแสงฟอยล์พิเศษ!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
