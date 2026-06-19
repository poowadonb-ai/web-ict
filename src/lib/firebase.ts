/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unused-vars */
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  runTransaction,
  where,
  getDocs
} from "firebase/firestore";
import * as sb from "./supabase";

// Interface definitions for our application data
export interface CardCollected {
  cardId: string;
  count: number;
  redeemedCount: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "teacher" | "student";
  isRegistered: boolean;
  fullName?: string;
  grade?: string;
  room?: string;
  studentNo?: string;
  cardsCollected?: CardCollected[];
  packsCount?: number;
  bonusPoints?: number;
  lastLoginDate?: string;
  totalPacksOpened?: number;
  isMerged?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: number;
  pinned?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  canvaUrl: string;
  youtubeUrl: string;
  createdAt: number;
  authorEmail: string;
  hasAssignment?: boolean;
  assignmentId?: string; // Reference to board ID
  assignmentType?: "individual" | "group";
  targetRooms?: string[]; // E.g. ["2", "3", "4", "5", "6", "12", "13"]
}

export interface AssignmentBoard {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  type?: "individual" | "group";
  lessonId?: string;
  isLocked?: boolean;
  targetRooms?: string[]; // E.g. ["2", "3", "4", "5", "6", "12", "13"]
}

export interface Submission {
  id: string;
  boardId: string;
  uid: string; // Author student's uid
  studentName: string;
  studentNo: string;
  gradeClass: string;
  title: string;
  description: string;
  linkUrl: string;
  likes: string[]; // List of user uids who liked this submission
  comments: {
    id: string;
    uid: string;
    authorName: string;
    content: string;
    createdAt: number;
  }[];
  createdAt: number;
  isGroup?: boolean;
  members?: { name: string; room: string; studentNo: string }[];
  status?: "pending" | "graded" | "resubmit";
  score?: number;
  maxScore?: number;
  teacherFeedback?: string;
}

export interface Card {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "holographic";
  imageUrl: string;
  description: string;
  bonusPoints: number;
  type: "cosmetic" | "bonus" | "privilege" | "computer_act";
}

export interface CardPack {
  id: string;
  studentUid: string;
  studentName: string;
  studentRoom: string;
  isOpened: boolean;
  cards?: Card[];
  createdAt: number;
}

export interface RedemptionRequest {
  id: string;
  studentUid: string;
  studentName: string;
  studentRoom: string;
  studentGrade?: string;
  cardId: string;
  cardName: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "holographic";
  bonusPoints: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

export const CARD_POOL: Card[] = [
  {
    id: "card-1",
    name: "บั๊กตัวเบ้อเริ่ม (Missing Semicolon)",
    rarity: "common",
    imageUrl: "/cards/card_missing_semi.png",
    description: "หาให้ตายก็ไม่เจอ สุดท้ายแค่ลืมใส่ ; ไปตัวเดียว! (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-2",
    name: "คอมแฮงก์ (Blue Screen of Death)",
    rarity: "common",
    imageUrl: "/cards/card_bsod.png",
    description: "ทำงานมา 3 ชั่วโมง... อ้าว ยังไม่ได้กดเซฟ! น้ำตาจะไหล (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-3",
    name: "เทพคัดลอกวาง (StackOverflow)",
    rarity: "common",
    imageUrl: "/cards/card_stackoverflow.png",
    description: "ไม่รู้หรอกว่าโค้ดบรรทัดนี้ทำงานยังไง แต่ก๊อปมาวางแล้วมันดันรันผ่าน! (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-4",
    name: "เบราว์เซอร์สุดอืด (Internet Explorer)",
    rarity: "common",
    imageUrl: "/cards/card_ie.png",
    description: "กำลังโหลด... โปรดรออีกสัก 3 ชาติเศษๆ (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-5",
    name: "คุยกับเป็ด (Rubber Duck Debugging)",
    rarity: "common",
    imageUrl: "/cards/card_rubber_duck.png",
    description: "เมื่อไม่มีใครช่วยได้ ก็ต้องอธิบายโค้ดให้เป็ดยางฟังเผื่อจะบรรลุธรรม (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-6",
    name: "พิมพ์ผิดชีวิตเปลี่ยน (Typo Error)",
    rarity: "common",
    imageUrl: "/cards/card_typo.png",
    description: "นั่งเพ่งหาบั๊กเป็นชั่วโมง สรุปพิมพ์ชื่อตัวแปรผิดไปแค่ตัวเดียว (ประดับคลังการ์ด)",
    bonusPoints: 0,
    type: "cosmetic"
  },
  {
    id: "card-7",
    name: "ครูพลอย",
    rarity: "rare",
    imageUrl: "/cards/card_kru_ploy.jpg",
    description: "ครูผู้มอบรอยยิ้มและพลังใจ - 'เชื่อมั่นในตัวเอง แล้วก้าวไปอย่างสวยงาม' (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-8",
    name: "ครูเล็ก",
    rarity: "rare",
    imageUrl: "/cards/card_kru_lek.jpg",
    description: "ครูผู้จุดประกายความคิด - ปลดปล่อยพลังแห่งปัญญา เพิ่มพลังโจมตีและป้องกันชั่วคราว (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-9",
    name: "ครูก๊อต",
    rarity: "rare",
    imageUrl: "/cards/card_kru_got.jpg",
    description: "ผู้วางแผนเหนือชั้น คิดลึก มองขาด - วางแผนยุทธศาสตร์เพิ่มพลังโจมตีและป้องกันให้กับทีม 20% (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-10",
    name: "ครูเอส",
    rarity: "rare",
    imageUrl: "/cards/card_kru_es.jpg",
    description: "ผู้นำแห่งแรงบันดาลใจ - 'ไม่ว่าโลกนี้จะเปลี่ยนไปแค่ไหน... ผมจะเป็นครู ที่พาเด็กๆ ไปสู่อนาคตที่ดีกว่าเสมอ!' (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-11",
    name: "ครูนพ",
    rarity: "rare",
    imageUrl: "/cards/card_kru_nop.jpg",
    description: "ครูผู้บุกเบิกและผู้ชี้แนะเทคโนโลยี - อัญเชิญพลังคาถาโค้ดและการสร้างสรรค์ระดับตำนาน (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-12",
    name: "เซิร์ฟเวอร์ไหม้ (This is Fine)",
    rarity: "epic",
    imageUrl: "/cards/card_this_is_fine.png",
    description: "ไฟไหม้ห้องเซิร์ฟเวอร์ย่อยยับ แต่ระบบยังรันได้ (มั้ง) สบายมาก! (+2 คะแนนโบนัส)",
    bonusPoints: 2,
    type: "bonus"
  },
  {
    id: "card-13",
    name: "สายฮีลลิ่ง (Coffee IV Drip)",
    rarity: "epic",
    imageUrl: "/cards/card_coffee_iv.png",
    description: "เจาะสายน้ำเกลือเติมกาแฟเข้าเส้นเลือด เพื่อปั่นโปรเจกต์โต้รุ่ง (+2 คะแนนโบนัส)",
    bonusPoints: 2,
    type: "bonus"
  },
  {
    id: "card-14",
    name: "วัดใจวันศุกร์ (Git Push Force)",
    rarity: "epic",
    imageUrl: "/cards/card_git_push.png",
    description: "อัปเดตระบบตอน 5 โมงเย็นวันศุกร์ แล้วหนีกลับบ้าน ไม่รับรู้อะไรทั้งสิ้น! (+2 คะแนนโบนัส)",
    bonusPoints: 2,
    type: "bonus"
  },
  {
    id: "card-15",
    name: "เอไอแย่งงาน (AI Took My Job)",
    rarity: "epic",
    imageUrl: "/cards/card_ai_took_job.png",
    description: "เมื่อแชทบอทเขียนโค้ดได้เก่งกว่าและเร็วกว่าเราไปแล้ว... (+2 คะแนนโบนัส)",
    bonusPoints: 2,
    type: "bonus"
  },
  {
    id: "card-16",
    name: "ซีเนียร์ผู้แกร่งกล้า (GigaChad Dev)",
    rarity: "legendary",
    imageUrl: "/cards/meme_legendary.png",
    description: "เขียนโค้ดรวดเดียวจบ ไร้บั๊ก ไร้เออเร่อ พลังสมองกลระดับกุมชะตาจักรวาล! (+5 คะแนนโบนัส)",
    bonusPoints: 5,
    type: "bonus"
  },
  {
    id: "card-holo-1",
    name: "✨ มังกรไซเบอร์ (Cyber Dragon Holographic)",
    rarity: "holographic",
    imageUrl: "/cards/card_cyber_dragon.png",
    description: "การ์ดโฮโลกราฟิกหายากที่สุดในโลก! ผู้โชคดี 1 ใน 500 คนเท่านั้น! พลังงานดิจิทัลสูงสุด! (+10 คะแนนโบนัส)",
    bonusPoints: 10,
    type: "bonus"
  },
  {
    id: "card-comp-1",
    name: "การ์ดแฮกเกอร์หมวกขาว (White Hat Hacker)",
    rarity: "rare",
    imageUrl: "/cards/card_white_hat.png",
    description: "เจาะระบบเพื่อค้นหาช่องโหว่และช่วยปรับปรุงระบบความปลอดภัยตามกฎหมาย (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "computer_act"
  },
  {
    id: "card-comp-2",
    name: "การ์ดรหัสผ่านสุดปลอดภัย (Strong Password)",
    rarity: "rare",
    imageUrl: "/cards/card_strong_pwd.png",
    description: "ตั้งรหัสผ่านที่ซับซ้อน ป้องกันการเข้าถึงข้อมูลระบบโดยมิชอบ ตาม พรบ.คอมฯ มาตรา 5 (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "computer_act"
  },
  {
    id: "card-comp-3",
    name: "การ์ดผู้รักษาความลับ (Data Confidentiality)",
    rarity: "rare",
    imageUrl: "/cards/card_confidentiality.png",
    description: "ไม่เปิดเผยหรือแพร่กระจายข้อมูลส่วนบุคคลของผู้อื่นโดยไม่ได้รับอนุญาตตามกฎหมาย (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "computer_act"
  },
  {
    id: "card-comp-4",
    name: "การ์ดต้านข่าวลวง (Anti-Fake News System)",
    rarity: "rare",
    imageUrl: "/cards/card_anti_fake.png",
    description: "ตรวจสอบก่อนแชร์ ป้องกันการนำเข้าข้อมูลคอมพิวเตอร์อันเป็นเท็จ ตามมาตรา 14 (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "computer_act"
  }
];

// -------------------------------------------------------------
// CARD POOL MANAGEMENT (LocalStorage override for teacher edits)
// -------------------------------------------------------------
const CARD_POOL_STORAGE_KEY = "mock_card_pool_overrides";


/**
 * Save partial updates for a single card to LocalStorage.
 */
export async function updateCardInPool(cardId: string, updates: Partial<Card>): Promise<void> {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(CARD_POOL_STORAGE_KEY);
  const overrides: Record<string, Partial<Card>> = stored ? JSON.parse(stored) : {};
  overrides[cardId] = { ...(overrides[cardId] || {}), ...updates };
  localStorage.setItem(CARD_POOL_STORAGE_KEY, JSON.stringify(overrides));
  await saveCardsToFirestore();
}

/**
 * Reset a single card (or all cards) back to their defaults.
 */
export async function resetCardInPool(cardId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!cardId) {
    localStorage.removeItem(CARD_POOL_STORAGE_KEY);
  } else {
    const stored = localStorage.getItem(CARD_POOL_STORAGE_KEY);
    if (stored) {
      const overrides: Record<string, Partial<Card>> = JSON.parse(stored);
      delete overrides[cardId];
      localStorage.setItem(CARD_POOL_STORAGE_KEY, JSON.stringify(overrides));
    }
  }
  await saveCardsToFirestore();
}

// ─── Custom Cards (teacher-created new cards) ─────────────────────────────────
const CUSTOM_CARDS_KEY = "mock_card_pool_custom";
const DROP_RATES_KEY = "mock_drop_rates";

export interface DropRates {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
  holographic: number;
}

export interface GachaRates {
  pack: DropRates;
  exchange: DropRates;
}

export const DEFAULT_DROP_RATES: GachaRates = {
  pack: {
    holographic: 0.2,
    legendary: 0.5,
    epic: 3.0,
    rare: 10.0,
    common: 86.3
  },
  exchange: {
    holographic: 0.4,
    legendary: 1.0,
    epic: 6.0,
    rare: 20.0,
    common: 72.6
  }
};

export function getDropRates(): GachaRates {
  if (typeof window === "undefined") return DEFAULT_DROP_RATES;
  try {
    const stored = localStorage.getItem(DROP_RATES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_DROP_RATES;
  } catch {
    return DEFAULT_DROP_RATES;
  }
}

export async function saveDropRates(rates: GachaRates): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.setItem(DROP_RATES_KEY, JSON.stringify(rates));
  await saveCardsToFirestore();
}

/** Return all teacher-created custom cards from LocalStorage. */
export function getCustomCards(): Card[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CUSTOM_CARDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the FULL active pool = CARD_POOL (with overrides) + custom cards.
 * Overrides are applied first, then custom cards are appended at the end.
 */
export function getCardPool(): Card[] {
  if (typeof window === "undefined") return CARD_POOL;
  try {
    const stored = localStorage.getItem(CARD_POOL_STORAGE_KEY);
    const overrides: Record<string, Partial<Card>> = stored ? JSON.parse(stored) : {};
    const base = CARD_POOL.map(card => ({ ...card, ...(overrides[card.id] || {}) }));
    const custom = getCustomCards();
    return [...base, ...custom];
  } catch {
    return CARD_POOL;
  }
}

/** Add a new custom card to LocalStorage. */
export async function addCustomCard(card: Card): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = getCustomCards();
  // Prevent duplicate IDs
  if (existing.find(c => c.id === card.id)) return;
  existing.push(card);
  localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(existing));
  await saveCardsToFirestore();
}

/** Update an existing custom card in LocalStorage. */
export async function updateCustomCard(cardId: string, updates: Partial<Card>): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = getCustomCards();
  const idx = existing.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  existing[idx] = { ...existing[idx], ...updates };
  localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(existing));
  await saveCardsToFirestore();
}

/** Permanently delete a custom card from LocalStorage. */
export async function removeCustomCard(cardId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = getCustomCards().filter(c => c.id !== cardId);
  localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(existing));
  await saveCardsToFirestore();
}

/** Generate a new unique custom card ID (e.g. "custom-1681234567890"). */
export function generateCustomCardId(): string {
  return `custom-${Date.now()}`;
}

// Check if Firebase keys are available and are actual keys (not placeholders)
const hasRealKeys = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

  if (!apiKey || !projectId || !authDomain) return false;

  // If any key contains placeholder Thai characters or default instructions, it's not configured
  const containsPlaceholder = (val: string) => 
    val.includes("ใส่") || 
    val.includes("your-") || 
    val.includes("placeholder") ||
    val.includes(" ") || 
    val.includes("(") || // Detect parenthesis in placeholders
    /[\u0e00-\u0e7f]/.test(val);

  if (containsPlaceholder(apiKey) || containsPlaceholder(projectId) || containsPlaceholder(authDomain)) {
    return false;
  }

  // Real Firebase API Key usually starts with AIzaSy
  if (!apiKey.startsWith("AIzaSy")) {
    return false;
  }

  return true;
};

const isFirebaseConfigured = hasRealKeys();

export const getDatabaseMode = (): "supabase" | "firebase" | "mock" => {
  // Allow explicit override via env var (takes priority)
  const override = process.env.NEXT_PUBLIC_DATABASE_MODE;
  if (override === "firebase" || override === "supabase" || override === "mock") {
    return override;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder") && !supabaseUrl.includes("your-") && supabaseUrl !== "") {
    return "supabase";
  }
  if (isFirebaseConfigured) {
    return "firebase";
  }
  return "mock";
};

let app;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

/** Sync card pool overrides and custom cards to Firestore if configured. */
export async function saveCardsToFirestore(): Promise<void> {
  if (typeof window === "undefined") return;

  if (getDatabaseMode() === "supabase") {
    try {
      const { supabase } = await import("./supabase");
      const overrides = JSON.parse(localStorage.getItem(CARD_POOL_STORAGE_KEY) || "{}");
      const custom = JSON.parse(localStorage.getItem(CUSTOM_CARDS_KEY) || "[]");
      const dropRates = JSON.parse(localStorage.getItem(DROP_RATES_KEY) || "null");

      const payload: any = { overrides, custom };
      if (dropRates) payload.drop_rates = dropRates;

      await supabase
        .from('settings')
        .update(payload)
        .eq('id', 'cards');
    } catch (e) {
      console.error("saveCardsToSupabase error:", e);
    }
    return;
  }

  if (!isFirebaseConfigured || !db) return;
  try {
    const { doc, setDoc, deleteDoc, collection, getDocs } = await import("firebase/firestore");
    
    // Save drop rates in settings/cards (and overwrite to clean up old large overrides/custom fields)
    const dropRates = JSON.parse(localStorage.getItem(DROP_RATES_KEY) || "null");
    await setDoc(doc(db, "settings", "cards"), { dropRates });

    // Save Overrides in settings/cards/overrides subcollection
    const overrides = JSON.parse(localStorage.getItem(CARD_POOL_STORAGE_KEY) || "{}");
    for (const cardId of Object.keys(overrides)) {
      await setDoc(doc(db, "settings", "cards", "overrides", cardId), overrides[cardId]);
    }
    // Delete old overrides in Firestore that are no longer present
    const overridesCol = collection(db, "settings", "cards", "overrides");
    const overridesSnap = await getDocs(overridesCol);
    for (const d of overridesSnap.docs) {
      if (!overrides[d.id]) {
        await deleteDoc(doc(db, "settings", "cards", "overrides", d.id));
      }
    }

    // Save Custom Cards in settings/cards/custom subcollection
    const custom = JSON.parse(localStorage.getItem(CUSTOM_CARDS_KEY) || "[]");
    const customMap: Record<string, Card> = {};
    for (const card of custom) {
      customMap[card.id] = card;
      await setDoc(doc(db, "settings", "cards", "custom", card.id), card);
    }
    // Delete old custom cards in Firestore that are no longer present
    const customCol = collection(db, "settings", "cards", "custom");
    const customSnap = await getDocs(customCol);
    for (const d of customSnap.docs) {
      if (!customMap[d.id]) {
        await deleteDoc(doc(db, "settings", "cards", "custom", d.id));
      }
    }
  } catch (e) {
    console.error("saveCardsToFirestore error:", e);
    throw e;
  }
}

/** Sync card pool overrides and custom cards from Firestore to LocalStorage. */
export async function syncCardsFromFirestore(): Promise<void> {
  if (typeof window === "undefined") return;

  if (getDatabaseMode() === "supabase") {
    try {
      const { syncCardsFromSupabase } = await import("./supabase");
      await syncCardsFromSupabase();
    } catch (e) {
      console.error("syncCardsFromSupabase error:", e);
    }
    return;
  }

  if (!isFirebaseConfigured || !db) return;
  try {
    const { doc, getDoc, collection, getDocs } = await import("firebase/firestore");
    
    // 1. Fetch drop rates and check old structure for migration
    const docRef = doc(db, "settings", "cards");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.dropRates) {
        localStorage.setItem(DROP_RATES_KEY, JSON.stringify(data.dropRates));
      }
      // Migrate old data if present to keep it compatible!
      if (data.overrides && Object.keys(data.overrides).length > 0) {
        localStorage.setItem(CARD_POOL_STORAGE_KEY, JSON.stringify(data.overrides));
      }
      if (data.custom && data.custom.length > 0) {
        localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(data.custom));
      }
    }

    // 2. Fetch overrides from `settings/cards/overrides` subcollection
    const overridesSnap = await getDocs(collection(db, "settings", "cards", "overrides"));
    const overrides: Record<string, Partial<Card>> = {};
    overridesSnap.forEach((d) => {
      overrides[d.id] = d.data() as Partial<Card>;
    });
    if (!overridesSnap.empty) {
      localStorage.setItem(CARD_POOL_STORAGE_KEY, JSON.stringify(overrides));
    }

    // 3. Fetch custom cards from `settings/cards/custom` subcollection
    const customSnap = await getDocs(collection(db, "settings", "cards", "custom"));
    const custom: Card[] = [];
    customSnap.forEach((d) => {
      custom.push(d.data() as Card);
    });
    if (!customSnap.empty) {
      localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(custom));
    }

    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("syncCardsFromFirestore error:", e);
  }
}

// -------------------------------------------------------------
// LOCAL MOCK SERVICE (Fallback when Firebase is not configured)
// -------------------------------------------------------------
class MockDbService {
  private listeners: { [event: string]: Function[] } = {};

  constructor() {
    if (typeof window !== "undefined") {
      // Listen to storage events to sync across tabs
      window.addEventListener("storage", (e) => {
        if (e.key && (e.key.startsWith("mock_") || e.key === "mock_submissions")) {
          this.emit("change");
        }
      });
    }
  }

  private emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }

  public subscribe(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  // Helper getters/setters for localStorage
  public getItem<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  }

  public setItem<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
    this.emit("change");
  }

  // AUTH API
  public get currentUser(): UserProfile | null {
    return this.getItem<UserProfile | null>("mock_current_user", null);
  }

  public signInMock(role: "teacher" | "student", email?: string) {
    const defaultEmail = role === "teacher" ? "teacher@school.ac.th" : "student.somchai@school.ac.th";
    const displayName = role === "teacher" ? "ครูสุดประเสริฐ (Teacher)" : "เด็กชายสมชาย ดีใจ (Student)";
    
    // Check if profile already registered for this email in mock list
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    const registeredProfile = profiles[email || defaultEmail];

    const uniqueUid = `mock-${role}-${(email || defaultEmail).replace(/[^a-zA-Z0-9]/g, "-")}`;
    const mockUser: UserProfile = {
      uid: uniqueUid,
      email: email || defaultEmail,
      displayName: displayName,
      role: role,
      isRegistered: role === "teacher" ? true : !!registeredProfile,
      ...(registeredProfile || {})
    };

    this.setItem("mock_current_user", mockUser);
    this.emit("authChange", mockUser);
  }

  public signUpMock(
    username: string,
    password: string,
    profileData: { fullName: string; grade: string; room: string; studentNo: string }
  ): UserProfile {
    const customUsers = this.getItem<{ [username: string]: any }>("mock_custom_users", {});
    const lowerUsername = username.trim().toLowerCase();
    if (customUsers[lowerUsername]) {
      throw new Error("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
    }

    customUsers[lowerUsername] = {
      password,
      ...profileData
    };
    this.setItem("mock_custom_users", customUsers);

    const email = `${lowerUsername}@ictclassroom.local`;
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    profiles[email] = {
      fullName: profileData.fullName,
      grade: profileData.grade,
      room: profileData.room,
      studentNo: profileData.studentNo,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };
    this.setItem("mock_profiles", profiles);

    const uniqueUid = `mock-student-${lowerUsername}`;
    const mockUser: UserProfile = {
      uid: uniqueUid,
      email: email,
      displayName: profileData.fullName,
      role: "student",
      isRegistered: true,
      ...profileData,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };

    this.setItem("mock_current_user", mockUser);
    this.emit("authChange", mockUser);
    return mockUser;
  }

  public signInMockCustom(username: string, password: string): UserProfile {
    const customUsers = this.getItem<{ [username: string]: any }>("mock_custom_users", {});
    const lowerUsername = username.trim().toLowerCase();
    const userRecord = customUsers[lowerUsername];
    if (!userRecord || userRecord.password !== password) {
      throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    const email = `${lowerUsername}@ictclassroom.local`;
    const uniqueUid = `mock-student-${lowerUsername}`;

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    const profile = profiles[email] || {};

    const mockUser: UserProfile = {
      uid: uniqueUid,
      email: email,
      displayName: userRecord.fullName,
      role: "student",
      isRegistered: true,
      fullName: userRecord.fullName,
      grade: userRecord.grade || "4",
      room: userRecord.room,
      studentNo: userRecord.studentNo,
      packsCount: profile.packsCount || 0,
      cardsCollected: profile.cardsCollected || [],
      lastLoginDate: profile.lastLoginDate
    };

    this.setItem("mock_current_user", mockUser);
    this.emit("authChange", mockUser);
    return mockUser;
  }

  public registerProfile(profileData: { fullName: string; grade: string; room: string; studentNo: string }) {
    const user = this.currentUser;
    if (!user) return;

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    profiles[user.email || ""] = {
      ...profileData,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };
    this.setItem("mock_profiles", profiles);

    const updatedUser: UserProfile = {
      ...user,
      isRegistered: true,
      ...profileData,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };
    this.setItem("mock_current_user", updatedUser);
    this.emit("authChange", updatedUser);
  }

  public signOut() {
    this.setItem("mock_current_user", null);
    this.emit("authChange", null);
  }

  // LESSONS API
  public getLessons(): Lesson[] {
    return this.getItem<Lesson[]>("mock_lessons", [
      {
        id: "sample-lesson-1",
        title: "บทเรียนที่ 1: แนะนำวิชาเทคโนโลยีสารสนเทศ",
        content: "ยินดีต้อนรับนักเรียนทุกคนเข้าสู่บทเรียนแรก! วันนี้เราจะมาทำความรู้จักกับเทคโนโลยีสารสนเทศเบื้องต้นกันครับ ให้นักเรียนดูวิดีโอและทำความเข้าใจ",
        canvaUrl: "https://www.canva.com/design/DAFv7Z6-FvQ/view?embed",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        createdAt: Date.now() - 3600000 * 24,
        authorEmail: "teacher@school.ac.th"
      }
    ]);
  }

  public addLesson(
    title: string,
    content: string,
    canvaUrl: string,
    youtubeUrl: string,
    hasAssignment?: boolean,
    assignmentType?: "individual" | "group",
    assignmentDescription?: string,
    targetRooms?: string[]
  ) {
    const user = this.currentUser;
    if (!user || user.role !== "teacher") return;

    let assignmentId = "";
    if (hasAssignment) {
      const boards = this.getBoards();
      assignmentId = "board-" + Math.random().toString(36).substr(2, 9);
      const newBoard: AssignmentBoard = {
        id: assignmentId,
        title: `งาน: ${title}`,
        description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
        createdAt: Date.now(),
        type: assignmentType || "individual",
        lessonId: "", // Linked below
        isLocked: false,
        targetRooms: targetRooms || []
      };
      this.setItem("mock_boards", [newBoard, ...boards]);
    }

    const lessons = this.getLessons();
    const newLesson: Lesson = {
      id: "lesson-" + Math.random().toString(36).substr(2, 9),
      title,
      content,
      canvaUrl,
      youtubeUrl,
      createdAt: Date.now(),
      authorEmail: user.email || "teacher@school.ac.th",
      hasAssignment: !!hasAssignment,
      assignmentId,
      assignmentType,
      targetRooms: targetRooms || []
    };

    if (hasAssignment && assignmentId) {
      const boards = this.getBoards();
      const updatedBoards = boards.map(b => {
        if (b.id === assignmentId) {
          return { ...b, lessonId: newLesson.id };
        }
        return b;
      });
      this.setItem("mock_boards", updatedBoards);
    }

    this.setItem("mock_lessons", [newLesson, ...lessons]);
  }

  public deleteLesson(id: string) {
    const user = this.currentUser;
    if (!user || user.role !== "teacher") return;

    const lessons = this.getLessons();
    this.setItem("mock_lessons", lessons.filter(l => l.id !== id));
  }

  public updateLesson(
    id: string,
    title: string,
    content: string,
    canvaUrl: string,
    youtubeUrl: string,
    hasAssignment?: boolean,
    assignmentType?: "individual" | "group",
    assignmentDescription?: string,
    targetRooms?: string[],
    existingAssignmentId?: string
  ) {
    const user = this.currentUser;
    if (!user || user.role !== "teacher") return;

    let assignmentId = existingAssignmentId || "";
    const boards = this.getBoards();

    if (hasAssignment) {
      if (assignmentId) {
        // Update existing board in mock
        const updatedBoards = boards.map(b => {
          if (b.id === assignmentId) {
            return {
              ...b,
              title: `งาน: ${title}`,
              description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
              type: assignmentType || "individual",
              targetRooms: targetRooms || []
            };
          }
          return b;
        });
        this.setItem("mock_boards", updatedBoards);
      } else {
        // Create new board
        assignmentId = "board-" + Math.random().toString(36).substr(2, 9);
        const newBoard: AssignmentBoard = {
          id: assignmentId,
          title: `งาน: ${title}`,
          description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
          createdAt: Date.now(),
          type: assignmentType || "individual",
          lessonId: id,
          isLocked: false,
          targetRooms: targetRooms || []
        };
        this.setItem("mock_boards", [newBoard, ...boards]);
      }
    } else {
      if (assignmentId) {
        // Delete board
        this.setItem("mock_boards", boards.filter(b => b.id !== assignmentId));
        assignmentId = "";
      }
    }

    const lessons = this.getLessons();
    const updatedLessons = lessons.map(l => {
      if (l.id === id) {
        return {
          ...l,
          title,
          content,
          canvaUrl,
          youtubeUrl,
          hasAssignment: !!hasAssignment,
          assignmentId,
          assignmentType,
          targetRooms: targetRooms || []
        };
      }
      return l;
    });
    this.setItem("mock_lessons", updatedLessons);
  }

  // BOARDS API (Padlet Boards)
  public getBoards(): AssignmentBoard[] {
    return this.getItem<AssignmentBoard[]>("mock_boards", [
      {
        id: "board-1",
        title: "ใบงานที่ 1: ออกแบบโปสเตอร์แนะนำตัวเองด้วย Canva",
        description: "ให้นักเรียนนำลิงก์ผลงานการออกแบบโปสเตอร์แนะนำตัวเองจาก Canva มาแนบส่งในกระดานนี้ พร้อมอธิบายแนวคิดสั้นๆ และร่วมแสดงความคิดเห็นหรือกดไลค์ให้เพื่อนๆ ด้วยนะครับ",
        createdAt: Date.now() - 3600000 * 24,
        type: "individual",
        isLocked: false
      }
    ]);
  }

  public addBoard(title: string, description: string, type: "individual" | "group" = "individual", targetRooms?: string[]) {
    const user = this.currentUser;
    if (!user || user.role !== "teacher") return;

    const boards = this.getBoards();
    const newBoard: AssignmentBoard = {
      id: "board-" + Math.random().toString(36).substr(2, 9),
      title,
      description,
      createdAt: Date.now(),
      type,
      isLocked: false,
      targetRooms: targetRooms || []
    };

    this.setItem("mock_boards", [newBoard, ...boards]);
  }

  public deleteBoard(id: string) {
    const user = this.currentUser;
    if (!user || user.role !== "teacher") return;

    const boards = this.getBoards();
    this.setItem("mock_boards", boards.filter(b => b.id !== id));
  }

  public toggleLockBoard(boardId: string, isLocked: boolean) {
    const boards = this.getBoards();
    const updated = boards.map(b => b.id === boardId ? { ...b, isLocked } : b);
    this.setItem("mock_boards", updated);
  }

  // SUBMISSIONS API (Padlet Cards)
  public getSubmissions(boardId: string): Submission[] {
    const allSubmissions = this.getItem<Submission[]>("mock_submissions", [
      {
        id: "sub-1",
        boardId: "board-1",
        uid: "mock-student-id-2",
        studentName: "เด็กหญิงสมศรี รักดี",
        studentNo: "12",
        gradeClass: "ม.4/2",
        title: "โปสเตอร์แนะนำตัวของสมศรีค่ะ",
        description: "หนูใช้โทนสีชมพูพาสเทลเพื่อความสดใสและใส่ประวัติย่อกับการเรียนที่ชอบค่ะ",
        linkUrl: "https://www.canva.com/design/DAFv7Z6-FvQ/view",
        likes: ["mock-student-id"],
        comments: [
          {
            id: "comment-1",
            uid: "mock-teacher-id",
            authorName: "ครูสุดประเสริฐ (Teacher)",
            content: "จัดวางองค์ประกอบได้สวยงามและอ่านง่ายดีมากครับสมศรี!",
            createdAt: Date.now() - 3600000 * 2
          }
        ],
        createdAt: Date.now() - 3600000 * 5,
        isGroup: false,
        status: "pending"
      }
    ]);
    return allSubmissions.filter(s => s.boardId === boardId);
  }

  public addSubmission(
    boardId: string, 
    title: string, 
    description: string, 
    linkUrl: string, 
    isGroup: boolean = false, 
    members: { name: string; room: string; studentNo: string }[] = []
  ) {
    const user = this.currentUser;
    if (!user) return;

    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    const newSubmission: Submission = {
      id: "sub-" + Math.random().toString(36).substr(2, 9),
      boardId,
      uid: user.uid,
      studentName: user.fullName || user.displayName || "นักเรียน",
      studentNo: user.studentNo || "-",
      gradeClass: user.grade && user.room ? `ม.${user.grade}/${user.room}` : "ทั่วไป",
      title,
      description,
      linkUrl,
      likes: [],
      comments: [],
      createdAt: Date.now(),
      isGroup,
      members,
      status: "pending"
    };

    // Reward: 1 Pack for submitting
    // Reward: 1 Pack for submitting
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    
    const rewardUser = (emailToReward: string) => {
      if (profiles[emailToReward]) {
        profiles[emailToReward].packsCount = (profiles[emailToReward].packsCount || 0) + 1;
        if (user.email === emailToReward) {
          const updatedUser = { ...user, packsCount: profiles[emailToReward].packsCount };
          this.setItem("mock_current_user", updatedUser);
          this.emit("authChange", updatedUser);
        }
      }
    };

    if (isGroup && members && members.length > 0) {
      Object.keys(profiles).forEach(email => {
        const p = profiles[email];
        const matchedMember = members.find(m => String(m.room) === String(p.room) && String(m.studentNo) === String(p.studentNo));
        if (matchedMember) {
          rewardUser(email);
        }
      });
      // Safety fallback
      if (user.email && !members.find(m => String(m.room) === String(user.room) && String(m.studentNo) === String(user.studentNo))) {
        rewardUser(user.email);
      }
    } else {
      if (user.email) rewardUser(user.email);
    }
    
    this.setItem("mock_profiles", profiles);

    this.setItem("mock_submissions", [newSubmission, ...allSubmissions]);
  }

  public deleteSubmission(submissionId: string) {
    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    this.setItem("mock_submissions", allSubmissions.filter(s => s.id !== submissionId));
  }

  public toggleLike(submissionId: string) {
    const user = this.currentUser;
    if (!user) return;

    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    const updated = allSubmissions.map(sub => {
      if (sub.id === submissionId) {
        const hasLiked = sub.likes.includes(user.uid);
        const newLikes = hasLiked
          ? sub.likes.filter(id => id !== user.uid)
          : [...sub.likes, user.uid];
        return { ...sub, likes: newLikes };
      }
      return sub;
    });

    this.setItem("mock_submissions", updated);
  }

  public addComment(submissionId: string, content: string) {
    const user = this.currentUser;
    if (!user) return;

    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    const updated = allSubmissions.map(sub => {
      if (sub.id === submissionId) {
        const newComment = {
          id: "comment-" + Math.random().toString(36).substr(2, 9),
          uid: user.uid,
          authorName: user.fullName || user.displayName || "ผู้ใช้",
          content,
          createdAt: Date.now()
        };
        return { ...sub, comments: [...sub.comments, newComment] };
      }
      return sub;
    });

    this.setItem("mock_submissions", updated);
  }

  public gradeSubmission(
    submissionId: string,
    score: number,
    maxScore: number,
    status: "graded" | "resubmit",
    teacherFeedback: string,
    awardPack?: boolean
  ) {
    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    let targetSub: Submission | null = null;
    const updated = allSubmissions.map(sub => {
      if (sub.id === submissionId) {
        targetSub = sub;
        return {
          ...sub,
          score,
          maxScore,
          status,
          teacherFeedback
        };
      }
      return sub;
    });
    this.setItem("mock_submissions", updated);

    if (awardPack && targetSub) {
      const sub = targetSub as Submission;
      const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
      const rewardUser = (emailToReward: string) => {
        if (profiles[emailToReward]) {
          profiles[emailToReward].packsCount = (profiles[emailToReward].packsCount || 0) + 1;
        }
      };
      
      if (sub.isGroup && sub.members && sub.members.length > 0) {
        Object.keys(profiles).forEach(email => {
          const p = profiles[email];
          if (sub.members!.find(m => String(m.room) === String(p.room) && String(m.studentNo) === String(p.studentNo))) {
            rewardUser(email);
          }
        });
      } else {
         Object.keys(profiles).forEach(email => {
            const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
            if (mockUid === sub.uid) rewardUser(email);
         });
      }
      this.setItem("mock_profiles", profiles);
    }
  }

  public getRegisteredStudents(): UserProfile[] {
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    const students: UserProfile[] = [];
    Object.keys(profiles).forEach((email) => {
      const p = profiles[email];
      students.push({
        uid: `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`,
        email,
        displayName: p.fullName,
        fullName: p.fullName,
        grade: p.grade || "4",
        room: p.room || "1",
        studentNo: p.studentNo || "1",
        role: "student",
        isRegistered: true,
        packsCount: p.packsCount || 0,
        cardsCollected: p.cardsCollected || [],
        bonusPoints: p.bonusPoints || 0
      });
    });

    // Fallback if no student profile in DB yet, add a fake Somchai for debugging Gradebook
    if (students.length === 0) {
      students.push({
        uid: "mock-student-somchai",
        email: "student.somchai@school.ac.th",
        displayName: "เด็กชายสมชาย ดีใจ",
        fullName: "เด็กชายสมชาย ดีใจ",
        grade: "4",
        room: "1",
        studentNo: "15",
        role: "student",
        isRegistered: true,
        packsCount: 3,
        cardsCollected: [],
        bonusPoints: 0
      });
      students.push({
        uid: "mock-student-somsri",
        email: "student.somsri@school.ac.th",
        displayName: "เด็กหญิงสมศรี รักดี",
        fullName: "เด็กหญิงสมศรี รักดี",
        grade: "4",
        room: "2",
        studentNo: "12",
        role: "student",
        isRegistered: true,
        packsCount: 1,
        cardsCollected: [],
        bonusPoints: 0
      });
    }

    const curr = this.currentUser;
    if (curr && curr.role === "student" && curr.isRegistered) {
      if (!students.some(s => s.email === curr.email)) {
        const p = profiles[curr.email || ""] || {};
        students.push({
          ...curr,
          packsCount: p.packsCount || curr.packsCount || 0,
          cardsCollected: p.cardsCollected || curr.cardsCollected || [],
          bonusPoints: p.bonusPoints || curr.bonusPoints || 0
        });
      }
    }

    return students.sort((a, b) => Number(a.studentNo || 0) - Number(b.studentNo || 0));
  }

  public updateStudentProfile(uid: string, updates: { fullName?: string; grade?: string; room?: string; studentNo?: string }) {
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    const targetEmail = Object.keys(profiles).find(email => {
      return `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}` === uid;
    });

    if (targetEmail) {
      profiles[targetEmail] = { ...profiles[targetEmail], ...updates };
      this.setItem("mock_profiles", profiles);

      // If updating current user, update session too
      const user = this.currentUser;
      if (user && user.email === targetEmail) {
        const updatedUser = { ...user, ...updates };
        this.setItem("mock_current_user", updatedUser);
        this.emit("authChange", updatedUser);
      }
    }
  }

  public mergeStudents(sourceUid: string, targetUid: string) {
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    
    // Find target and source emails
    let sourceEmail = "";
    let targetEmail = "";
    
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === sourceUid) sourceEmail = email;
      if (mockUid === targetUid) targetEmail = email;
    });

    if (sourceUid === "mock-student-somchai") sourceEmail = "student.somchai@school.ac.th";
    if (sourceUid === "mock-student-somsri") sourceEmail = "student.somsri@school.ac.th";
    if (targetUid === "mock-student-somchai") targetEmail = "student.somchai@school.ac.th";
    if (targetUid === "mock-student-somsri") targetEmail = "student.somsri@school.ac.th";

    if (!sourceEmail || !targetEmail || sourceEmail === targetEmail) {
      throw new Error("ไม่สามารถระบุบัญชีผู้ใช้เพื่อรวมข้อมูลได้");
    }

    const sourceProfile = profiles[sourceEmail] || {};
    const targetProfile = profiles[targetEmail] || {};

    // 1. Merge cardsCollected
    const sourceCards: CardCollected[] = sourceProfile.cardsCollected || [];
    const targetCards: CardCollected[] = targetProfile.cardsCollected || [];
    const mergedCardsMap = new Map<string, CardCollected>();

    targetCards.forEach(c => {
      mergedCardsMap.set(c.cardId, { ...c });
    });

    sourceCards.forEach(c => {
      const existing = mergedCardsMap.get(c.cardId);
      if (existing) {
        existing.count = (existing.count || 0) + (c.count || 0);
        existing.redeemedCount = (existing.redeemedCount || 0) + (c.redeemedCount || 0);
      } else {
        mergedCardsMap.set(c.cardId, { ...c });
      }
    });

    // 2. Merge stats
    targetProfile.cardsCollected = Array.from(mergedCardsMap.values());
    targetProfile.packsCount = (targetProfile.packsCount || 0) + (sourceProfile.packsCount || 0);
    targetProfile.bonusPoints = (targetProfile.bonusPoints || 0) + (sourceProfile.bonusPoints || 0);
    targetProfile.totalPacksOpened = (targetProfile.totalPacksOpened || 0) + (sourceProfile.totalPacksOpened || 0);
    targetProfile.isMerged = true;

    profiles[targetEmail] = targetProfile;
    // Delete source profile
    delete profiles[sourceEmail];
    
    this.setItem("mock_profiles", profiles);

    // 3. Update mock custom users if they exist (password logins)
    const customUsers = this.getItem<{ [username: string]: any }>("mock_custom_users", {});
    const sourceUsername = sourceEmail.split("@")[0];
    if (customUsers[sourceUsername]) {
      delete customUsers[sourceUsername];
      this.setItem("mock_custom_users", customUsers);
    }

    // 4. Update mock submissions
    const allSubmissions = this.getItem<Submission[]>("mock_submissions", []);
    const updatedSubmissions = allSubmissions.map(sub => {
      if (sub.uid === sourceUid) {
        return {
          ...sub,
          uid: targetUid,
          studentName: targetProfile.fullName || sub.studentName,
          studentNo: targetProfile.studentNo || sub.studentNo,
          gradeClass: targetProfile.grade && targetProfile.room ? `ม.${targetProfile.grade}/${targetProfile.room}` : sub.gradeClass
        };
      }
      return sub;
    });
    this.setItem("mock_submissions", updatedSubmissions);

    // 5. Update mock redemptions
    const allRedemptions = this.getItem<RedemptionRequest[]>("mock_redemptions", []);
    const updatedRedemptions = allRedemptions.map(req => {
      if (req.studentUid === sourceUid) {
        return {
          ...req,
          studentUid: targetUid,
          studentName: targetProfile.fullName || req.studentName,
          studentRoom: targetProfile.room || req.studentRoom
        };
      }
      return req;
    });
    this.setItem("mock_redemptions", updatedRedemptions);

    // If current logged-in user is the source, sign out/clear session
    const curr = this.currentUser;
    if (curr && curr.uid === sourceUid) {
      this.setItem("mock_current_user", null);
      this.emit("authChange", null);
    } else if (curr && curr.uid === targetUid) {
      const updatedUser: UserProfile = {
        ...curr,
        packsCount: targetProfile.packsCount,
        cardsCollected: targetProfile.cardsCollected,
        bonusPoints: targetProfile.bonusPoints,
        totalPacksOpened: targetProfile.totalPacksOpened
      };
      this.setItem("mock_current_user", updatedUser);
      this.emit("authChange", updatedUser);
    }

    this.emit("change");
  }

  public deleteStudent(uid: string) {
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    
    // Find email of user
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === uid) foundEmail = email;
    });

    if (uid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (uid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";

    if (foundEmail) {
      delete profiles[foundEmail];
      this.setItem("mock_profiles", profiles);
    }

    // Also remove from custom users if matching username
    const customUsers = this.getItem<{ [username: string]: any }>("mock_custom_users", {});
    const username = foundEmail ? foundEmail.split("@")[0] : "";
    if (username && customUsers[username]) {
      delete customUsers[username];
      this.setItem("mock_custom_users", customUsers);
    }

    this.emit("change");
  }

  // CARDS & GACHA API
  public awardPack(studentUid: string, count: number) {
    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === studentUid) foundEmail = email;
    });

    if (studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";

    if (!foundEmail && studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) {
        foundEmail = curr.email || "";
      }
    }

    if (foundEmail) {
      if (!profiles[foundEmail]) {
        profiles[foundEmail] = {};
      }
      profiles[foundEmail].packsCount = (profiles[foundEmail].packsCount || 0) + count;
      this.setItem("mock_profiles", profiles);

      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) {
        this.setItem("mock_current_user", {
          ...curr,
          packsCount: profiles[foundEmail].packsCount
        });
        this.emit("authChange", this.currentUser);
      }
    }
  }

  public getStudentPacks(studentUid: string): CardPack[] {
    const students = this.getRegisteredStudents();
    const student = students.find(s => s.uid === studentUid);
    if (!student) return [];

    const packsCount = student.packsCount || 0;
    const packs: CardPack[] = [];
    for (let i = 0; i < packsCount; i++) {
      packs.push({
        id: `pack-${studentUid}-${i}-${Date.now()}`,
        studentUid,
        studentName: student.fullName || student.displayName || "นักเรียน",
        studentRoom: student.room || "",
        isOpened: false,
        createdAt: Date.now()
      });
    }
    return packs;
  }

  public openPack(studentUid: string): Card[] {
    const students = this.getRegisteredStudents();
    const student = students.find(s => s.uid === studentUid);
    if (!student || (student.packsCount || 0) <= 0) return [];

    const rates = getDropRates().pack;
    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      
      const holoLimit = rates.holographic;
      const legLimit = holoLimit + rates.legendary;
      const epicLimit = legLimit + rates.epic;
      const rareLimit = epicLimit + rates.rare;

      if (rand < holoLimit) {
        selectedRarity = "holographic";
      } else if (rand < legLimit) {
        selectedRarity = "legendary";
      } else if (rand < epicLimit) {
        selectedRarity = "epic";
      } else if (rand < rareLimit) {
        selectedRarity = "rare";
      } else {
        selectedRarity = "common";
      }

      const activePool = getCardPool();
      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard(), drawRandomCard()];

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === studentUid) foundEmail = email;
    });

    if (studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";
    
    if (!foundEmail && studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) foundEmail = curr.email || "";
    }

    if (foundEmail) {
      if (!profiles[foundEmail]) {
        profiles[foundEmail] = {};
      }
      profiles[foundEmail].packsCount = Math.max(0, (profiles[foundEmail].packsCount || 0) - 1);
      
      const currentCollection = profiles[foundEmail].cardsCollected || [];
      newCards.forEach(card => {
        const existing = currentCollection.find((c: any) => c.cardId === card.id);
        if (existing) {
          existing.count = (existing.count || 0) + 1;
        } else {
          currentCollection.push({ cardId: card.id, count: 1, redeemedCount: 0 });
        }
      });

      profiles[foundEmail].cardsCollected = currentCollection;
      this.setItem("mock_profiles", profiles);

      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) {
        this.setItem("mock_current_user", {
          ...curr,
          packsCount: profiles[foundEmail].packsCount,
          cardsCollected: profiles[foundEmail].cardsCollected
        });
        this.emit("authChange", this.currentUser);
      }
    }

    return newCards;
  }

  public requestRedemption(studentUid: string, cardId: string): RedemptionRequest | null {
    const students = this.getRegisteredStudents();
    const student = students.find(s => s.uid === studentUid);
    if (!student) return null;

    const collection = student.cardsCollected || [];
    const cardOwned = collection.find(c => c.cardId === cardId);
    if (!cardOwned || (cardOwned.count || 0) <= (cardOwned.redeemedCount || 0)) {
      return null;
    }

    const card = getCardPool().find(c => c.id === cardId);
    if (!card) return null;

    const allRedemptions = this.getItem<RedemptionRequest[]>("mock_redemptions", []);
    const newReq: RedemptionRequest = {
      id: "req-" + Math.random().toString(36).substr(2, 9),
      studentUid,
      studentName: student.fullName || student.displayName || "นักเรียน",
      studentRoom: student.room || "",
      cardId,
      cardName: card.name,
      rarity: card.rarity,
      bonusPoints: card.bonusPoints,
      status: "pending",
      createdAt: Date.now()
    };

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === studentUid) foundEmail = email;
    });
    if (studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";
    if (!foundEmail && studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) foundEmail = curr.email || "";
    }

    if (foundEmail && profiles[foundEmail]) {
      const coll = profiles[foundEmail].cardsCollected || [];
      const cOwn = coll.find((c: any) => c.cardId === cardId);
      if (cOwn) {
        cOwn.redeemedCount = (cOwn.redeemedCount || 0) + 1;
      }
      profiles[foundEmail].cardsCollected = coll;
      this.setItem("mock_profiles", profiles);

      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) {
        this.setItem("mock_current_user", {
          ...curr,
          cardsCollected: profiles[foundEmail].cardsCollected
        });
        this.emit("authChange", this.currentUser);
      }
    }

    this.setItem("mock_redemptions", [newReq, ...allRedemptions]);
    return newReq;
  }

  public getRedemptions(): RedemptionRequest[] {
    return this.getItem<RedemptionRequest[]>("mock_redemptions", []);
  }

  public approveRedemption(requestId: string) {
    const allRedemptions = this.getItem<RedemptionRequest[]>("mock_redemptions", []);
    const req = allRedemptions.find(r => r.id === requestId);
    if (!req) return;

    req.status = "approved";
    this.setItem("mock_redemptions", allRedemptions);

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === req.studentUid) foundEmail = email;
    });
    if (req.studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (req.studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";
    if (!foundEmail && req.studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === req.studentUid) foundEmail = curr.email || "";
    }

    if (foundEmail && profiles[foundEmail]) {
      profiles[foundEmail].bonusPoints = (profiles[foundEmail].bonusPoints || 0) + req.bonusPoints;
      this.setItem("mock_profiles", profiles);

      const curr = this.currentUser;
      if (curr && curr.uid === req.studentUid) {
        this.setItem("mock_current_user", {
          ...curr,
          bonusPoints: profiles[foundEmail].bonusPoints
        });
        this.emit("authChange", this.currentUser);
      }
    }
  }

  public rejectRedemption(requestId: string) {
    const allRedemptions = this.getItem<RedemptionRequest[]>("mock_redemptions", []);
    const req = allRedemptions.find(r => r.id === requestId);
    if (!req) return;

    req.status = "rejected";
    this.setItem("mock_redemptions", allRedemptions);

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === req.studentUid) foundEmail = email;
    });
    if (req.studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (req.studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";
    if (!foundEmail && req.studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === req.studentUid) foundEmail = curr.email || "";
    }

    if (foundEmail && profiles[foundEmail]) {
      const coll = profiles[foundEmail].cardsCollected || [];
      const cOwn = coll.find((c: any) => c.cardId === req.cardId);
      if (cOwn) {
        cOwn.redeemedCount = Math.max(0, (cOwn.redeemedCount || 0) - 1);
      }
      profiles[foundEmail].cardsCollected = coll;
      this.setItem("mock_profiles", profiles);

      const curr = this.currentUser;
      if (curr && curr.uid === req.studentUid) {
        this.setItem("mock_current_user", {
          ...curr,
          cardsCollected: profiles[foundEmail].cardsCollected
        });
        this.emit("authChange", this.currentUser);
      }
    }
  }

  public exchangeCommonCards(studentUid: string): Card[] | null {
    const students = this.getRegisteredStudents();
    const student = students.find(s => s.uid === studentUid);
    if (!student) return null;

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    let foundEmail = "";
    Object.keys(profiles).forEach(email => {
      const mockUid = `mock-student-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (mockUid === studentUid) foundEmail = email;
    });
    if (studentUid === "mock-student-somchai") foundEmail = "student.somchai@school.ac.th";
    if (studentUid === "mock-student-somsri") foundEmail = "student.somsri@school.ac.th";
    if (!foundEmail && studentUid.startsWith("mock-student-")) {
      const curr = this.currentUser;
      if (curr && curr.uid === studentUid) foundEmail = curr.email || "";
    }

    if (!foundEmail || !profiles[foundEmail]) return null;

    const coll = profiles[foundEmail].cardsCollected || [];
    
    const activePool = getCardPool();
    let commonAvailable = 0;
    coll.forEach((item: any) => {
      const card = activePool.find(c => c.id === item.cardId);
      if (card && card.rarity === "common") {
        commonAvailable += (item.count || 0) - (item.redeemedCount || 0);
      }
    });

    if (commonAvailable < 5) return null;

    let toDeduct = 5;
    for (const item of coll) {
      if (toDeduct <= 0) break;
      const card = activePool.find(c => c.id === item.cardId);
      if (card && card.rarity === "common") {
        const available = (item.count || 0) - (item.redeemedCount || 0);
        if (available > 0) {
          const deduct = Math.min(available, toDeduct);
          item.count -= deduct;
          toDeduct -= deduct;
        }
      }
    }

    profiles[foundEmail].cardsCollected = coll.filter((item: any) => item.count > 0 || item.redeemedCount > 0);

    // Exchange odds — 2x better than normal gacha packs:
    // Holographic 0.4% | Legendary 1.0% | Epic 6% | Rare 20% | Common ~72.6%
    const rates = getDropRates().exchange;
    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      
      const holoLimit = rates.holographic;
      const legLimit = holoLimit + rates.legendary;
      const epicLimit = legLimit + rates.epic;
      const rareLimit = epicLimit + rates.rare;

      if (rand < holoLimit) selectedRarity = "holographic";
      else if (rand < legLimit) selectedRarity = "legendary";
      else if (rand < epicLimit) selectedRarity = "epic";
      else if (rand < rareLimit) selectedRarity = "rare";
      else selectedRarity = "common";

      const activePool = getCardPool();
      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard()];
    const updatedColl = profiles[foundEmail].cardsCollected;
    
    for (const newCard of newCards) {
      const existing = updatedColl.find((c: any) => c.cardId === newCard.id);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
      } else {
        updatedColl.push({ cardId: newCard.id, count: 1, redeemedCount: 0 });
      }
    }

    this.setItem("mock_profiles", profiles);

    const curr = this.currentUser;
    if (curr && curr.uid === studentUid) {
      this.setItem("mock_current_user", {
        ...curr,
        cardsCollected: profiles[foundEmail].cardsCollected
      });
      this.emit("authChange", this.currentUser);
    }

    return newCards;
  }

}

export const mockDb = new MockDbService();

// -------------------------------------------------------------
// UNIFIED DATA SERVICE (Switchable between Real Firebase and Mock)
// -------------------------------------------------------------
export const isMockMode = () => getDatabaseMode() === "mock";

// Flag to prevent onAuthStateChanged from racing with signUpWithUsernamePassword
let _isSigningUp = false;

const fbAuthService = {
  signInWithGoogle: async (role: "teacher" | "student" = "student", email?: string): Promise<UserProfile> => {
    if (isMockMode()) {
      mockDb.signInMock(role, email);
      return mockDb.currentUser!;
    }

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if profile exists in firestore
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    let roleToAssign: "teacher" | "student" = "student";
    // Check if the user email matches the teacher email
    const teacherEmail = process.env.NEXT_PUBLIC_TEACHER_EMAIL || "teacher@school.ac.th";
    if (user.email === teacherEmail) {
      roleToAssign = "teacher";
    }

    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: data.role || roleToAssign,
        isRegistered: data.isRegistered || false,
        fullName: data.fullName,
        grade: data.grade,
        room: data.room,
        studentNo: data.studentNo
      };
    } else {
      // Create user record
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: roleToAssign,
        isRegistered: roleToAssign === "teacher" // Teachers are auto-registered
      };
      await setDoc(userDocRef, newUser);
      return newUser;
    }
  },

  signUpWithUsernamePassword: async (
    username: string,
    password: string,
    profileData: { fullName: string; grade: string; room: string; studentNo: string }
  ): Promise<UserProfile> => {
    const cleanUsername = username.trim().toLowerCase();
    const email = `${cleanUsername}@ictclassroom.local`;

    if (isMockMode()) {
      return mockDb.signUpMock(username, password, profileData);
    }

    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    
    // Check if username already exists in Firestore
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
    }

    // Set flag to prevent onAuthStateChanged from racing with us
    _isSigningUp = true;

    let credential: any;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      _isSigningUp = false;
      console.error("Firebase SignUp Error:", err);
      const errMsg = err?.message || String(err) || "";
      const errCode = err?.code || "";

      // Translate Firebase error messages to Thai
      if (errCode === "auth/email-already-in-use" || errMsg.includes("email-already-in-use")) {
        throw new Error("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
      }
      if (errCode === "auth/weak-password" || errMsg.includes("weak-password")) {
        throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      }
      if (errCode === "auth/invalid-email" || errMsg.includes("invalid-email")) {
        throw new Error("ชื่อผู้ใช้ไม่ถูกต้อง กรุณาใช้ภาษาอังกฤษหรือตัวเลขเท่านั้น");
      }
      if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        throw new Error("ระบบสมัครสมาชิกด้วยรหัสผ่านยังไม่ได้เปิดใช้งาน กรุณาเปิดใช้งาน 'Email/Password' ใน Firebase Console");
      }
      if (errCode === "auth/network-request-failed" || errMsg.includes("network-request-failed")) {
        throw new Error("ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ");
      }
      if (errCode === "auth/too-many-requests" || errMsg.includes("too-many-requests")) {
        throw new Error("มีการลองสมัครสมาชิกมากเกินไป กรุณารอสักครู่แล้วลองใหม่");
      }
      throw new Error("เกิดข้อผิดพลาดในการสมัครสมาชิก: " + (errMsg || "กรุณาลองใหม่อีกครั้ง"));
    }

    const user = credential.user;

    const newUser: UserProfile = {
      uid: user.uid,
      email: email,
      displayName: profileData.fullName,
      role: "student",
      isRegistered: true,
      fullName: profileData.fullName,
      grade: profileData.grade,
      room: profileData.room,
      studentNo: profileData.studentNo,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };

    // Write Firestore doc BEFORE clearing the sign-up flag
    await setDoc(doc(db, "users", user.uid), newUser);

    // Now clear the flag — onAuthStateChanged can proceed safely
    _isSigningUp = false;

    return newUser;
  },

  signInWithUsernamePassword: async (username: string, password: string): Promise<UserProfile> => {
    const cleanUsername = username.trim().toLowerCase();
    const email = `${cleanUsername}@ictclassroom.local`;

    if (isMockMode()) {
      return mockDb.signInMockCustom(username, password);
    }

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Firebase SignIn Error:", err);
      const errMsg = err?.message || String(err) || "";
      const errCode = err?.code || "";

      if (errCode === "auth/user-not-found" || errCode === "auth/invalid-credential" || errMsg.includes("user-not-found") || errMsg.includes("invalid-credential")) {
        throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
      if (errCode === "auth/wrong-password" || errMsg.includes("wrong-password")) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }
      if (errCode === "auth/too-many-requests" || errMsg.includes("too-many-requests")) {
        throw new Error("มีการลองเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่");
      }
      if (errCode === "auth/network-request-failed" || errMsg.includes("network-request-failed")) {
        throw new Error("ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ");
      }
      throw new Error("เข้าสู่ระบบไม่สำเร็จ: " + (errMsg || "กรุณาลองใหม่อีกครั้ง"));
    }
    const user = credential.user;

    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      throw new Error("ไม่พบข้อมูลผู้ใช้");
    }

    const data = userSnap.data();
    return {
      uid: user.uid,
      email: email,
      displayName: data.displayName || data.fullName,
      role: data.role || "student",
      isRegistered: data.isRegistered || false,
      fullName: data.fullName,
      grade: data.grade,
      room: data.room,
      studentNo: data.studentNo,
      packsCount: data.packsCount || 0,
      lastLoginDate: data.lastLoginDate
    };
  },

  registerProfile: async (profileData: { fullName: string; grade: string; room: string; studentNo: string }): Promise<void> => {
    if (isMockMode()) {
      mockDb.registerProfile(profileData);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    const userDocRef = doc(db, "users", currentUser.uid);
    await setDoc(userDocRef, {
      ...profileData,
      isRegistered: true,
      packsCount: 3,
      lastLoginDate: new Date().toISOString().split('T')[0]
    }, { merge: true });
  },

  signOut: async (): Promise<void> => {
    if (isMockMode()) {
      mockDb.signOut();
      return;
    }
    await fbSignOut(auth);
  },

  onAuthStateChanged: (callback: (user: UserProfile | null) => void) => {
    if (isMockMode()) {
      const handleMockUser = (user: UserProfile | null) => {
        if (user && user.role === "student" && user.isRegistered) {
          const today = new Date().toISOString().split('T')[0];
          if (user.lastLoginDate !== today) {
            const profiles = mockDb.getItem<{ [email: string]: any }>("mock_profiles", {});
            const profile = profiles[user.email || ""] || {};
            profile.packsCount = (profile.packsCount || 0) + 1;
            profile.lastLoginDate = today;
            profiles[user.email || ""] = profile;
            mockDb.setItem("mock_profiles", profiles);
            
            user.packsCount = profile.packsCount;
            user.lastLoginDate = today;
            mockDb.setItem("mock_current_user", user);
          }
        }
        callback(user);
      };

      handleMockUser(mockDb.currentUser);
      return mockDb.subscribe("authChange", (user: UserProfile | null) => {
        handleMockUser(user);
      });
    }

    return fbOnAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (!user) {
        callback(null);
        return;
      }

      // If a sign-up is in progress, skip — signUpWithUsernamePassword will
      // handle setting the user state after writing the Firestore doc.
      if (_isSigningUp) {
        return;
      }

      // Sync card definitions from Firestore
      try {
        await syncCardsFromFirestore();
      } catch (err) {
        console.error("Error syncing cards on auth state change:", err);
      }

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      let roleToAssign: "teacher" | "student" = "student";
      const teacherEmail = process.env.NEXT_PUBLIC_TEACHER_EMAIL || "teacher@school.ac.th";
      if (user.email === teacherEmail) {
        roleToAssign = "teacher";
      }

      if (userSnap.exists()) {
        const data = userSnap.data();
        let packsCount = data.packsCount || 0;
        let lastLoginDate = data.lastLoginDate;
        
        const today = new Date().toISOString().split('T')[0];
        if (data.role === "student" && lastLoginDate !== today) {
           packsCount += 1;
           lastLoginDate = today;
           updateDoc(userDocRef, { packsCount, lastLoginDate }).catch(console.error);
        }

        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: data.role || roleToAssign,
          isRegistered: data.isRegistered || false,
          fullName: data.fullName,
          grade: data.grade,
          room: data.room,
          studentNo: data.studentNo,
          packsCount,
          lastLoginDate
        });
      } else {
        const newUser: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: roleToAssign,
          isRegistered: roleToAssign === "teacher"
        };
        await setDoc(userDocRef, newUser);
        callback(newUser);
      }
    });
  },

  getRegisteredStudents: async (): Promise<UserProfile[]> => {
    if (isMockMode()) {
      return mockDb.getRegisteredStudents();
    }
    try {
      const { getDocs, query, where, doc, setDoc } = await import("firebase/firestore");
      const q = query(collection(db, "users"), where("role", "==", "student"), where("isRegistered", "==", true));
      const snapshot = await getDocs(q);
      const fbStudentsMap = new Map<string, UserProfile>();
      snapshot.forEach((doc) => {
        fbStudentsMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
      });

      // Synchronize missing accounts from Supabase users table (which contains the custom credentials)
      try {
        console.log("[getRegisteredStudents] Fetching registered students from Supabase to sync to Firestore...");
        const sbStudents = await sb.authService.getRegisteredStudents();
        for (const sbStud of sbStudents) {
          if (!fbStudentsMap.has(sbStud.uid)) {
            console.log(`[getRegisteredStudents] Account ${sbStud.uid} not in Firestore. Syncing...`);
            const newFbUser: UserProfile = {
              uid: sbStud.uid,
              email: sbStud.email,
              displayName: sbStud.displayName,
              role: sbStud.role,
              isRegistered: sbStud.isRegistered,
              fullName: sbStud.fullName,
              grade: sbStud.grade,
              room: sbStud.room,
              studentNo: sbStud.studentNo,
              packsCount: sbStud.packsCount ?? 3,
              bonusPoints: sbStud.bonusPoints ?? 0,
              cardsCollected: sbStud.cardsCollected ?? [],
              lastLoginDate: sbStud.lastLoginDate || new Date().toISOString().split('T')[0],
              totalPacksOpened: sbStud.totalPacksOpened ?? 0,
              isMerged: sbStud.isMerged ?? false
            };
            await setDoc(doc(db, "users", sbStud.uid), newFbUser);
            fbStudentsMap.set(sbStud.uid, newFbUser);
          }
        }
      } catch (syncErr) {
        console.error("Error syncing Supabase students to Firestore:", syncErr);
      }

      const students = Array.from(fbStudentsMap.values());
      return students.sort((a, b) => Number(a.studentNo || 0) - Number(b.studentNo || 0));
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  },

  getStudentProfile: async (uid: string): Promise<UserProfile | null> => {
    if (isMockMode()) {
      const students = mockDb.getRegisteredStudents();
      return students.find(s => s.uid === uid) || null;
    }
    try {
      const userDocRef = doc(db!, "users", uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        return { uid: userSnap.id, ...userSnap.data() } as UserProfile;
      }

      // If document does not exist in Firestore, search in Supabase and sync
      console.log(`[getStudentProfile] UID ${uid} not found in Firestore. Checking Supabase...`);
      const sbProfile = await sb.authService.getStudentProfile(uid);
      if (sbProfile) {
        console.log(`[getStudentProfile] Found profile in Supabase for ${uid}. Syncing to Firestore...`);
        const newFbUser: UserProfile = {
          uid: sbProfile.uid,
          email: sbProfile.email,
          displayName: sbProfile.displayName,
          role: sbProfile.role,
          isRegistered: sbProfile.isRegistered,
          fullName: sbProfile.fullName,
          grade: sbProfile.grade,
          room: sbProfile.room,
          studentNo: sbProfile.studentNo,
          packsCount: sbProfile.packsCount ?? 3,
          bonusPoints: sbProfile.bonusPoints ?? 0,
          cardsCollected: sbProfile.cardsCollected ?? [],
          lastLoginDate: sbProfile.lastLoginDate || new Date().toISOString().split('T')[0],
          totalPacksOpened: sbProfile.totalPacksOpened ?? 0,
          isMerged: sbProfile.isMerged ?? false
        };
        await setDoc(userDocRef, newFbUser);
        return newFbUser;
      }
      return null;
    } catch (error) {
      console.error("Error fetching student profile:", error);
      return null;
    }
  },

  updateStudentProfile: async (uid: string, updates: { fullName?: string; grade?: string; room?: string; studentNo?: string }): Promise<void> => {
    if (isMockMode()) {
      mockDb.updateStudentProfile(uid, updates);
      return;
    }
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, updates);
  },

  mergeStudents: async (sourceUid: string, targetUid: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.mergeStudents(sourceUid, targetUid);
      return;
    }

    const { doc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch } = await import("firebase/firestore");

    const sourceDocRef = doc(db, "users", sourceUid);
    const targetDocRef = doc(db, "users", targetUid);

    const [sourceSnap, targetSnap] = await Promise.all([
      getDoc(sourceDocRef),
      getDoc(targetDocRef)
    ]);

    if (!sourceSnap.exists() || !targetSnap.exists()) {
      throw new Error("ไม่พบข้อมูลนักเรียนบัญชีใดบัญชีหนึ่งในระบบ");
    }

    const sourceData = sourceSnap.data() as UserProfile;
    const targetData = targetSnap.data() as UserProfile;

    // 1. Merge cardsCollected
    const sourceCards: CardCollected[] = sourceData.cardsCollected || [];
    const targetCards: CardCollected[] = targetData.cardsCollected || [];
    const mergedCardsMap = new Map<string, CardCollected>();

    targetCards.forEach(c => {
      mergedCardsMap.set(c.cardId, { ...c });
    });

    sourceCards.forEach(c => {
      const existing = mergedCardsMap.get(c.cardId);
      if (existing) {
        existing.count = (existing.count || 0) + (c.count || 0);
        existing.redeemedCount = (existing.redeemedCount || 0) + (c.redeemedCount || 0);
      } else {
        mergedCardsMap.set(c.cardId, { ...c });
      }
    });

    // Create updates for target user profile
    const targetUpdates = {
      cardsCollected: Array.from(mergedCardsMap.values()),
      packsCount: (targetData.packsCount || 0) + (sourceData.packsCount || 0),
      bonusPoints: (targetData.bonusPoints || 0) + (sourceData.bonusPoints || 0),
      totalPacksOpened: (targetData.totalPacksOpened || 0) + (sourceData.totalPacksOpened || 0),
      isMerged: true
    };

    // 2. Fetch and prepare updates for all submissions
    const subQuery = query(collection(db, "submissions"), where("uid", "==", sourceUid));
    const subSnap = await getDocs(subQuery);

    // 3. Fetch and prepare updates for all redemption requests
    const redempQuery = query(collection(db, "redemptions"), where("studentUid", "==", sourceUid));
    const redempSnap = await getDocs(redempQuery);

    // Using Batch for atomic operations
    const batch = writeBatch(db);

    // Update target profile
    batch.update(targetDocRef, targetUpdates);

    // Update submissions to target profile details
    subSnap.forEach(subDoc => {
      batch.update(subDoc.ref, {
        uid: targetUid,
        studentName: targetData.fullName || targetData.displayName || "นักเรียน",
        studentNo: targetData.studentNo || "",
        gradeClass: targetData.grade && targetData.room ? `ม.${targetData.grade}/${targetData.room}` : "ทั่วไป"
      });
    });

    // Update redemptions to target profile details
    redempSnap.forEach(redempDoc => {
      batch.update(redempDoc.ref, {
        studentUid: targetUid,
        studentName: targetData.fullName || targetData.displayName || "นักเรียน",
        studentRoom: targetData.room || ""
      });
    });

    // Delete source profile doc
    batch.delete(sourceDocRef);

    // Commit all updates
    await batch.commit();
  },

  deleteStudent: async (uid: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.deleteStudent(uid);
      return;
    }
    const { doc, deleteDoc } = await import("firebase/firestore");
    const userDocRef = doc(db, "users", uid);
    await deleteDoc(userDocRef);
  }
};

const fbLessonService = {
  subscribeLessons: (callback: (lessons: Lesson[]) => void) => {
    if (isMockMode()) {
      callback(mockDb.getLessons());
      return mockDb.subscribe("change", () => {
        callback(mockDb.getLessons());
      });
    }

    const q = query(collection(db, "lessons"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const lessons: Lesson[] = [];
      snapshot.forEach((doc) => {
        lessons.push({ id: doc.id, ...doc.data() } as Lesson);
      });
      callback(lessons);
    });
  },

  addLesson: async (
    title: string, 
    content: string, 
    canvaUrl: string, 
    youtubeUrl: string,
    hasAssignment?: boolean,
    assignmentType?: "individual" | "group",
    assignmentDescription?: string,
    targetRooms?: string[]
  ): Promise<void> => {
    if (isMockMode()) {
      mockDb.addLesson(title, content, canvaUrl, youtubeUrl, hasAssignment, assignmentType, assignmentDescription, targetRooms);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    let assignmentId = "";
    if (hasAssignment) {
      const boardRef = await addDoc(collection(db, "boards"), {
        title: `งาน: ${title}`,
        description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
        createdAt: Date.now(),
        type: assignmentType || "individual",
        lessonId: "", // Link below
        isLocked: false,
        targetRooms: targetRooms || []
      });
      assignmentId = boardRef.id;
    }

    const lessonRef = await addDoc(collection(db, "lessons"), {
      title,
      content,
      canvaUrl,
      youtubeUrl,
      createdAt: Date.now(),
      authorEmail: currentUser.email,
      hasAssignment: !!hasAssignment,
      assignmentId,
      assignmentType: assignmentType || "",
      targetRooms: targetRooms || []
    });

    if (hasAssignment && assignmentId) {
      await updateDoc(doc(db, "boards", assignmentId), {
        lessonId: lessonRef.id
      });
    }
  },

  deleteLesson: async (id: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.deleteLesson(id);
      return;
    }
    await deleteDoc(doc(db, "lessons", id));
  },

  updateLesson: async (
    id: string,
    title: string,
    content: string,
    canvaUrl: string,
    youtubeUrl: string,
    hasAssignment?: boolean,
    assignmentType?: "individual" | "group",
    assignmentDescription?: string,
    targetRooms?: string[],
    existingAssignmentId?: string
  ): Promise<void> => {
    if (isMockMode()) {
      mockDb.updateLesson(
        id,
        title,
        content,
        canvaUrl,
        youtubeUrl,
        hasAssignment,
        assignmentType,
        assignmentDescription,
        targetRooms,
        existingAssignmentId
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    let assignmentId = existingAssignmentId || "";

    if (hasAssignment) {
      if (assignmentId) {
        // Update existing board
        await updateDoc(doc(db, "boards", assignmentId), {
          title: `งาน: ${title}`,
          description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
          type: assignmentType || "individual",
          targetRooms: targetRooms || []
        });
      } else {
        // Create new board
        const boardRef = await addDoc(collection(db, "boards"), {
          title: `งาน: ${title}`,
          description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
          createdAt: Date.now(),
          type: assignmentType || "individual",
          lessonId: id,
          isLocked: false,
          targetRooms: targetRooms || []
        });
        assignmentId = boardRef.id;
      }
    } else {
      // Delete board if assignment disabled
      if (assignmentId) {
        await deleteDoc(doc(db, "boards", assignmentId));
        assignmentId = "";
      }
    }

    // Update lesson
    await updateDoc(doc(db, "lessons", id), {
      title,
      content,
      canvaUrl,
      youtubeUrl,
      hasAssignment: !!hasAssignment,
      assignmentId,
      assignmentType: assignmentType || "",
      targetRooms: targetRooms || []
    });
  }
};

const fbBoardService = {
  subscribeBoards: (callback: (boards: AssignmentBoard[]) => void) => {
    if (isMockMode()) {
      callback(mockDb.getBoards());
      return mockDb.subscribe("change", () => {
        callback(mockDb.getBoards());
      });
    }

    const q = query(collection(db, "boards"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const boards: AssignmentBoard[] = [];
      snapshot.forEach((doc) => {
        boards.push({ id: doc.id, ...doc.data() } as AssignmentBoard);
      });
      callback(boards);
    });
  },

  addBoard: async (title: string, description: string, type: "individual" | "group" = "individual", targetRooms?: string[]): Promise<void> => {
    if (isMockMode()) {
      mockDb.addBoard(title, description, type, targetRooms);
      return;
    }
    await addDoc(collection(db, "boards"), {
      title,
      description,
      createdAt: Date.now(),
      type,
      isLocked: false,
      targetRooms: targetRooms || []
    });
  },

  deleteBoard: async (id: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.deleteBoard(id);
      return;
    }
    await deleteDoc(doc(db, "boards", id));
  },

  toggleLockBoard: async (boardId: string, isLocked: boolean): Promise<void> => {
    if (isMockMode()) {
      mockDb.toggleLockBoard(boardId, isLocked);
      return;
    }
    await updateDoc(doc(db, "boards", boardId), { isLocked });
  }
};

const fbSubmissionService = {
  subscribeSubmissions: (boardId: string, callback: (submissions: Submission[]) => void) => {
    if (isMockMode()) {
      callback(mockDb.getSubmissions(boardId));
      return mockDb.subscribe("change", () => {
        callback(mockDb.getSubmissions(boardId));
      });
    }

    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const submissions: Submission[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.boardId === boardId) {
          submissions.push({ id: doc.id, ...data } as Submission);
        }
      });
      callback(submissions);
    });
  },

  addSubmission: async (
    boardId: string, 
    title: string, 
    description: string, 
    linkUrl: string, 
    isGroup: boolean = false, 
    members: { name: string; room: string; studentNo: string }[] = []
  ): Promise<void> => {
    const currentUserProfile = await new Promise<UserProfile | null>((resolve) => {
      const unsub = authService.onAuthStateChanged((user) => {
        unsub();
        resolve(user);
      });
    });

    if (!currentUserProfile) throw new Error("No user signed in");

    if (isMockMode()) {
      mockDb.addSubmission(boardId, title, description, linkUrl, isGroup, members);
      return;
    }

    await addDoc(collection(db, "submissions"), {
      boardId,
      uid: currentUserProfile.uid,
      studentName: currentUserProfile.fullName || currentUserProfile.displayName || "นักเรียน",
      studentNo: currentUserProfile.studentNo || "-",
      gradeClass: currentUserProfile.grade && currentUserProfile.room ? `ม.${currentUserProfile.grade}/${currentUserProfile.room}` : "ทั่วไป",
      title,
      description,
      linkUrl,
      likes: [],
      comments: [],
      createdAt: Date.now(),
      isGroup,
      members,
      status: "pending"
    });

    // Reward: 1 Pack for submitting
    // Reward: 1 Pack for submitting
    const { increment, query, where, getDocs } = await import("firebase/firestore");
    
    if (isGroup && members && members.length > 0) {
      const promises = members.map(async (m) => {
        const q = query(
          collection(db, "users"),
          where("room", "==", String(m.room)),
          where("studentNo", "==", String(m.studentNo))
        );
        const snapshot = await getDocs(q);
        const updatePromises: any[] = [];
        snapshot.forEach((docSnap) => {
           updatePromises.push(updateDoc(docSnap.ref, { packsCount: increment(1) }));
        });
        await Promise.all(updatePromises);
      });
      await Promise.all(promises);
      
      const submitterInGroup = members.find(m => String(m.room) === String(currentUserProfile.room) && String(m.studentNo) === String(currentUserProfile.studentNo));
      if (!submitterInGroup) {
         const userDocRef = doc(db, "users", currentUserProfile.uid);
         await updateDoc(userDocRef, { packsCount: increment(1) });
      }
    } else {
      const userDocRef = doc(db, "users", currentUserProfile.uid);
      await updateDoc(userDocRef, { packsCount: increment(1) });
    }
  },

  deleteSubmission: async (submissionId: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.deleteSubmission(submissionId);
      return;
    }
    await deleteDoc(doc(db, "submissions", submissionId));
  },

  toggleLike: async (submissionId: string): Promise<void> => {
    const currentUser = isMockMode() ? mockDb.currentUser : auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");
    const uid = currentUser.uid;

    if (isMockMode()) {
      mockDb.toggleLike(submissionId);
      return;
    }

    const docRef = doc(db, "submissions", submissionId);
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      if (!sfDoc.exists()) throw new Error("Document does not exist!");
      
      const likesList = sfDoc.data().likes || [];
      const hasLiked = likesList.includes(uid);
      
      const newLikes = hasLiked
        ? likesList.filter((id: string) => id !== uid)
        : [...likesList, uid];
      
      transaction.update(docRef, { likes: newLikes });
    });
  },

  addComment: async (submissionId: string, content: string): Promise<void> => {
    const currentUserProfile = await new Promise<UserProfile | null>((resolve) => {
      const unsub = authService.onAuthStateChanged((user) => {
        unsub();
        resolve(user);
      });
    });

    if (!currentUserProfile) throw new Error("No user signed in");

    if (isMockMode()) {
      mockDb.addComment(submissionId, content);
      return;
    }

    const newComment = {
      id: "comment-" + Math.random().toString(36).substr(2, 9),
      uid: currentUserProfile.uid,
      authorName: currentUserProfile.fullName || currentUserProfile.displayName || "ผู้ใช้",
      content,
      createdAt: Date.now()
    };

    const docRef = doc(db, "submissions", submissionId);
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      if (!sfDoc.exists()) throw new Error("Document does not exist!");
      const commentsList = sfDoc.data().comments || [];
      transaction.update(docRef, { comments: [...commentsList, newComment] });
    });
  },

  gradeSubmission: async (
    submissionId: string, 
    score: number, 
    maxScore: number, 
    status: "graded" | "resubmit", 
    teacherFeedback: string,
    awardPack?: boolean
  ): Promise<void> => {
    if (isMockMode()) {
      mockDb.gradeSubmission(submissionId, score, maxScore, status, teacherFeedback, awardPack);
      return;
    }
    await updateDoc(doc(db, "submissions", submissionId), {
      score,
      maxScore,
      status,
      teacherFeedback
    });

    if (awardPack) {
      const subSnap = await getDoc(doc(db, "submissions", submissionId));
      if (subSnap.exists()) {
         const sub = subSnap.data() as Submission;
         const { increment, query, where, getDocs } = await import("firebase/firestore");
         if (sub.isGroup && sub.members && sub.members.length > 0) {
            const promises = sub.members.map(async (m) => {
              const q = query(collection(db, "users"), where("room", "==", String(m.room)), where("studentNo", "==", String(m.studentNo)));
              const snapshot = await getDocs(q);
              snapshot.forEach((docSnap) => { updateDoc(docSnap.ref, { packsCount: increment(1) }); });
            });
            await Promise.all(promises);
         } else {
            await updateDoc(doc(db, "users", sub.uid), { packsCount: increment(1) });
         }
      }
    }
  },

  subscribeAllSubmissions: (callback: (submissions: Submission[]) => void) => {
    if (isMockMode()) {
      callback(mockDb.getItem<Submission[]>("mock_submissions", []));
      return mockDb.subscribe("change", () => {
        callback(mockDb.getItem<Submission[]>("mock_submissions", []));
      });
    }

    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const submissions: Submission[] = [];
      snapshot.forEach((doc) => {
        submissions.push({ id: doc.id, ...doc.data() } as Submission);
      });
      callback(submissions);
    });
  },

  getAllSubmissions: async (): Promise<Submission[]> => {
    if (isMockMode()) {
      return mockDb.getItem<Submission[]>("mock_submissions", []);
    }
    const { getDocs } = await import("firebase/firestore");
    const snapshot = await getDocs(collection(db, "submissions"));
    const list: Submission[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as Submission);
    });
    return list;
  }
};

const fbCardService = {
  awardPack: async (studentUid: string, count: number): Promise<void> => {
    if (isMockMode()) {
      mockDb.awardPack(studentUid, count);
      return;
    }
    const { doc, runTransaction } = await import("firebase/firestore");
    const docRef = doc(db, "users", studentUid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) return;
      const countCurrent = snap.data().packsCount || 0;
      transaction.update(docRef, { packsCount: countCurrent + count });
    });
  },

  getStudentPacks: async (studentUid: string): Promise<CardPack[]> => {
    if (isMockMode()) {
      return mockDb.getStudentPacks(studentUid);
    }
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", studentUid));
    if (!snap.exists()) return [];
    const count = snap.data().packsCount || 0;
    const packs: CardPack[] = [];
    for (let i = 0; i < count; i++) {
      packs.push({
        id: `pack-${studentUid}-${i}-${Date.now()}`,
        studentUid,
        studentName: snap.data().fullName || snap.data().displayName || "นักเรียน",
        studentRoom: snap.data().room || "",
        isOpened: false,
        createdAt: Date.now()
      });
    }
    return packs;
  },

  openPack: async (studentUid: string): Promise<Card[]> => {
    if (isMockMode()) {
      return mockDb.openPack(studentUid);
    }

    const { doc, runTransaction } = await import("firebase/firestore");
    const userRef = doc(db, "users", studentUid);

    const rates = getDropRates().pack;
    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      
      const holoLimit = rates.holographic;
      const legLimit = holoLimit + rates.legendary;
      const epicLimit = legLimit + rates.epic;
      const rareLimit = epicLimit + rates.rare;

      if (rand < holoLimit) {
        selectedRarity = "holographic";
      } else if (rand < legLimit) {
        selectedRarity = "legendary";
      } else if (rand < epicLimit) {
        selectedRarity = "epic";
      } else if (rand < rareLimit) {
        selectedRarity = "rare";
      } else {
        selectedRarity = "common";
      }

      const activePool = getCardPool();
      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard(), drawRandomCard()];

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Student profile not found");
      const currentPacks = snap.data().packsCount || 0;
      if (currentPacks <= 0) throw new Error("No packs available to open");

      const currentColl = snap.data().cardsCollected || [];
      newCards.forEach(card => {
        const existing = currentColl.find((c: any) => c.cardId === card.id);
        if (existing) {
          existing.count = (existing.count || 0) + 1;
        } else {
          currentColl.push({ cardId: card.id, count: 1, redeemedCount: 0 });
        }
      });

      transaction.update(userRef, {
        packsCount: Math.max(0, currentPacks - 1),
        cardsCollected: currentColl
      });
    });

    return newCards;
  },

  requestRedemption: async (studentUid: string, cardId: string): Promise<RedemptionRequest | null> => {
    if (isMockMode()) {
      return mockDb.requestRedemption(studentUid, cardId);
    }

    const { doc, collection, addDoc, runTransaction } = await import("firebase/firestore");
    const userRef = doc(db, "users", studentUid);
    const card = getCardPool().find(c => c.id === cardId);
    if (!card) return null;

    let newReq: RedemptionRequest | null = null;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Student profile not found");
      
      const coll = snap.data().cardsCollected || [];
      const cardOwned = coll.find((c: any) => c.cardId === cardId);
      if (!cardOwned || (cardOwned.count || 0) <= (cardOwned.redeemedCount || 0)) {
        throw new Error("No unredeemed copies of this card owned");
      }

      cardOwned.redeemedCount = (cardOwned.redeemedCount || 0) + 1;
      
      transaction.update(userRef, { cardsCollected: coll });

      const reqData = {
        studentUid,
        studentName: snap.data().fullName || snap.data().displayName || "นักเรียน",
        studentRoom: snap.data().room || "",
        cardId,
        cardName: card.name,
        rarity: card.rarity,
        bonusPoints: card.bonusPoints,
        status: "pending",
        createdAt: Date.now()
      };
      
      const reqRef = doc(collection(db, "redemptions"));
      transaction.set(reqRef, reqData);
      newReq = { id: reqRef.id, ...reqData } as RedemptionRequest;
    });

    return newReq;
  },

  getRedemptions: async (): Promise<RedemptionRequest[]> => {
    if (isMockMode()) {
      return mockDb.getRedemptions();
    }
    const { getDocs, query, orderBy } = await import("firebase/firestore");
    const q = query(collection(db, "redemptions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list: RedemptionRequest[] = [];
    snap.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as RedemptionRequest);
    });
    return list;
  },

  getStudentRedemptions: async (studentUid: string): Promise<RedemptionRequest[]> => {
    if (isMockMode()) {
      return mockDb.getRedemptions()
        .filter(r => r.studentUid === studentUid)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    try {
      const q = query(
        collection(db!, "redemptions"),
        where("studentUid", "==", studentUid)
      );
      const snap = await getDocs(q);
      const list: RedemptionRequest[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as RedemptionRequest);
      });
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("Error fetching student redemptions:", error);
      return [];
    }
  },

  approveRedemption: async (requestId: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.approveRedemption(requestId);
      return;
    }
    const { doc, runTransaction } = await import("firebase/firestore");
    const reqRef = doc(db, "redemptions", requestId);

    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error("Request not found");
      const reqData = reqSnap.data();
      if (reqData.status !== "pending") throw new Error("Request already processed");

      const userRef = doc(db, "users", reqData.studentUid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Student not found");

      transaction.update(reqRef, { status: "approved" });
      transaction.update(userRef, {
        bonusPoints: (userSnap.data().bonusPoints || 0) + (reqData.bonusPoints || 0)
      });
    });
  },

  rejectRedemption: async (requestId: string): Promise<void> => {
    if (isMockMode()) {
      mockDb.rejectRedemption(requestId);
      return;
    }
    const { doc, runTransaction } = await import("firebase/firestore");
    const reqRef = doc(db, "redemptions", requestId);

    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error("Request not found");
      const reqData = reqSnap.data();
      if (reqData.status !== "pending") throw new Error("Request already processed");

      const userRef = doc(db, "users", reqData.studentUid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Student not found");

      const coll = userSnap.data().cardsCollected || [];
      const cardOwned = coll.find((c: any) => c.cardId === reqData.cardId);
      if (cardOwned) {
        cardOwned.redeemedCount = Math.max(0, (cardOwned.redeemedCount || 0) - 1);
      }

      transaction.update(reqRef, { status: "rejected" });
      transaction.update(userRef, { cardsCollected: coll });
    });
  },

  exchangeCommonCards: async (studentUid: string): Promise<Card[]> => {
    if (isMockMode()) {
      const res = mockDb.exchangeCommonCards(studentUid);
      if (!res) throw new Error("Not enough common cards");
      return res;
    }

    const { doc, runTransaction } = await import("firebase/firestore");
    const userRef = doc(db, "users", studentUid);

    // Exchange odds — 2x better than normal gacha packs:
    // Holographic 0.4% | Legendary 1.0% | Epic 6% | Rare 20% | Common ~72.6%
    const rates = getDropRates().exchange;
    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      
      const holoLimit = rates.holographic;
      const legLimit = holoLimit + rates.legendary;
      const epicLimit = legLimit + rates.epic;
      const rareLimit = epicLimit + rates.rare;

      if (rand < holoLimit) selectedRarity = "holographic";
      else if (rand < legLimit) selectedRarity = "legendary";
      else if (rand < epicLimit) selectedRarity = "epic";
      else if (rand < rareLimit) selectedRarity = "rare";
      else selectedRarity = "common";

      const activePool = getCardPool();
      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard()];

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Student profile not found");
      
      const coll = snap.data().cardsCollected || [];
      const activePool = getCardPool();
      
      let commonAvailable = 0;
      coll.forEach((item: any) => {
        const card = activePool.find(c => c.id === item.cardId);
        if (card && card.rarity === "common") {
          commonAvailable += (item.count || 0) - (item.redeemedCount || 0);
        }
      });

      if (commonAvailable < 5) {
        throw new Error("Not enough common cards (need 5)");
      }

      let toDeduct = 5;
      for (const item of coll) {
        if (toDeduct <= 0) break;
        const card = activePool.find(c => c.id === item.cardId);
        if (card && card.rarity === "common") {
          const available = (item.count || 0) - (item.redeemedCount || 0);
          if (available > 0) {
            const deduct = Math.min(available, toDeduct);
            item.count -= deduct;
            toDeduct -= deduct;
          }
        }
      }

      const updatedColl = coll.filter((item: any) => item.count > 0 || item.redeemedCount > 0);

      for (const newCard of newCards) {
        const existing = updatedColl.find((c: any) => c.cardId === newCard.id);
        if (existing) {
          existing.count = (existing.count || 0) + 1;
        } else {
          updatedColl.push({ cardId: newCard.id, count: 1, redeemedCount: 0 });
        }
      }

      transaction.update(userRef, { cardsCollected: updatedColl });
    });

    return newCards;
  }
};

// ============================================================
// ANNOUNCEMENT SERVICE
// ============================================================

const fbAnnouncementService = {
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (isMockMode()) {
      const data = localStorage.getItem("mock_announcements");
      return data ? JSON.parse(data) : [];
    }
    try {
      const { getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const results: Announcement[] = [];
      snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Announcement));
      return results;
    } catch {
      return [];
    }
  },

  subscribeAnnouncements: (callback: (list: Announcement[]) => void) => {
    if (isMockMode()) {
      const data = localStorage.getItem("mock_announcements");
      callback(data ? JSON.parse(data) : []);
      // Poll every 3s for mock
      const id = setInterval(() => {
        const d = localStorage.getItem("mock_announcements");
        callback(d ? JSON.parse(d) : []);
      }, 3000);
      return () => clearInterval(id);
    }
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const results: Announcement[] = [];
      snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Announcement));
      callback(results);
    });
  },

  addAnnouncement: async (title: string, content: string, authorName: string, pinned = false): Promise<void> => {
    const newAnn: Announcement = {
      id: "ann-" + Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      content: content.trim(),
      authorName,
      createdAt: Date.now(),
      pinned
    };
    if (isMockMode()) {
      const data = localStorage.getItem("mock_announcements");
      const list: Announcement[] = data ? JSON.parse(data) : [];
      localStorage.setItem("mock_announcements", JSON.stringify([newAnn, ...list]));
      return;
    }
    await addDoc(collection(db, "announcements"), { ...newAnn, id: undefined });
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    if (isMockMode()) {
      const data = localStorage.getItem("mock_announcements");
      const list: Announcement[] = data ? JSON.parse(data) : [];
      localStorage.setItem("mock_announcements", JSON.stringify(list.filter(a => a.id !== id)));
      return;
    }
    await deleteDoc(doc(db, "announcements", id));
  }
};

// ============================================================
// DYNAMIC SUPABASE/FIREBASE DATABASE PROXY
// ============================================================

export const authService = {
  // ── Auth methods ALWAYS use sb.authService (localStorage-based, API-route backed) ─────
  // This is independent of getDatabaseMode() so data can be in Firebase
  // while auth uses our new custom system.
  signInWithGoogle: (_role?: string, _email?: string) => sb.authService.signInWithGoogle(),
  signOut: () => sb.authService.signOut(),
  onAuthStateChanged: (callback: (user: UserProfile | null) => void) =>
    sb.authService.onAuthStateChanged(callback),
  signUpWithUsernamePassword: (username: string, password: string, profileData: any) =>
    sb.authService.signUpWithUsernamePassword(username, password, profileData),
  signInWithUsernamePassword: (username: string, password: string) =>
    sb.authService.signInWithUsernamePassword(username, password),

  // ── Profile/student data — follows getDatabaseMode() (firebase or supabase) ───────
  getRegisteredStudents: () =>
    getDatabaseMode() === "supabase" ? sb.authService.getRegisteredStudents() : fbAuthService.getRegisteredStudents(),
  getStudentProfile: (uid: string) =>
    getDatabaseMode() === "supabase" ? sb.authService.getStudentProfile(uid) : fbAuthService.getStudentProfile(uid),
  updateStudentProfile: (uid: string, updates: any) =>
    getDatabaseMode() === "supabase" ? sb.authService.updateStudentProfile(uid, updates) : fbAuthService.updateStudentProfile(uid, updates),
  mergeStudents: (sourceUid: string, targetUid: string) =>
    getDatabaseMode() === "supabase" ? sb.authService.mergeStudents(sourceUid, targetUid) : fbAuthService.mergeStudents(sourceUid, targetUid),
  registerProfile: (profileData: any) =>
    getDatabaseMode() === "supabase" ? sb.authService.registerProfile(profileData) : fbAuthService.registerProfile(profileData),
  deleteStudent: (uid: string) =>
    getDatabaseMode() === "supabase" ? sb.authService.deleteStudent(uid) : fbAuthService.deleteStudent(uid),
};

export const lessonService = {
  subscribeLessons: (callback: (lessons: Lesson[]) => void) =>
    getDatabaseMode() === "supabase" ? sb.lessonService.subscribeLessons(callback) : fbLessonService.subscribeLessons(callback),
  addLesson: (title: string, content: string, canvaUrl: string, youtubeUrl: string, hasAssignment?: boolean, assignmentType?: "individual" | "group", assignmentDescription?: string, targetRooms?: string[]) =>
    getDatabaseMode() === "supabase" ? sb.lessonService.addLesson(title, content, canvaUrl, youtubeUrl, hasAssignment, assignmentType, assignmentDescription, targetRooms) : fbLessonService.addLesson(title, content, canvaUrl, youtubeUrl, hasAssignment, assignmentType, assignmentDescription, targetRooms),
  deleteLesson: (id: string) =>
    getDatabaseMode() === "supabase" ? sb.lessonService.deleteLesson(id) : fbLessonService.deleteLesson(id),
  updateLesson: (id: string, title: string, content: string, canvaUrl: string, youtubeUrl: string, hasAssignment?: boolean, assignmentType?: "individual" | "group", assignmentDescription?: string, targetRooms?: string[], existingAssignmentId?: string) =>
    getDatabaseMode() === "supabase" ? sb.lessonService.updateLesson(id, title, content, canvaUrl, youtubeUrl, hasAssignment, assignmentType, assignmentDescription, targetRooms, existingAssignmentId) : fbLessonService.updateLesson(id, title, content, canvaUrl, youtubeUrl, hasAssignment, assignmentType, assignmentDescription, targetRooms, existingAssignmentId),
};

export const boardService = {
  subscribeBoards: (callback: (boards: AssignmentBoard[]) => void) =>
    getDatabaseMode() === "supabase" ? sb.boardService.subscribeBoards(callback) : fbBoardService.subscribeBoards(callback),
  addBoard: (title: string, description: string, type?: "individual" | "group", targetRooms?: string[]) =>
    getDatabaseMode() === "supabase" ? sb.boardService.addBoard(title, description, type, targetRooms) : fbBoardService.addBoard(title, description, type, targetRooms),
  deleteBoard: (id: string) =>
    getDatabaseMode() === "supabase" ? sb.boardService.deleteBoard(id) : fbBoardService.deleteBoard(id),
  toggleLockBoard: (boardId: string, isLocked: boolean) =>
    getDatabaseMode() === "supabase" ? sb.boardService.toggleLockBoard(boardId, isLocked) : fbBoardService.toggleLockBoard(boardId, isLocked),
};

export const submissionService = {
  subscribeSubmissions: (boardId: string, callback: (submissions: Submission[]) => void) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.subscribeSubmissions(boardId, callback) : fbSubmissionService.subscribeSubmissions(boardId, callback),
  addSubmission: (boardId: string, title: string, description: string, linkUrl: string, isGroup?: boolean, members?: any[]) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.addSubmission(boardId, title, description, linkUrl, isGroup, members) : fbSubmissionService.addSubmission(boardId, title, description, linkUrl, isGroup, members),
  deleteSubmission: (submissionId: string) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.deleteSubmission(submissionId) : fbSubmissionService.deleteSubmission(submissionId),
  toggleLike: (submissionId: string) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.toggleLike(submissionId) : fbSubmissionService.toggleLike(submissionId),
  addComment: (submissionId: string, content: string) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.addComment(submissionId, content) : fbSubmissionService.addComment(submissionId, content),
  gradeSubmission: (submissionId: string, score: number, maxScore: number, status: "graded" | "resubmit", teacherFeedback: string, awardPack?: boolean) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.gradeSubmission(submissionId, score, maxScore, status, teacherFeedback, awardPack) : fbSubmissionService.gradeSubmission(submissionId, score, maxScore, status, teacherFeedback, awardPack),
  subscribeAllSubmissions: (callback: (submissions: Submission[]) => void) =>
    getDatabaseMode() === "supabase" ? sb.submissionService.subscribeAllSubmissions(callback) : fbSubmissionService.subscribeAllSubmissions(callback),
  getAllSubmissions: () =>
    getDatabaseMode() === "supabase" ? sb.submissionService.getAllSubmissions() : fbSubmissionService.getAllSubmissions(),
};

export const cardService = {
  awardPack: (studentUid: string, count: number) =>
    getDatabaseMode() === "supabase" ? sb.cardService.awardPack(studentUid, count) : fbCardService.awardPack(studentUid, count),
  getStudentPacks: (studentUid: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.getStudentPacks(studentUid) : fbCardService.getStudentPacks(studentUid),
  openPack: (studentUid: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.openPack(studentUid) : fbCardService.openPack(studentUid),
  requestRedemption: (studentUid: string, cardId: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.requestRedemption(studentUid, cardId) : fbCardService.requestRedemption(studentUid, cardId),
  getRedemptions: () =>
    getDatabaseMode() === "supabase" ? sb.cardService.getRedemptions() : fbCardService.getRedemptions(),
  getStudentRedemptions: (studentUid: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.getStudentRedemptions(studentUid) : fbCardService.getStudentRedemptions(studentUid),
  approveRedemption: (requestId: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.approveRedemption(requestId) : fbCardService.approveRedemption(requestId),
  rejectRedemption: (requestId: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.rejectRedemption(requestId) : fbCardService.rejectRedemption(requestId),
  exchangeCommonCards: (studentUid: string) =>
    getDatabaseMode() === "supabase" ? sb.cardService.exchangeCommonCards(studentUid) : fbCardService.exchangeCommonCards(studentUid),
};

export const announcementService = {
  getAnnouncements: () =>
    getDatabaseMode() === "supabase" ? sb.announcementService.getAnnouncements() : fbAnnouncementService.getAnnouncements(),
  subscribeAnnouncements: (callback: (list: Announcement[]) => void) =>
    getDatabaseMode() === "supabase" ? sb.announcementService.subscribeAnnouncements(callback) : fbAnnouncementService.subscribeAnnouncements(callback),
  addAnnouncement: (title: string, content: string, authorName: string, pinned = false) =>
    getDatabaseMode() === "supabase" ? sb.announcementService.addAnnouncement(title, content, authorName, pinned) : fbAnnouncementService.addAnnouncement(title, content, authorName, pinned),
  deleteAnnouncement: (id: string) =>
    getDatabaseMode() === "supabase" ? sb.announcementService.deleteAnnouncement(id) : fbAnnouncementService.deleteAnnouncement(id),
};
