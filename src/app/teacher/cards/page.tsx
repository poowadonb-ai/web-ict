"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  authService, cardService, UserProfile, RedemptionRequest,
  Card, getCardPool, updateCardInPool, resetCardInPool, CARD_POOL,
  addCustomCard, updateCustomCard, removeCustomCard, generateCustomCardId,
  getDropRates, saveDropRates, GachaRates, DEFAULT_DROP_RATES
} from "@/lib/firebase";
import {
  Gift, Award, Check, X, Users, RefreshCw, Filter, Search, ShieldCheck,
  Pencil, RotateCcw, Upload, Image as ImageIcon, Layers, TriangleAlert, Plus, Trash2
} from "lucide-react";
import styles from "./page.module.css";

// ─── Image Compress → Data URL (works on Vercel & local, no server needed) ────────────
type CompressResult = { dataUrl: string; originalKB: number; finalKB: number };

async function compressToDataUrl(
  file: File,
  maxDim = 800,
  quality = 0.82
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const originalKB = Math.round(file.size / 1024);
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      // Scale down if bigger than maxDim
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP (smaller), fall back to JPEG
      const mimeType = canvas.toDataURL("image/webp").startsWith("data:image/webp")
        ? "image/webp"
        : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      // Estimate final size (base64 overhead ~33%)
      const finalKB = Math.round((dataUrl.length * 3) / 4 / 1024);
      resolve({ dataUrl, originalKB, finalKB });
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Image load failed")); };
    img.src = blobUrl;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ActiveTab = "distribute" | "requests" | "manage";

// ─── Rarity helpers ───────────────────────────────────────────────────────────
const RARITY_LABELS: Record<string, string> = {
  common: "B (Common)",
  rare: "A (Rare)",
  epic: "S (Epic)",
  legendary: "SS (Legendary)",
  holographic: "SSS (Mythic / Divine)"
};

const RARITY_SHORT: Record<string, string> = {
  common: "B",
  rare: "A",
  epic: "S",
  legendary: "SS",
  holographic: "SSS"
};

const RARITY_CSS: Record<string, string> = {
  common: styles.rarityCommon,
  rare: styles.rarityRare,
  epic: styles.rarityEpic,
  legendary: styles.rarityLegendary,
  holographic: styles.rarityHolo,
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("distribute");

  // distribute tab
  const [selectedRoom, setSelectedRoom] = useState("4-2");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [packCount, setPackCount] = useState<number>(1);
  const [successMsg, setSuccessMsg] = useState("");

  // card manager tab
  const [cardPool, setCardPool] = useState<Card[]>([]);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isCreating, setIsCreating] = useState(false); // true = new card mode
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [saveMsg, setSaveMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // drop rates states
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [rateForm, setRateForm] = useState<GachaRates | null>(null);
  const [ratesMsg, setRatesMsg] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "teacher")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedStudents, fetchedRedemptions] = await Promise.all([
        authService.getRegisteredStudents(),
        cardService.getRedemptions()
      ]);
      const sortedStudents = [...fetchedStudents].sort((a, b) => {
        const roomA = Number(a.room || 0);
        const roomB = Number(b.room || 0);
        if (roomA !== roomB) return roomA - roomB;
        return Number(a.studentNo || 0) - Number(b.studentNo || 0);
      });
      setStudents(sortedStudents);
      setRedemptions(fetchedRedemptions);
    } catch (err) {
      console.error("Error loading cards page data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh card pool whenever manage tab is opened
  useEffect(() => {
    if (activeTab === "manage") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCardPool(getCardPool());
    }
  }, [activeTab]);

  useEffect(() => {
    if (user?.role === "teacher") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>กำลังโหลดแผงควบคุมการ์ดสะสม...</p>
      </div>
    );
  }

  // ── Distribute helpers ────────────────────────────────────────────────────
  const filteredStudents = students.filter(student => {
    const gradeRoom = `${student.grade || "4"}-${student.room}`;
    const matchesRoom = gradeRoom === selectedRoom;
    const matchesSearch =
      (student.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentNo || "").includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectedStudents(checked ? filteredStudents.map(s => s.uid) : []);
  };

  const handleSelectStudent = (uid: string, checked: boolean) => {
    setSelectedStudents(prev =>
      checked ? [...prev, uid] : prev.filter(id => id !== uid)
    );
  };

  const handleAwardPacks = async () => {
    if (selectedStudents.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(selectedStudents.map(uid => cardService.awardPack(uid, packCount)));
      setSuccessMsg(`มอบซองการ์ดจำนวน ${packCount} ซอง ให้แก่นักเรียน ${selectedStudents.length} คน เรียบร้อยแล้ว!`);
      setSelectedStudents([]);
      setPackCount(1);
      setTimeout(() => setSuccessMsg(""), 4000);
      await loadData();
    } catch (err) {
      console.error("Error awarding packs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setLoading(true);
      await cardService.approveRedemption(requestId);
      await loadData();
    } catch (err) {
      console.error("Error approving request:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (pendingRequests.length === 0) return;
    const confirmed = confirm(
      `อนุมัติคำขอทั้งหมด ${pendingRequests.length} รายการใช่หรือไม่?\n\nการกระทำนี้จะให้คะแนนโบนัสแก่นักเรียนทุกคนในรายการทันที`
    );
    if (!confirmed) return;
    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const req of pendingRequests) {
        try {
          await cardService.approveRedemption(req.id);
          successCount++;
        } catch (err) {
          console.error(`Error approving request ${req.id}:`, err);
          failCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push(`${req.studentName} (${req.cardName}): ${errMsg}`);
        }
      }

      if (successCount > 0) {
        setSuccessMsg(`✅ อนุมัติคำขอทั้งหมด ${successCount} รายการเรียบร้อยแล้ว!`);
        setTimeout(() => setSuccessMsg(""), 4000);
      }
      
      if (failCount > 0) {
        alert(`พบข้อผิดพลาดในการอนุมัติ ${failCount} รายการ:\n` + errors.join("\n"));
      }
      
      await loadData();
    } catch (err) {
      console.error("Error approving all requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setLoading(true);
      await cardService.rejectRedemption(requestId);
      await loadData();
    } catch (err) {
      console.error("Error rejecting request:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Card Manager helpers ──────────────────────────────────────────────────

  // Count how many times each card appears across all students' collections
  const getDrawnCount = (cardId: string): number =>
    students.reduce((acc, s) => {
      const found = (s.cardsCollected || []).find(c => c.cardId === cardId);
      return acc + (found ? found.count : 0);
    }, 0);

  const openEditModal = (card: Card) => {
    setIsCreating(false);
    setEditingCard(card);
    setEditForm({ ...card });
    setPreviewUrl(card.imageUrl);
    setCompressionInfo("");
    setSaveMsg("");
  };

  const openNewCardModal = () => {
    const newId = generateCustomCardId();
    const blank: Card = {
      id: newId,
      name: "",
      rarity: "common",
      imageUrl: "/cards/card_missing_semi.png",
      description: "",
      bonusPoints: 0,
      type: "cosmetic"
    };
    setIsCreating(true);
    setEditingCard(blank);
    setEditForm(blank);
    setPreviewUrl(blank.imageUrl);
    setCompressionInfo("");
    setSaveMsg("");
  };

  const closeEditModal = () => {
    setEditingCard(null);
    setIsCreating(false);
    setEditForm({});
    setPreviewUrl("");
    setCompressionInfo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCard) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      alert("รองรับเฉพาะไฟล์ภาพเท่านั้น");
      return;
    }

    setCompressionInfo("");
    // Show instant preview from original file
    const previewBlobUrl = URL.createObjectURL(file);
    setPreviewUrl(previewBlobUrl);
    setUploadingImg(true);

    try {
      let resolvedUrl = "";

      // 1. Try uploading to /api/cards/upload API route first
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("cardId", editingCard.id);

        const res = await fetch("/api/cards/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.imageUrl) {
            resolvedUrl = data.imageUrl;
            setCompressionInfo("อัปโหลดไฟล์ภาพไปยังเซิร์ฟเวอร์เรียบร้อยแล้ว");
          } else if (data.error) {
            console.warn("Upload API returned error:", data.error);
          }
        } else {
          console.warn("Upload API status code:", res.status);
        }
      } catch (uploadErr) {
        console.warn("Server upload failed, falling back to base64 compression:", uploadErr);
      }

      // 2. Fallback to base64 compression if server upload failed or was bypassed
      if (!resolvedUrl) {
        const { dataUrl, originalKB, finalKB } = await compressToDataUrl(file, 800, 0.82);
        const saved = Math.round((1 - finalKB / originalKB) * 100);
        if (saved > 0) {
          setCompressionInfo(`เซิร์ฟเวอร์ไม่อนุญาตให้อัปโหลด ย่อขนาดแล้ว: ${originalKB} KB → ${finalKB} KB (ลด ${saved}%)`);
        } else {
          setCompressionInfo("ใช้รูปภาพรูปแบบ Base64");
        }
        resolvedUrl = dataUrl;
      }

      // Revoke old blob URL and use resolved URL as the actual value
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewUrl(resolvedUrl);
      setEditForm(prev => ({ ...prev, imageUrl: resolvedUrl }));
    } catch (err) {
      console.error("Image processing error:", err);
      alert("ไม่สามารถประมวลผลภาพได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveCard = async () => {
    if (!editingCard) return;
    if (!editForm.name?.trim()) {
      setSaveMsg("⚠️ กรุณาใส่ชื่อการ์ดก่อนบันทึก");
      return;
    }
    setSaveMsg("⏳ กำลังบันทึกข้อมูล...");
    try {
      if (isCreating) {
        // Add as new custom card
        await addCustomCard({ ...editingCard, ...editForm } as Card);
      } else {
        // Check if this is an existing custom card or a base card
        const isCustom = !CARD_POOL.find(c => c.id === editingCard.id);
        if (isCustom) {
          await updateCustomCard(editingCard.id, editForm);
        } else {
          await updateCardInPool(editingCard.id, editForm);
        }
      }
      setCardPool(getCardPool());
      setSaveMsg("✅ บันทึกข้อมูลการ์ดเรียบร้อยแล้ว!");
      setTimeout(() => {
        setSaveMsg("");
        closeEditModal();
      }, 1500);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";
      setSaveMsg(`❌ บันทึกไม่สำเร็จ: ${errMsg}`);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("ลบการ์ดนี้ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
    try {
      setLoading(true);
      await removeCustomCard(cardId);
      setCardPool(getCardPool());
      if (editingCard?.id === cardId) closeEditModal();
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "ไม่มีสิทธิ์ในการแก้ไขระบบ";
      alert(`❌ ลบการ์ดไม่สำเร็จ: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCard = async (cardId: string) => {
    if (!confirm("รีเซ็ตการ์ดนี้กลับเป็นค่าเริ่มต้น?")) return;
    try {
      setLoading(true);
      await resetCardInPool(cardId);
      setCardPool(getCardPool());
      if (editingCard?.id === cardId) closeEditModal();
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "ไม่มีสิทธิ์ในการแก้ไขระบบ";
      alert(`❌ รีเซ็ตการ์ดไม่สำเร็จ: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const openRatesModal = () => {
    setRateForm(JSON.parse(JSON.stringify(getDropRates())));
    setRatesMsg("");
    setIsEditingRates(true);
  };

  const closeRatesModal = () => {
    setIsEditingRates(false);
    setRateForm(null);
    setRatesMsg("");
  };

  const handleSaveRates = async () => {
    if (!rateForm) return;

    // Validate Pack Rates sum to 100%
    const packSum = Number((
      rateForm.pack.holographic +
      rateForm.pack.legendary +
      rateForm.pack.epic +
      rateForm.pack.rare +
      rateForm.pack.common
    ).toFixed(4));

    if (Math.abs(packSum - 100) > 0.01) {
      setRatesMsg(`⚠️ อัตราสุ่มการ์ดรวมกันต้องได้ 100% (ปัจจุบันได้ ${packSum}%)`);
      return;
    }

    // Validate Exchange Rates sum to 100%
    const exchangeSum = Number((
      rateForm.exchange.holographic +
      rateForm.exchange.legendary +
      rateForm.exchange.epic +
      rateForm.exchange.rare +
      rateForm.exchange.common
    ).toFixed(4));

    if (Math.abs(exchangeSum - 100) > 0.01) {
      setRatesMsg(`⚠️ อัตราหลอมการ์ดรวมกันต้องได้ 100% (ปัจจุบันได้ ${exchangeSum}%)`);
      return;
    }

    setRatesMsg("⏳ กำลังบันทึกอัตราดรอป...");
    try {
      await saveDropRates(rateForm);
      setRatesMsg("✅ บันทึกอัตราสุ่มการ์ดเรียบร้อยแล้ว!");
      setTimeout(() => {
        closeRatesModal();
      }, 1500);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "ไม่มีสิทธิ์ในการแก้ไขระบบ";
      setRatesMsg(`❌ บันทึกไม่สำเร็จ: ${errMsg}`);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("รีเซ็ตการ์ดทั้งหมด (ยกเว้นการ์ดที่สร้างใหม่) กลับเป็นค่าเริ่มต้น?")) return;
    try {
      setLoading(true);
      await resetCardInPool();
      setCardPool(getCardPool());
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "ไม่มีสิทธิ์ในการแก้ไขระบบ";
      alert(`❌ รีเซ็ตทั้งหมดไม่สำเร็จ: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  /** True = this card was teacher-created (not in CARD_POOL) */
  const isCustomCard = (cardId: string): boolean =>
    !CARD_POOL.find(c => c.id === cardId);

  // Has a BASE card been overridden?
  const isOverridden = (cardId: string): boolean => {
    if (isCustomCard(cardId)) return false; // custom cards are always "original"
    const defaultCard = CARD_POOL.find(c => c.id === cardId);
    const activeCard = cardPool.find(c => c.id === cardId);
    if (!defaultCard || !activeCard) return false;
    return (
      activeCard.name !== defaultCard.name ||
      activeCard.description !== defaultCard.description ||
      activeCard.imageUrl !== defaultCard.imageUrl ||
      activeCard.bonusPoints !== defaultCard.bonusPoints ||
      activeCard.rarity !== defaultCard.rarity
    );
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPacksAwarded = students.reduce((acc, s) => acc + (s.packsCount || 0), 0);
  const pendingRequests = redemptions.filter(r => r.status === "pending");
  const approvedPointsCount = redemptions
    .filter(r => r.status === "approved")
    .reduce((acc, r) => acc + (r.bonusPoints || 0), 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Gift className={styles.headerIcon} />
          <div>
            <h1 className="gradient-text">ระบบการ์ด &amp; คะแนนพิเศษ</h1>
            <p className={styles.subtitle}>แจกซองการ์ด Gacha, อนุมัติคะแนนพิเศษ, และจัดการการ์ดสะสมทั้งหมด</p>
          </div>
        </div>
        <button onClick={loadData} className="btn-secondary" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <RefreshCw size={16} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </header>

      {/* Stats Cards */}
      <div className={styles.statsPanel}>
        <div className={`${styles.statCard} glass-container`}>
          <Gift size={20} className={styles.statIconBlue} />
          <div>
            <div className={styles.statVal}>{totalPacksAwarded} ซอง</div>
            <div className={styles.statLabel}>ซองสะสมนักเรียนยังไม่เปิด</div>
          </div>
        </div>
        <div className={`${styles.statCard} glass-container`}>
          <Award size={20} className={styles.statIconYellow} />
          <div>
            <div className={styles.statVal}>{pendingRequests.length} รายการ</div>
            <div className={styles.statLabel}>คำร้องขออนุมัติคะแนนโบนัส</div>
          </div>
        </div>
        <div className={`${styles.statCard} glass-container`}>
          <ShieldCheck size={20} className={styles.statIconGreen} />
          <div>
            <div className={styles.statVal}>+{approvedPointsCount} คะแนน</div>
            <div className={styles.statLabel}>คะแนนโบนัสสะสมอนุมัติแล้ว</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab("distribute")}
          className={`${styles.tabBtn} ${activeTab === "distribute" ? styles.activeTab : ""}`}
        >
          <Users size={16} />
          <span>แจกการ์ดห้องเรียน</span>
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`${styles.tabBtn} ${activeTab === "requests" ? styles.activeTab : ""}`}
        >
          <Award size={16} />
          <span>คำขอคะแนนโบนัส ({pendingRequests.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          className={`${styles.tabBtn} ${activeTab === "manage" ? styles.activeTab : ""}`}
        >
          <Layers size={16} />
          <span>จัดการการ์ดทั้งหมด</span>
        </button>
      </div>

      {successMsg && (
        <div className={styles.successBanner}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Tab: Distribute ──────────────────────────────────────────────────── */}
      {activeTab === "distribute" && (
        <div className={`${styles.panel} glass-container`}>
          <div className={styles.panelControls}>
            <div className={styles.filterGroup}>
              <Filter size={16} />
              <select
                value={selectedRoom}
                onChange={(e) => { setSelectedRoom(e.target.value); setSelectedStudents([]); }}
                className={styles.selectFilter}
              >
                <optgroup label="ม.4">
                  {["2", "3", "4", "5", "6", "12", "13"].map((r) => (
                    <option key={`4-${r}`} value={`4-${r}`}>ห้อง ม.4/{r}</option>
                  ))}
                </optgroup>
                <optgroup label="ม.5">
                  {["2", "3"].map((r) => (
                    <option key={`5-${r}`} value={`5-${r}`}>ห้อง ม.5/{r}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className={styles.searchGroup}>
              <Search size={16} />
              <input
                type="text"
                placeholder="ค้นหานักเรียนตามชื่อ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.awardActions}>
              <div className={styles.packCountInput}>
                <label>จำนวนซอง:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={packCount}
                  onChange={(e) => setPackCount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <button
                onClick={handleAwardPacks}
                disabled={selectedStudents.length === 0}
                className="btn-primary"
              >
                <Gift size={16} />
                <span>แจกให้ที่เลือก ({selectedStudents.length} คน)</span>
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className={styles.emptyState}>
              <p>ไม่พบรายชื่อนักเรียนในห้องเรียนนี้</p>
              <p className={styles.emptySub}>กรุณาลงทะเบียนนักเรียน หรือปรับเปลี่ยนคำค้นหา</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: "40px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th style={{ width: "80px" }}>เลขที่</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th style={{ width: "120px", textAlign: "center" }}>ซองที่มีอยู่</th>
                    <th style={{ width: "120px", textAlign: "center" }}>คะแนนโบนัสสะสม</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.uid}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.uid)}
                          onChange={(e) => handleSelectStudent(student.uid, e.target.checked)}
                        />
                      </td>
                      <td>{student.studentNo}</td>
                      <td className={styles.studentNameCell}>{student.fullName}</td>
                      <td style={{ textAlign: "center", color: "#3182ce", fontWeight: "bold" }}>
                        {student.packsCount || 0} ซอง
                      </td>
                      <td style={{ textAlign: "center", color: "#38a169", fontWeight: "bold" }}>
                        +{student.bonusPoints || 0} คะแนน
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Requests ────────────────────────────────────────────────────── */}
      {activeTab === "requests" && (
        <div className={`${styles.panel} glass-container`}>
          {pendingRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <p>ไม่มีคำขอคะแนนโบนัสค้างอนุมัติในขณะนี้</p>
              <p className={styles.emptySub}>คำขอของนักเรียนจะปรากฏที่นี่เมื่อพวกเขาเปิดการ์ดโบนัสและกดยืนยันใช้งานการ์ด</p>
            </div>
          ) : (
            <>
              <div className={styles.requestsToolbar}>
                <p className={styles.requestsCount}>
                  📋 คำขอรอการอนุมัติ <strong>{pendingRequests.length}</strong> รายการ
                </p>
                <button
                  onClick={handleApproveAll}
                  className={styles.approveAllBtn}
                >
                  <Check size={16} />
                  <span>อนุมัติทั้งหมด ({pendingRequests.length} รายการ)</span>
                </button>
              </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>วัน-เวลา</th>
                    <th>ห้อง</th>
                    <th>ชื่อนักเรียน</th>
                    <th>การ์ดที่ใช้งาน</th>
                    <th style={{ textAlign: "center" }}>คะแนนที่จะได้รับ</th>
                    <th style={{ textAlign: "center", width: "220px" }}>การประเมิน</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(req => {
                    let rarityText = "B";
                    let rarityClass = styles.rarityCommon;
                    if (req.rarity === "rare") { rarityText = "A"; rarityClass = styles.rarityRare; }
                    else if (req.rarity === "epic") { rarityText = "S"; rarityClass = styles.rarityEpic; }
                    else if (req.rarity === "legendary") { rarityText = "SS"; rarityClass = styles.rarityLegendary; }
                    else if (req.rarity === "holographic") { rarityText = "SSS"; rarityClass = styles.rarityHolo; }
                    return (
                      <tr key={req.id}>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {new Date(req.createdAt).toLocaleString("th-TH")}
                        </td>
                        <td>ม.{req.studentGrade || "4"}/{req.studentRoom}</td>
                        <td style={{ fontWeight: "600" }}>{req.studentName}</td>
                        <td>
                          <div className={styles.cardInfoCell}>
                            <span className={`${styles.rarityBadge} ${rarityClass}`}>{rarityText}</span>
                            <span className={styles.cardNameText}>{req.cardName}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", color: "#38a169", fontWeight: "bold", fontSize: "1.1rem" }}>
                          +{req.bonusPoints} คะแนน
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button onClick={() => handleApprove(req.id)} className={`${styles.approveBtn} btn-primary`}>
                              <Check size={14} /><span>อนุมัติ</span>
                            </button>
                            <button onClick={() => handleReject(req.id)} className={styles.rejectBtn}>
                              <X size={14} /><span>ปฏิเสธ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Manage Cards ─────────────────────────────────────────────────── */}
      {activeTab === "manage" && (
        <div className={styles.manageSection}>
          {/* Top bar */}
          <div className={styles.manageTopBar}>
            <div>
              <p className={styles.manageHint}>
                🎴 การ์ดทั้งหมด {cardPool.length} ใบ — คลิก <strong>✏️ แก้ไข</strong> เพื่อเปลี่ยนข้อมูลหรืออัปโหลดรูปใหม่
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button onClick={openRatesModal} className={styles.ratesBtn}>
                <Layers size={15} />
                <span>ตั้งค่าอัตราการดรอป</span>
              </button>
              <button onClick={openNewCardModal} className={styles.addCardBtn}>
                <Plus size={15} />
                <span>เพิ่มการ์ดใหม่</span>
              </button>
              <button onClick={handleResetAll} className={styles.resetAllBtn}>
                <RotateCcw size={15} />
                <span>รีเซ็ตทั้งหมด</span>
              </button>
            </div>
          </div>

          {/* Category Filter Bar */}
          <div className={styles.typeFilterRow}>
            {[
              { id: "all", label: "ทั้งหมด" },
              { id: "computer_act", label: "⚖️ พรบ.คอมพิวเตอร์" },
              { id: "cosmetic", label: "🎨 ตกแต่งโปรไฟล์" },
              { id: "bonus", label: "⭐ เพิ่มคะแนนพิเศษ" },
              { id: "privilege", label: "🔑 สิทธิพิเศษ" }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedTypeFilter(filter.id)}
                className={`${styles.typeFilterBtn} ${selectedTypeFilter === filter.id ? styles.typeFilterBtnActive : ""}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Card Grid */}
          <div className={styles.cardManagerGrid}>
            {cardPool
              .filter(card => selectedTypeFilter === "all" || card.type === selectedTypeFilter)
              .map(card => {
              const drawnCount = getDrawnCount(card.id);
              const modified = isOverridden(card.id);
              const custom = isCustomCard(card.id);
              return (
                <div key={card.id} className={`${styles.manageCard} ${modified ? styles.manageCardModified : ""} ${custom ? styles.manageCardCustom : ""}`}>
                  {modified && (
                    <div className={styles.modifiedBadge} title="การ์ดนี้ถูกแก้ไขแล้ว">✏️ แก้ไขแล้ว</div>
                  )}
                  {custom && !modified && (
                    <div className={styles.customBadge} title="การ์ดที่ครูสร้างใหม่">✨ สร้างใหม่</div>
                  )}
                  {/* Card image */}
                  <div className={styles.manageCardImg}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      onError={(e) => { (e.target as HTMLImageElement).src = "/cards/card_missing_semi.png"; }}
                    />
                  </div>
                  {/* Info */}
                  <div className={styles.manageCardInfo}>
                    <span className={`${styles.rarityBadge} ${RARITY_CSS[card.rarity] || styles.rarityCommon}`}>
                      {RARITY_SHORT[card.rarity] || card.rarity.toUpperCase()}
                    </span>
                    <p className={styles.manageCardName}>{card.name}</p>
                    <p className={styles.manageCardDesc}>{card.description}</p>
                    <div className={styles.manageCardMeta}>
                      <span className={styles.bonusBadge}>+{card.bonusPoints} คะแนน</span>
                      <span className={styles.drawnBadge}>
                        ออกไปแล้ว: <strong>{drawnCount}</strong> ใบ
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className={styles.manageCardActions}>
                    <button onClick={() => openEditModal(card)} className={styles.editCardBtn}>
                      <Pencil size={14} /> แก้ไข
                    </button>
                    {modified && (
                      <button onClick={() => handleResetCard(card.id)} className={styles.resetCardBtn} title="รีเซ็ตเป็นค่าเริ่มต้น">
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {custom && (
                      <button onClick={() => handleDeleteCard(card.id)} className={styles.deleteCardBtn} title="ลบการ์ดออกจากระบบ">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editingCard && (
        <div className={styles.modalOverlay} onClick={closeEditModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{isCreating ? "✨ เพิ่มการ์ดใหม่" : "✏️ แก้ไขการ์ด"}</h2>
              <button className={styles.modalClose} onClick={closeEditModal}><X size={20} /></button>
            </div>

            <div className={styles.modalBody}>
              {/* Image preview + upload */}
              <div className={styles.imgUploadZone}>
                <div className={styles.imgPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl || editForm.imageUrl || "/cards/card_rare.png"}
                    alt="preview"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/cards/card_rare.png"; }}
                  />
                  {uploadingImg && (
                    <div className={styles.imgUploading}>
                      <div className={styles.spinner}></div>
                    </div>
                  )}
                </div>
                <div className={styles.imgUploadControls}>
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                  >
                    <Upload size={15} />
                    {uploadingImg ? "กำลังอัปโหลด..." : "อัปโหลดรูปภาพ"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                  />
                  <p className={styles.uploadHint}>
                    <ImageIcon size={12} /> JPG, PNG, WebP, GIF — ย่อขนาดอัตโนมัติสูงสุด 800px
                  </p>
                  {compressionInfo && (
                    <div className={styles.compressionBadge}>🗜️ {compressionInfo}</div>
                  )}
                  <div className={styles.formGroup}>
                    <label>หรือใส่ URL รูปภาพ</label>
                    <input
                      type="text"
                      value={editForm.imageUrl || ""}
                      onChange={e => { setEditForm(p => ({ ...p, imageUrl: e.target.value })); setPreviewUrl(e.target.value); }}
                      placeholder="/cards/card_example.png"
                      className={styles.formInput}
                    />
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div className={styles.formGroup}>
                <label>ชื่อการ์ด</label>
                <input
                  type="text"
                  value={editForm.name || ""}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>คำอธิบาย</label>
                <textarea
                  value={editForm.description || ""}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  className={styles.formTextarea}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label>ประเภทการ์ด</label>
                <select
                  value={editForm.type || "cosmetic"}
                  onChange={e => {
                    const newType = e.target.value as Card["type"];
                    const updates: Partial<Card> = { type: newType };
                    // If Computer Act, automatically lock to Rank A (rare)
                    if (newType === "computer_act") {
                      updates.rarity = "rare";
                    }
                    setEditForm(p => ({ ...p, ...updates }));
                  }}
                  className={styles.formSelect}
                >
                  <option value="cosmetic">🎨 ตกแต่งโปรไฟล์ความสวยงาม (Cosmetic)</option>
                  <option value="bonus">⭐ เพิ่มคะแนนพิเศษ (Bonus)</option>
                  <option value="privilege">🔑 สิทธิพิเศษในการเรียน (Privilege)</option>
                  <option value="computer_act">⚖️ การ์ด พรบ คอมพิวเตอร์ (Rank A - Rare)</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>ระดับความแรร์</label>
                  <select
                    value={editForm.rarity || "common"}
                    onChange={e => setEditForm(p => ({ ...p, rarity: e.target.value as Card["rarity"] }))}
                    className={styles.formSelect}
                    disabled={editForm.type === "computer_act"}
                  >
                    {Object.entries(RARITY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {editForm.type === "computer_act" && (
                    <span className={styles.fieldHelpText} style={{ color: "#fbbf24", fontSize: "0.75rem", marginTop: "4px" }}>
                      ⚠️ ล็อกเป็น Rank A (Rare) ตามข้อกำหนด พรบ คอมพิวเตอร์
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>คะแนนโบนัส</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={editForm.bonusPoints ?? 0}
                    onChange={e => setEditForm(p => ({ ...p, bonusPoints: Number(e.target.value) }))}
                    className={styles.formInput}
                  />
                </div>
              </div>

              {/* Warning if drawn count > 0 */}
              {getDrawnCount(editingCard.id) > 0 && (
                <div className={styles.warnBanner}>
                  <TriangleAlert size={16} />
                  <span>การ์ดนี้ถูกนักเรียนสะสมแล้ว {getDrawnCount(editingCard.id)} ใบ การแก้ไขจะมีผลกับการแสดงผลเท่านั้น ไม่ส่งผลต่อคะแนนที่ได้รับไปแล้ว</span>
                </div>
              )}

              {saveMsg && <div className={styles.saveMsgBanner}>{saveMsg}</div>}
            </div>

            <div className={styles.modalFooter}>
              {!isCreating && editingCard && isCustomCard(editingCard.id) && (
                <button
                  onClick={() => handleDeleteCard(editingCard.id)}
                  className={styles.deleteModalBtn}
                >
                  <Trash2 size={14} /> ลบการ์ดนี้
                </button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                <button onClick={closeEditModal} className="btn-secondary">ยกเลิก</button>
                <button onClick={handleSaveCard} className="btn-primary" disabled={uploadingImg}>
                  {isCreating ? <><Plus size={15} /> สร้างการ์ด</> : <><Check size={15} /> บันทึก</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Drop Rates Settings ────────────────────────────────────────── */}
      {isEditingRates && rateForm && (
        <div className={styles.modalOverlay} onClick={closeRatesModal}>
          <div className={styles.ratesModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Layers size={18} />
              <h2>ตั้งค่าอัตราการดรอปการ์ด (Drop Rates Settings)</h2>
              <button className={styles.modalCloseX} onClick={closeRatesModal}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.ratesInfoText}>
                💡 กำหนดเปอร์เซ็นต์ (%) สำหรับการสุ่มเปิดการ์ดในแต่ละช่องทาง โดยยอดรวมของแต่ละกลุ่มต้องได้ 100% เสมอ
              </p>

              {/* Group 1: Regular Packs */}
              <div className={styles.ratesGroup}>
                <h3 className={styles.ratesGroupTitle}>📦 อัตราการดรอปในซองการ์ดปกติ (Regular Pack)</h3>
                <div className={styles.ratesInputGrid}>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityB}>B (Common)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.pack.common}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          pack: { ...p!.pack, common: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityA}>A (Rare)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.pack.rare}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          pack: { ...p!.pack, rare: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityS}>S (Epic)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.pack.epic}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          pack: { ...p!.pack, epic: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.raritySS}>SS (Legendary)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.pack.legendary}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          pack: { ...p!.pack, legendary: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.raritySSS}>SSS (Mythic)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.pack.holographic}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          pack: { ...p!.pack, holographic: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
                <div className={styles.ratesSumCheck}>
                  รวมทั้งหมด: <strong style={{
                    color: Math.abs((rateForm.pack.common + rateForm.pack.rare + rateForm.pack.epic + rateForm.pack.legendary + rateForm.pack.holographic) - 100) < 0.01 ? "#10b981" : "#ef4444"
                  }}>
                    {(rateForm.pack.common + rateForm.pack.rare + rateForm.pack.epic + rateForm.pack.legendary + rateForm.pack.holographic).toFixed(2)}%
                  </strong>
                </div>
              </div>

              {/* Group 2: Fusion / Exchange */}
              <div className={styles.ratesGroup} style={{ marginTop: "20px" }}>
                <h3 className={styles.ratesGroupTitle}>♻️ อัตราการดรอปในการหลอมการ์ด (Exchange Gacha)</h3>
                <div className={styles.ratesInputGrid}>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityB}>B (Common)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.exchange.common}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          exchange: { ...p!.exchange, common: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityA}>A (Rare)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.exchange.rare}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          exchange: { ...p!.exchange, rare: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.rarityS}>S (Epic)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.exchange.epic}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          exchange: { ...p!.exchange, epic: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.raritySS}>SS (Legendary)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.exchange.legendary}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          exchange: { ...p!.exchange, legendary: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className={styles.ratesInputGroup}>
                    <label className={styles.raritySSS}>SSS (Mythic)</label>
                    <div className={styles.inputWithPercent}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={rateForm.exchange.holographic}
                        onChange={e => setRateForm(p => ({
                          ...p!,
                          exchange: { ...p!.exchange, holographic: Number(e.target.value) }
                        }))}
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
                <div className={styles.ratesSumCheck}>
                  รวมทั้งหมด: <strong style={{
                    color: Math.abs((rateForm.exchange.common + rateForm.exchange.rare + rateForm.exchange.epic + rateForm.exchange.legendary + rateForm.exchange.holographic) - 100) < 0.01 ? "#10b981" : "#ef4444"
                  }}>
                    {(rateForm.exchange.common + rateForm.exchange.rare + rateForm.exchange.epic + rateForm.exchange.legendary + rateForm.exchange.holographic).toFixed(2)}%
                  </strong>
                </div>
              </div>

              {ratesMsg && <div className={styles.saveMsgBanner} style={{ marginTop: "15px" }}>{ratesMsg}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => setRateForm(JSON.parse(JSON.stringify(DEFAULT_DROP_RATES)))} className={styles.resetRatesBtn}>
                <RotateCcw size={14} /> รีเซ็ตเป็นค่าเริ่มต้น
              </button>
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                <button onClick={closeRatesModal} className="btn-secondary">ยกเลิก</button>
                <button onClick={handleSaveRates} className="btn-primary">
                  <Check size={15} /> บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

