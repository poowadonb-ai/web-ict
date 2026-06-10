"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, cardService, CARD_POOL, Card, UserProfile, RedemptionRequest } from "@/lib/firebase";
import { Sparkles, Gift, Award, CheckCircle, RefreshCw, X, ShieldAlert } from "lucide-react";
import styles from "./page.module.css";

export default function StudentCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [studentProfile, setStudentProfile] = useState<UserProfile | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "common" | "rare" | "epic" | "legendary">("all");

  // Gacha states
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false]);
  const [isGachaMode, setIsGachaMode] = useState(false);

  // Modal / Detail state
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [successRedeemMsg, setSuccessRedeemMsg] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetchedStudents = await authService.getRegisteredStudents();
      const me = fetchedStudents.find(s => s.uid === user.uid) || null;
      setStudentProfile(me);

      const allRedemptions = await cardService.getRedemptions();
      const myRedemptions = allRedemptions.filter(r => r.studentUid === user.uid);
      setRedemptions(myRedemptions);
    } catch (err) {
      console.error("Error loading student cards data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "student") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดอัลบั้มการ์ดสะสม...</p>
      </div>
    );
  }

  const enterGachaMode = () => {
    if (!user || !studentProfile || (studentProfile.packsCount || 0) <= 0) return;
    setIsGachaMode(true);
    setIsOpeningPack(false);
    setOpenedCards([]);
    setFlippedCards([false, false, false]);
  };

  const handleOpenPack = async () => {
    if (!user || !studentProfile) return;
    setIsOpeningPack(true);
    try {
      // Shake animation time
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newCards = await cardService.openPack(user.uid);
      setOpenedCards(newCards);
      setIsOpeningPack(false);
    } catch (err) {
      console.error("Error opening pack:", err);
      setIsGachaMode(false);
      setIsOpeningPack(false);
    }
  };

  const handleFlipCard = (index: number) => {
    setFlippedCards(prev => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });
  };

  const handleCloseGacha = async () => {
    setIsGachaMode(false);
    setOpenedCards([]);
    setFlippedCards([false, false, false]);
    await loadData();
  };

  const handleRedeemCard = async (card: Card) => {
    if (!user) return;
    setRedeemLoading(true);
    try {
      const req = await cardService.requestRedemption(user.uid, card.id);
      if (req) {
        setSuccessRedeemMsg(`ส่งขอคำร้องรับคะแนนพิเศษ +${card.bonusPoints} คะแนนเรียบร้อยแล้ว รอครูอนุมัติ!`);
        setTimeout(() => setSuccessRedeemMsg(""), 4000);
        await loadData();
        // Update selected card modal state
        setSelectedCard(null);
      }
    } catch (err) {
      console.error("Error redeeming card:", err);
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleExchangeCommonCards = async () => {
    if (!user) return;
    setExchangeLoading(true);
    try {
      const newCard = await cardService.exchangeCommonCards(user.uid);
      if (newCard) {
        setSuccessRedeemMsg(`🎉 ยินดีด้วย! คุณได้รับการ์ดใหม่จากการย่อยการ์ด: ${newCard.name}`);
        setTimeout(() => setSuccessRedeemMsg(""), 6000);
        await loadData();
      }
    } catch (err: any) {
      console.error("Error exchanging cards:", err);
      alert(err.message || "เกิดข้อผิดพลาดในการย่อยการ์ด");
    } finally {
      setExchangeLoading(false);
    }
  };

  // Helper: check card counts
  const getCardCount = (cardId: string) => {
    const coll = studentProfile?.cardsCollected || [];
    const item = coll.find(c => c.cardId === cardId);
    return item?.count || 0;
  };

  const getCardRedeemedCount = (cardId: string) => {
    const coll = studentProfile?.cardsCollected || [];
    const item = coll.find(c => c.cardId === cardId);
    return item?.redeemedCount || 0;
  };

  // Filter CARD_POOL
  const filteredCards = CARD_POOL.filter(card => {
    if (activeFilter === "all") return true;
    return card.rarity === activeFilter;
  });

  const totalCommonAvailable = (studentProfile?.cardsCollected || []).reduce((acc, item) => {
    const c = CARD_POOL.find(card => card.id === item.cardId);
    if (c && c.rarity === "common") {
      return acc + ((item.count || 0) - (item.redeemedCount || 0));
    }
    return acc;
  }, 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Sparkles className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">สมุดสะสมการ์ด & สุ่มกล่องของรางวัล</h1>
            <p className={styles.subtitle}>สะสมการ์ดความรู้วิชาไอซีที และแลกคะแนนโบนัสสุดแรร์</p>
          </div>
        </div>
        
        <div className={styles.headerScore}>
          <div className={styles.bonusBadge}>
            <Award size={18} />
            <span>โบนัสรวมสะสม: +{studentProfile?.bonusPoints || 0} คะแนน</span>
          </div>
          <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <RefreshCw size={16} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </header>

      {successRedeemMsg && (
        <div className={styles.successBanner}>
          <CheckCircle size={18} />
          <span>{successRedeemMsg}</span>
        </div>
      )}

      {/* Gacha Opening overlay */}
      {isGachaMode && (
        <div className={styles.gachaOverlay}>
          <div className={styles.gachaContainer}>
            {isOpeningPack ? (
              <div className={styles.lootboxArea}>
                <div className={`${styles.lootbox} ${styles.shaking}`}>🎁</div>
                <h2>กำลังสุ่มการ์ดไอซีที...</h2>
                <p>เตรียมพบกับการ์ดแรร์สุดพิเศษ!</p>
                <div className={styles.spinner}></div>
              </div>
            ) : openedCards.length === 0 ? (
              <div className={styles.lootboxArea}>
                <div className={styles.lootbox}>🎁</div>
                <h2>ซองการ์ดรอการเปิด!</h2>
                <p>กดปุ่มด้านล่างเพื่อเริ่มสุ่มการ์ดจำนวน 3 ใบ</p>
                <button className={styles.openPackMainBtn} onClick={handleOpenPack}>
                  ✨ เปิดกล่องสุ่มเลย!
                </button>
              </div>
            ) : (
              <div className={styles.revealArea}>
                <h2>เปิดซองการ์ดเรียบร้อย! คลิกเพื่อเปิดดูการ์ดทีละใบ</h2>
                
                <div className={styles.gachaCardsGrid}>
                  {openedCards.map((card, idx) => {
                    let rarityClass = styles.rarityCommon;
                    let rarityText = "ทั่วไป";
                    if (card.rarity === "rare") { rarityText = "หายาก"; rarityClass = styles.rarityRare; }
                    else if (card.rarity === "epic") { rarityText = "มหากาพย์"; rarityClass = styles.rarityEpic; }
                    else if (card.rarity === "legendary") { rarityText = "ตำนาน"; rarityClass = styles.rarityLegendary; }

                    return (
                      <div 
                        key={idx} 
                        className={`${styles.cardFlipContainer} ${flippedCards[idx] ? styles.flipped : ""}`}
                        onClick={() => handleFlipCard(idx)}
                      >
                        <div className={styles.cardInner}>
                          {/* Card Back */}
                          <div className={styles.cardBack}>
                            <div className={styles.cardBackDesign}>
                              <div className={styles.cardBackLogo}>ICT</div>
                              <p>LUCKY BOX</p>
                            </div>
                          </div>
                          
                          {/* Card Front */}
                          <div className={`${styles.cardFront} ${rarityClass}`}>
                            <div className={styles.cardOverlay}></div>
                            <img src={card.imageUrl} alt={card.name} className={styles.cardImg} />
                            <div className={styles.cardBody}>
                              <div className={styles.cardHeader}>
                                <span className={styles.cardRarityBadge}>{rarityText}</span>
                                {card.bonusPoints > 0 && (
                                  <span className={styles.cardPointsBadge}>+{card.bonusPoints} Pt</span>
                                )}
                              </div>
                              <h3 className={styles.cardTitle}>{card.name}</h3>
                              <p className={styles.cardDesc}>{card.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {flippedCards.every(f => f === true) && (
                  <button onClick={handleCloseGacha} className={styles.closeGachaBtn}>
                    🎒 เก็บเข้าคลังสะสม
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className={styles.mainGrid}>
        {/* Left Side: Packs & Statistics */}
        <div className={`${styles.statsColumn} glass-container`}>
          <div className={styles.packManager}>
            <h3>ซองการ์ดของฉัน</h3>
            <div className={styles.packStatusArea}>
              <div className={styles.packIcon}>📦</div>
              <div>
                <div className={styles.packNumber}>{studentProfile?.packsCount || 0} ซอง</div>
                <div className={styles.packLabel}>ซอง Gacha รอการเปิดสุ่ม</div>
              </div>
            </div>
            <button 
              onClick={enterGachaMode}
              disabled={!studentProfile || (studentProfile.packsCount || 0) <= 0}
              className={styles.openPackBtn}
            >
              <Gift size={18} />
              <span>เปิดซองของรางวัล (3 ใบ)</span>
            </button>
            <p className={styles.packHint}>
              * คุณครูจะแจกซองการ์ดให้เมื่อส่งงานยอดเยี่ยม หรือแจกให้รายบุคคลในชั่วโมงเรียนคอมพิวเตอร์
            </p>
          </div>

          <div className={styles.requestsTracker}>
            <h3>คำร้องขอคะแนนพิเศษที่อยู่ระหว่างตรวจสอบ</h3>
            {redemptions.filter(r => r.status === "pending").length === 0 ? (
              <p className={styles.noRequests}>ไม่มีคำขอที่กำลังรอตรวจสอบ</p>
            ) : (
              <div className={styles.requestList}>
                {redemptions.filter(r => r.status === "pending").map(req => (
                  <div key={req.id} className={styles.requestItem}>
                    <div className={styles.requestHeader}>
                      <span className={styles.reqCardName}>{req.cardName}</span>
                      <span className={styles.reqPoints}>+{req.bonusPoints} คะแนน</span>
                    </div>
                    <div className={styles.requestMeta}>
                      <span>สถานะ: รอครูอนุมัติ...</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Card Gallery */}
        <div className={`${styles.galleryColumn} glass-container`}>
          {/* Filters */}
          <div className={styles.filterBar}>
            <button 
              onClick={() => setActiveFilter("all")}
              className={`${styles.filterBtn} ${activeFilter === "all" ? styles.activeFilterBtn : ""}`}
            >
              ทั้งหมด
            </button>
            <button 
              onClick={() => setActiveFilter("common")}
              className={`${styles.filterBtn} ${activeFilter === "common" ? styles.activeFilterBtn : ""}`}
            >
              ทั่วไป (Common)
            </button>
            <button 
              onClick={() => setActiveFilter("rare")}
              className={`${styles.filterBtn} ${activeFilter === "rare" ? styles.activeFilterBtn : ""}`}
            >
              หายาก (Rare)
            </button>
            <button 
              onClick={() => setActiveFilter("epic")}
              className={`${styles.filterBtn} ${activeFilter === "epic" ? styles.activeFilterBtn : ""}`}
            >
              มหากาพย์ (Epic)
            </button>
            <button 
              onClick={() => setActiveFilter("legendary")}
              className={`${styles.filterBtn} ${activeFilter === "legendary" ? styles.activeFilterBtn : ""}`}
            >
              ตำนาน (Legendary)
            </button>
          </div>

          {/* Exchange Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px 16px", background: "rgba(255,255,255,0.05)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={16} color="#9ca3af" />
                <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#e2e8f0" }}>ระบบย่อยการ์ด (Recycle)</span>
              </div>
              <p style={{ fontSize: "0.85rem", margin: "4px 0 0 0", color: "#a0aec0" }}>
                การ์ดทั่วไปที่คุณมี: <span style={{ color: totalCommonAvailable >= 5 ? "#10b981" : "#f59e0b", fontWeight: "bold" }}>{totalCommonAvailable}</span> ใบ
                <br/>* ใช้การ์ดระดับทั่วไป 5 ใบ เพื่อสุ่มการ์ดใหม่ 1 ใบ
              </p>
            </div>
            <button 
              className="btn-primary"
              onClick={handleExchangeCommonCards}
              disabled={exchangeLoading || totalCommonAvailable < 5}
              style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 16px", opacity: totalCommonAvailable < 5 ? 0.5 : 1, background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", border: "none" }}
            >
              <RefreshCw size={16} />
              <span>สุ่มการ์ดใหม่ (-5 ใบ)</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className={styles.cardsGrid}>
            {filteredCards.map(card => {
              const count = getCardCount(card.id);
              const redeemed = getCardRedeemedCount(card.id);
              const unredeemedCount = count - redeemed;
              const isOwned = count > 0;

              let rarityClass = styles.rarityCommon;
              let rarityText = "ทั่วไป";
              if (card.rarity === "rare") { rarityText = "หายาก"; rarityClass = styles.rarityRare; }
              else if (card.rarity === "epic") { rarityText = "มหากาพย์"; rarityClass = styles.rarityEpic; }
              else if (card.rarity === "legendary") { rarityText = "ตำนาน"; rarityClass = styles.rarityLegendary; }

              return (
                <div 
                  key={card.id} 
                  className={`${styles.galleryCard} ${isOwned ? "" : styles.unowned} ${rarityClass}`}
                  onClick={() => isOwned && setSelectedCard(card)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.cardRarityBadge}>{rarityText}</span>
                    {card.bonusPoints > 0 && (
                      <span className={styles.cardPointsBadge}>+{card.bonusPoints} Pt</span>
                    )}
                  </div>
                  
                  {isOwned ? (
                    <img src={card.imageUrl} alt={card.name} className={styles.cardImg} />
                  ) : (
                    <div className={styles.silhouetteArea}>
                      <Gift className={styles.lockIcon} />
                      <span>ยังไม่ครอบครอง</span>
                    </div>
                  )}

                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{card.name}</h3>
                    {isOwned ? (
                      <div className={styles.ownedMeta}>
                        <span className={styles.ownedCount}>ครอบครอง: {count} ใบ</span>
                        {unredeemedCount > 0 ? (
                          <span className={styles.unredeemedBadge}>ใช้งานได้ {unredeemedCount} ใบ</span>
                        ) : (
                          card.rarity !== "common" && <span className={styles.fullyRedeemedBadge}>แลกคะแนนหมดแล้ว</span>
                        )}
                      </div>
                    ) : (
                      <p className={styles.unownedText}>ยังไม่พบการ์ดใบนี้</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (() => {
        const count = getCardCount(selectedCard.id);
        const redeemed = getCardRedeemedCount(selectedCard.id);
        const unredeemedCount = count - redeemed;
        const isCommon = selectedCard.rarity === "common";

        let rarityClass = styles.rarityCommon;
        let rarityText = "ทั่วไป";
        if (selectedCard.rarity === "rare") { rarityText = "หายาก"; rarityClass = styles.rarityRare; }
        else if (selectedCard.rarity === "epic") { rarityText = "มหากาพย์"; rarityClass = styles.rarityEpic; }
        else if (selectedCard.rarity === "legendary") { rarityText = "ตำนาน"; rarityClass = styles.rarityLegendary; }

        return (
          <div className={styles.modalOverlay} onClick={() => setSelectedCard(null)}>
            <div className={`${styles.modalContent} ${rarityClass}`} onClick={e => e.stopPropagation()}>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedCard(null)}>
                <X size={24} />
              </button>

              <div className={styles.modalBody}>
                {/* Left: Card Big Render */}
                <div className={styles.modalCardColumn}>
                  <div className={`${styles.bigCard} ${rarityClass}`}>
                    <img src={selectedCard.imageUrl} alt={selectedCard.name} className={styles.bigCardImg} />
                    <div className={styles.bigCardHeader}>
                      <span className={styles.cardRarityBadge}>{rarityText}</span>
                      {selectedCard.bonusPoints > 0 && (
                        <span className={styles.cardPointsBadge}>+{selectedCard.bonusPoints} Pt</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Info and Actions */}
                <div className={styles.modalInfoColumn}>
                  <h2>{selectedCard.name}</h2>
                  <div className={styles.detailRarityLine}>
                    ระดับความแรร์: <span className={`${styles.detailRarityBadge} ${rarityClass}`}>{rarityText}</span>
                  </div>

                  <p className={styles.modalDesc}>{selectedCard.description}</p>

                  <div className={styles.inventoryStatus}>
                    <h3>สถานะการครอบครองของคุณ</h3>
                    <ul>
                      <li>จำนวนที่ได้สุ่มพบทั้งหมด: <strong>{count} ใบ</strong></li>
                      {!isCommon && (
                        <>
                          <li>แลกคะแนนแล้ว: <strong>{redeemed} ใบ</strong></li>
                          <li>ยังไม่ใช้งาน: <strong style={{ color: unredeemedCount > 0 ? "#10b981" : "#a0aec0" }}>{unredeemedCount} ใบ</strong></li>
                        </>
                      )}
                    </ul>
                  </div>

                  {!isCommon && (
                    <div className={styles.redemptionSection}>
                      {unredeemedCount > 0 ? (
                        <button 
                          onClick={() => handleRedeemCard(selectedCard)}
                          disabled={redeemLoading}
                          className={`${styles.redeemActionBtn} btn-primary`}
                        >
                          <Award size={18} />
                          <span>เปิดใช้งานการ์ด (+{selectedCard.bonusPoints} คะแนน)</span>
                        </button>
                      ) : (
                        <div className={styles.warningMessage}>
                          <ShieldAlert size={18} />
                          <span>คุณไม่มีจำนวนการ์ดใบนี้เหลือให้อนุมัติคะแนนโบนัสเพิ่มเติม</span>
                        </div>
                      )}
                      <p className={styles.redemptionHint}>
                        * เมื่อเปิดใช้งานการ์ดเพื่อแลกคะแนน คำขอจะส่งไปยังคุณครูในทันที เมื่อครูอนุมัติ คะแนนพิเศษจะบวกเข้าไปในสมุดคะแนนของคุณ
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
