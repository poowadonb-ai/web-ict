"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { authService, cardService, UserProfile, RedemptionRequest } from "@/lib/firebase";
import { Gift, Award, Check, X, Users, RefreshCw, Filter, Search, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

export default function TeacherCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"distribute" | "requests">("distribute");

  // Filter & Search states
  const [selectedRoom, setSelectedRoom] = useState("2"); // Default to 4/2
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [packCount, setPackCount] = useState<number>(1);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "teacher")) {
      router.push("/classroom");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedStudents = await authService.getRegisteredStudents();
      const fetchedRedemptions = await cardService.getRedemptions();
      
      // Sort students by Room, then No.
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

  useEffect(() => {
    if (user && user.role === "teacher") {
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

  // Filter students based on selected room and search query
  const filteredStudents = students.filter(student => {
    const matchesRoom = student.room === selectedRoom;
    const matchesSearch = 
      (student.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentNo || "").includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredStudents.map(s => s.uid));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (uid: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, uid]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== uid));
    }
  };

  const handleAwardPacks = async () => {
    if (selectedStudents.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(
        selectedStudents.map(uid => cardService.awardPack(uid, packCount))
      );
      
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

  // Stats calculation
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
            <h1 className="gradient-text">ระบบการ์ด & คะแนนพิเศษ</h1>
            <p className={styles.subtitle}>แจกซองการ์ด Gacha ให้กับนักเรียนชั้น ม.4 และอนุมัติคะแนนพิเศษจากการ์ดแรร์</p>
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
      </div>

      {successMsg && (
        <div className={styles.successBanner}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === "distribute" ? (
        <div className={`${styles.panel} glass-container`}>
          <div className={styles.panelControls}>
            {/* Room Filter */}
            <div className={styles.filterGroup}>
              <Filter size={16} />
              <select 
                value={selectedRoom} 
                onChange={(e) => {
                  setSelectedRoom(e.target.value);
                  setSelectedStudents([]);
                }}
                className={styles.selectFilter}
              >
                {["2", "3", "4", "5", "6", "12", "13"].map((r) => (
                  <option key={r} value={r}>
                    ห้อง ม.4/{r}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Search */}
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

            {/* Action Bar */}
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
      ) : (
        <div className={`${styles.panel} glass-container`}>
          {pendingRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <p>ไม่มีคำขอคะแนนโบนัสค้างอนุมัติในขณะนี้</p>
              <p className={styles.emptySub}>คำขอของนักเรียนจะปรากฏที่นี่เมื่อพวกเขาเปิดการ์ดโบนัสและกดยืนยันใช้งานการ์ด</p>
            </div>
          ) : (
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
                    let rarityText = "ทั่วไป";
                    let rarityClass = styles.rarityCommon;
                    if (req.rarity === "rare") { rarityText = "หายาก"; rarityClass = styles.rarityRare; }
                    else if (req.rarity === "epic") { rarityText = "มหากาพย์"; rarityClass = styles.rarityEpic; }
                    else if (req.rarity === "legendary") { rarityText = "ตำนาน"; rarityClass = styles.rarityLegendary; }

                    return (
                      <tr key={req.id}>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {new Date(req.createdAt).toLocaleString("th-TH")}
                        </td>
                        <td>ม.4/{req.studentRoom}</td>
                        <td style={{ fontWeight: "600" }}>{req.studentName}</td>
                        <td>
                          <div className={styles.cardInfoCell}>
                            <span className={`${styles.rarityBadge} ${rarityClass}`}>
                              {rarityText}
                            </span>
                            <span className={styles.cardNameText}>{req.cardName}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", color: "#38a169", fontWeight: "bold", fontSize: "1.1rem" }}>
                          +{req.bonusPoints} คะแนน
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button 
                              onClick={() => handleApprove(req.id)}
                              className={`${styles.approveBtn} btn-primary`}
                            >
                              <Check size={14} />
                              <span>อนุมัติ</span>
                            </button>
                            <button 
                              onClick={() => handleReject(req.id)}
                              className={styles.rejectBtn}
                            >
                              <X size={14} />
                              <span>ปฏิเสธ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
