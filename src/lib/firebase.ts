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
  runTransaction
} from "firebase/firestore";

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
  type: "cosmetic" | "bonus" | "privilege";
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
    name: "โค้ดสปาเก็ตตี้ (Spaghetti Code)",
    rarity: "rare",
    imageUrl: "/cards/card_spaghetti.png",
    description: "โยงมั่วไปหมดจนดึงแก้เส้นนึง พังทลายไปทั้งระบบ! (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-8",
    name: "ลั่นปิดผิดหน้า (Alt+F4)",
    rarity: "rare",
    imageUrl: "/cards/card_alt_f4.png",
    description: "ตั้งใจจะกดเซฟงาน แต่ดันนิ้วเบียดไปกดปิดโปรแกรมทิ้งซะงั้น (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-9",
    name: "ทำงานเต็มสูบ (100% CPU Usage)",
    rarity: "rare",
    imageUrl: "/cards/card_cpu.png",
    description: "พัดลมคอมพิวเตอร์หมุนแรงจัด จนกะทัดรัดเตรียมบินขึ้นอวกาศ (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-10",
    name: "สมองปลาทอง (Forgot Password)",
    rarity: "rare",
    imageUrl: "/cards/card_forgot_pwd.png",
    description: "ตั้งรหัสผ่านไว้ซับซ้อนเกินไป จนตัวเองก็ยังจำไม่ได้ (+1 คะแนนโบนัส)",
    bonusPoints: 1,
    type: "bonus"
  },
  {
    id: "card-11",
    name: "เทสเตอร์ผู้กล้า (Tester in Prod)",
    rarity: "rare",
    imageUrl: "/cards/card_tester_prod.png",
    description: "ขี้เกียจทดสอบในเครื่องตัวเอง ปล่อยโค้ดขึ้นระบบจริงแล้วค่อยไปลุ้นเอา! (+1 คะแนนโบนัส)",
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
    imageUrl: "/cards/meme_epic.png",
    description: "อัปเดตระบบตอน 5 โมงเย็นวันศุกร์ แล้วหนีกลับบ้าน ไม่รับรู้อะไรทั้งสิ้น! (+2 คะแนนโบนัส)",
    bonusPoints: 2,
    type: "bonus"
  },
  {
    id: "card-15",
    name: "เอไอแย่งงาน (AI Took My Job)",
    rarity: "epic",
    imageUrl: "/cards/meme_epic.png",
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
    imageUrl: "__HOLOGRAPHIC__",
    description: "การ์ดโฮโลกราฟิกหายากที่สุดในโลก! ผู้โชคดี 1 ใน 500 คนเท่านั้น! พลังงานดิจิทัลสูงสุด! (+10 คะแนนโบนัส)",
    bonusPoints: 10,
    type: "bonus"
  }
];

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

  public registerProfile(profileData: { fullName: string; grade: string; room: string; studentNo: string }) {
    const user = this.currentUser;
    if (!user) return;

    const profiles = this.getItem<{ [email: string]: any }>("mock_profiles", {});
    profiles[user.email || ""] = profileData;
    this.setItem("mock_profiles", profiles);

    const updatedUser: UserProfile = {
      ...user,
      isRegistered: true,
      ...profileData
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

  public updateStudentProfile(uid: string, updates: { fullName?: string; room?: string; studentNo?: string }) {
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

    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      if (rand < 0.2) {
        selectedRarity = "holographic";
      } else if (rand < 0.7) {
        selectedRarity = "legendary";
      } else if (rand < 3.7) {
        selectedRarity = "epic";
      } else if (rand < 13.7) {
        selectedRarity = "rare";
      } else {
        selectedRarity = "common";
      }

      const matchingCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
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

    const card = CARD_POOL.find(c => c.id === cardId);
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

  public exchangeCommonCards(studentUid: string): Card | null {
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
    
    let commonAvailable = 0;
    coll.forEach((item: any) => {
      const card = CARD_POOL.find(c => c.id === item.cardId);
      if (card && card.rarity === "common") {
        commonAvailable += (item.count || 0) - (item.redeemedCount || 0);
      }
    });

    if (commonAvailable < 5) return null;

    let toDeduct = 5;
    for (const item of coll) {
      if (toDeduct <= 0) break;
      const card = CARD_POOL.find(c => c.id === item.cardId);
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

    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      if (rand < 0.2) selectedRarity = "holographic";
      else if (rand < 0.7) selectedRarity = "legendary";
      else if (rand < 3.7) selectedRarity = "epic";
      else if (rand < 13.7) selectedRarity = "rare";
      else selectedRarity = "common";
      const matchingCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCard = drawRandomCard();
    const updatedColl = profiles[foundEmail].cardsCollected;
    const existing = updatedColl.find((c: any) => c.cardId === newCard.id);
    if (existing) {
      existing.count = (existing.count || 0) + 1;
    } else {
      updatedColl.push({ cardId: newCard.id, count: 1, redeemedCount: 0 });
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

    return newCard;
  }

}

export const mockDb = new MockDbService();

// -------------------------------------------------------------
// UNIFIED DATA SERVICE (Switchable between Real Firebase and Mock)
// -------------------------------------------------------------
export const isMockMode = () => !isFirebaseConfigured;

export const authService = {
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
      isRegistered: true
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
      const { getDocs, query, where } = await import("firebase/firestore");
      const q = query(collection(db, "users"), where("role", "==", "student"), where("isRegistered", "==", true));
      const snapshot = await getDocs(q);
      const students: UserProfile[] = [];
      snapshot.forEach((doc) => {
        students.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      return students.sort((a, b) => Number(a.studentNo || 0) - Number(b.studentNo || 0));
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  },

  updateStudentProfile: async (uid: string, updates: { fullName?: string; room?: string; studentNo?: string }): Promise<void> => {
    if (isMockMode()) {
      mockDb.updateStudentProfile(uid, updates);
      return;
    }
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, updates);
  }
};

export const lessonService = {
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
  }
};

export const boardService = {
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

export const submissionService = {
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

export const cardService = {
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

    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      if (rand < 0.2) {
        selectedRarity = "holographic";
      } else if (rand < 0.7) {
        selectedRarity = "legendary";
      } else if (rand < 3.7) {
        selectedRarity = "epic";
      } else if (rand < 13.7) {
        selectedRarity = "rare";
      } else {
        selectedRarity = "common";
      }
      const matchingCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
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
    const card = CARD_POOL.find(c => c.id === cardId);
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

  exchangeCommonCards: async (studentUid: string): Promise<Card> => {
    if (isMockMode()) {
      const res = mockDb.exchangeCommonCards(studentUid);
      if (!res) throw new Error("Not enough common cards");
      return res;
    }

    const { doc, runTransaction } = await import("firebase/firestore");
    const userRef = doc(db, "users", studentUid);

    const drawRandomCard = (): Card => {
      const rand = Math.random() * 100;
      let selectedRarity: "common" | "rare" | "epic" | "legendary" | "holographic" = "common";
      if (rand < 0.2) selectedRarity = "holographic";
      else if (rand < 0.7) selectedRarity = "legendary";
      else if (rand < 3.7) selectedRarity = "epic";
      else if (rand < 13.7) selectedRarity = "rare";
      else selectedRarity = "common";
      const matchingCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCard = drawRandomCard();

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Student profile not found");
      
      const coll = snap.data().cardsCollected || [];
      
      let commonAvailable = 0;
      coll.forEach((item: any) => {
        const card = CARD_POOL.find(c => c.id === item.cardId);
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
        const card = CARD_POOL.find(c => c.id === item.cardId);
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

      const existing = updatedColl.find((c: any) => c.cardId === newCard.id);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
      } else {
        updatedColl.push({ cardId: newCard.id, count: 1, redeemedCount: 0 });
      }

      transaction.update(userRef, { cardsCollected: updatedColl });
    });

    return newCard;
  }
};

// ============================================================
// ANNOUNCEMENT SERVICE
// ============================================================

export const announcementService = {
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
