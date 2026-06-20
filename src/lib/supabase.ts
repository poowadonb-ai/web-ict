/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { 
  UserProfile, Card, CardPack, RedemptionRequest, 
  Announcement, Lesson, AssignmentBoard, Submission,
  CARD_POOL, CardCollected, GachaRates, DEFAULT_DROP_RATES
} from "./types";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// DATABASE MAPPERS (Snake Case -> Camel Case)
// ============================================================
function mapUserFromDb(row: any): UserProfile {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    role: row.role as "teacher" | "student",
    isRegistered: row.is_registered,
    fullName: row.full_name,
    grade: row.grade,
    room: row.room,
    studentNo: row.student_no,
    cardsCollected: row.cards_collected || [],
    packsCount: row.packs_count || 0,
    bonusPoints: row.bonus_points || 0,
    lastLoginDate: row.last_login_date,
    totalPacksOpened: row.total_packs_opened || 0,
    isMerged: row.is_merged || false,
  };
}

function mapLessonFromDb(row: any): Lesson {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    canvaUrl: row.canva_url,
    youtubeUrl: row.youtube_url,
    createdAt: Number(row.created_at),
    authorEmail: row.author_email,
    hasAssignment: row.has_assignment,
    assignmentId: row.assignment_id,
    assignmentType: row.assignment_type as "individual" | "group",
    targetRooms: row.target_rooms || [],
  };
}

function mapBoardFromDb(row: any): AssignmentBoard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: Number(row.created_at),
    type: row.type as "individual" | "group",
    lessonId: row.lesson_id,
    isLocked: row.is_locked,
    targetRooms: row.target_rooms || [],
  };
}

function mapSubmissionFromDb(row: any): Submission {
  return {
    id: row.id,
    boardId: row.board_id,
    uid: row.uid,
    studentName: row.student_name,
    studentNo: row.student_no,
    gradeClass: row.grade_class,
    title: row.title,
    description: row.description,
    linkUrl: row.link_url,
    likes: row.likes || [],
    comments: row.comments || [],
    createdAt: Number(row.created_at),
    isGroup: row.is_group,
    members: row.members || [],
    status: row.status as "pending" | "graded" | "resubmit",
    score: row.score,
    maxScore: row.max_score,
    teacherFeedback: row.teacher_feedback,
  };
}

function mapRedemptionFromDb(row: any): RedemptionRequest {
  return {
    id: row.id,
    studentUid: row.student_uid,
    studentName: row.student_name,
    studentRoom: row.student_room,
    studentGrade: row.student_grade,
    cardId: row.card_id,
    cardName: row.card_name,
    rarity: row.rarity as any,
    bonusPoints: row.bonus_points,
    status: row.status as any,
    createdAt: Number(row.created_at),
  };
}

// ============================================================
// AUTHENTICATION SERVICE
// ============================================================
// ── ICT Session Key (localStorage) ───────────────────────────────────────────
const SESSION_KEY = "ict_session";

function saveSession(user: UserProfile) {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

function clearSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadSession(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

async function getCurrentUid(): Promise<string | null> {
  // 1. Try LocalStorage Session (sbAuthService uses this)
  const session = loadSession();
  if (session?.uid) return session.uid;

  // 3. Try Firebase Auth fallback
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return auth.currentUser.uid;
  } catch (e) {
    console.warn("Could not load Firebase auth", e);
  }

  return null;
}

export const authService = {
  // ── Sign in with Google (disabled — kept for legacy proxy compatibility) ────
  signInWithGoogle: async (): Promise<UserProfile> => {
    throw new Error("Google login ถูกปิดการใช้งานแล้ว กรุณาใช้ชื่อผู้ใช้และรหัสผ่าน");
  },

  // ── Sign out — clears localStorage session ────────────────────────────────
  signOut: async (): Promise<void> => {
    clearSession();
  },

  // ── onAuthStateChanged — reads from localStorage (synchronous) ─────────────
  onAuthStateChanged: (callback: (user: UserProfile | null) => void) => {
    const user = loadSession();
    callback(user);
    // Return no-op unsubscribe
    return () => {};
  },

  // ── Sign up — calls /api/auth/signup server route ─────────────────────────
  signUpWithUsernamePassword: async (
    username: string,
    password: string,
    profileData: { fullName: string; grade: string; room: string; studentNo: string }
  ): Promise<UserProfile> => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password,
        fullName: profileData.fullName,
        grade: profileData.grade,
        room: profileData.room,
        studentNo: profileData.studentNo,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
    saveSession(data.user);
    return data.user as UserProfile;
  },

  // ── Sign in — calls /api/auth/signin server route ─────────────────────────
  signInWithUsernamePassword: async (usernameOrUid: string, password: string, studentProfile?: UserProfile): Promise<UserProfile> => {
    const isUid = usernameOrUid.startsWith("user-") || usernameOrUid.startsWith("student-") || usernameOrUid.length > 20 || !/^[a-zA-Z0-9_]{4,20}$/.test(usernameOrUid);
    const payload: any = { password };
    if (isUid) {
      payload.uid = usernameOrUid;
    } else {
      payload.username = usernameOrUid.trim().toLowerCase();
    }

    if (studentProfile) {
      payload.autoRegister = {
        fullName: studentProfile.fullName || studentProfile.displayName || "",
        grade: studentProfile.grade || "",
        room: studentProfile.room || "",
        studentNo: studentProfile.studentNo || "",
      };
    }

    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    saveSession(data.user);
    return data.user as UserProfile;
  },

  getRegisteredStudents: async (): Promise<UserProfile[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'student')
      .eq('is_registered', true);
    
    if (error) return [];
    return data.map(mapUserFromDb).sort((a, b) => Number(a.studentNo || 0) - Number(b.studentNo || 0));
  },

  getStudentProfile: async (uid: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (error || !data) return null;
    return mapUserFromDb(data);
  },

  updateStudentProfile: async (uid: string, updates: { fullName?: string; grade?: string; room?: string; studentNo?: string }): Promise<void> => {
    const payload: any = {};
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.grade !== undefined) payload.grade = updates.grade;
    if (updates.room !== undefined) payload.room = updates.room;
    if (updates.studentNo !== undefined) payload.student_no = updates.studentNo;

    await supabase.from('users').update(payload).eq('uid', uid);
  },

  mergeStudents: async (sourceUid: string, targetUid: string): Promise<void> => {
    // Ported from Firebase logic: merge sourceUid into targetUid
    const { data: source } = await supabase.from('users').select('*').eq('uid', sourceUid).single();
    const { data: target } = await supabase.from('users').select('*').eq('uid', targetUid).single();
    if (!source || !target) return;

    // Merge packs count & bonus points
    const mergedPacks = (target.packs_count || 0) + (source.packs_count || 0);
    const mergedPoints = (target.bonus_points || 0) + (source.bonus_points || 0);

    // Merge cardsCollected
    const targetColl = (target.cards_collected || []) as CardCollected[];
    const sourceColl = (source.cards_collected || []) as CardCollected[];
    sourceColl.forEach(sCard => {
      const tCard = targetColl.find(c => c.cardId === sCard.cardId);
      if (tCard) {
        tCard.count = (tCard.count || 0) + (sCard.count || 0);
        tCard.redeemedCount = (tCard.redeemedCount || 0) + (sCard.redeemedCount || 0);
      } else {
        targetColl.push(sCard);
      }
    });

    // Write to target
    await supabase.from('users').update({
      packs_count: mergedPacks,
      bonus_points: mergedPoints,
      cards_collected: targetColl
    }).eq('uid', targetUid);

    // Mark source as merged / clear
    await supabase.from('users').update({
      is_merged: true,
      packs_count: 0,
      bonus_points: 0,
      cards_collected: []
    }).eq('uid', sourceUid);
  },

  registerProfile: async (profileData: { fullName: string; grade: string; room: string; studentNo: string }): Promise<void> => {
    const uid = await getCurrentUid();
    if (!uid) throw new Error("No user signed in");

    await supabase.from('users').update({
      full_name: profileData.fullName,
      grade: profileData.grade,
      room: profileData.room,
      student_no: profileData.studentNo,
      is_registered: true,
      packs_count: 3,
      last_login_date: new Date().toISOString().split('T')[0]
    }).eq('uid', uid);
  },

  deleteStudent: async (uid: string): Promise<void> => {
    await supabase.from('users').delete().eq('uid', uid);
  }
};

// ============================================================
// CARDS SERVICE
// ============================================================
export const cardService = {
  awardPack: async (studentUid: string, count: number): Promise<void> => {
    const { data } = await supabase.from('users').select('packs_count').eq('uid', studentUid).single();
    if (!data) return;
    await supabase.from('users').update({
      packs_count: (data.packs_count || 0) + count
    }).eq('uid', studentUid);
  },

  getStudentPacks: async (studentUid: string): Promise<CardPack[]> => {
    const { data } = await supabase.from('users').select('*').eq('uid', studentUid).single();
    if (!data) return [];
    const count = data.packs_count || 0;
    const packs: CardPack[] = [];
    for (let i = 0; i < count; i++) {
      packs.push({
        id: `pack-${studentUid}-${i}-${Date.now()}`,
        studentUid,
        studentName: data.full_name || data.display_name || "นักเรียน",
        studentRoom: data.room || "",
        isOpened: false,
        createdAt: Date.now()
      });
    }
    return packs;
  },

  openPack: async (studentUid: string): Promise<Card[]> => {
    const { data: cardsSettings } = await supabase.from('settings').select('*').eq('id', 'cards').single();
    const rates = (cardsSettings?.drop_rates as GachaRates)?.pack || DEFAULT_DROP_RATES.pack;

    // Load active card pool
    const overrides = cardsSettings?.overrides || {};
    const custom = cardsSettings?.custom || [];
    const base = CARD_POOL.map(card => ({ ...card, ...(overrides[card.id] || {}) }));
    const activePool = [...base, ...custom];

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

      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard(), drawRandomCard()];

    const { data: userProfile } = await supabase.from('users').select('*').eq('uid', studentUid).single();
    if (!userProfile) throw new Error("Student profile not found");
    const currentPacks = userProfile.packs_count || 0;
    if (currentPacks <= 0) throw new Error("No packs available to open");

    const currentColl = (userProfile.cards_collected || []) as CardCollected[];
    newCards.forEach(card => {
      const existing = currentColl.find((c: any) => c.cardId === card.id);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
      } else {
        currentColl.push({ cardId: card.id, count: 1, redeemedCount: 0 });
      }
    });

    await supabase.from('users').update({
      packs_count: Math.max(0, currentPacks - 1),
      cards_collected: currentColl
    }).eq('uid', studentUid);

    return newCards;
  },

  requestRedemption: async (studentUid: string, cardId: string): Promise<RedemptionRequest | null> => {
    // Load active card pool first to get points info
    const { data: cardsSettings } = await supabase.from('settings').select('*').eq('id', 'cards').single();
    const overrides = cardsSettings?.overrides || {};
    const custom = cardsSettings?.custom || [];
    const base = CARD_POOL.map(card => ({ ...card, ...(overrides[card.id] || {}) }));
    const activePool = [...base, ...custom];
    const card = activePool.find(c => c.id === cardId);
    if (!card) return null;

    const { data: userProfile } = await supabase.from('users').select('*').eq('uid', studentUid).single();
    if (!userProfile) throw new Error("Student profile not found");

    const coll = (userProfile.cards_collected || []) as CardCollected[];
    const cardOwned = coll.find((c: any) => c.cardId === cardId);
    if (!cardOwned || (cardOwned.count || 0) <= (cardOwned.redeemedCount || 0)) {
      throw new Error("No unredeemed copies of this card owned");
    }

    cardOwned.redeemedCount = (cardOwned.redeemedCount || 0) + 1;
    await supabase.from('users').update({ cards_collected: coll }).eq('uid', studentUid);

    const reqData = {
      id: `req-${Math.random().toString(36).substr(2, 9)}`,
      student_uid: studentUid,
      student_name: userProfile.full_name || userProfile.display_name || "นักเรียน",
      student_room: userProfile.room || "",
      student_grade: userProfile.grade || "",
      card_id: cardId,
      card_name: card.name,
      rarity: card.rarity,
      bonus_points: card.bonusPoints,
      status: "pending",
      created_at: Date.now()
    };

    const { error } = await supabase.from('redemptions').insert(reqData);
    if (error) throw error;

    return mapRedemptionFromDb(reqData);
  },

  getRedemptions: async (): Promise<RedemptionRequest[]> => {
    const { data, error } = await supabase.from('redemptions').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapRedemptionFromDb);
  },

  getStudentRedemptions: async (studentUid: string): Promise<RedemptionRequest[]> => {
    const { data, error } = await supabase
      .from('redemptions')
      .select('*')
      .eq('student_uid', studentUid);
    
    if (error) return [];
    return data.map(mapRedemptionFromDb).sort((a, b) => b.createdAt - a.createdAt);
  },

  approveRedemption: async (requestId: string): Promise<void> => {
    const { data: req } = await supabase.from('redemptions').select('*').eq('id', requestId).single();
    if (!req || req.status !== "pending") return;

    const { data: user } = await supabase.from('users').select('bonus_points').eq('uid', req.student_uid).single();
    if (!user) return;

    await supabase.from('redemptions').update({ status: "approved" }).eq('id', requestId);
    await supabase.from('users').update({
      bonus_points: (user.bonus_points || 0) + (req.bonus_points || 0)
    }).eq('uid', req.student_uid);
  },

  rejectRedemption: async (requestId: string): Promise<void> => {
    const { data: req } = await supabase.from('redemptions').select('*').eq('id', requestId).single();
    if (!req || req.status !== "pending") return;

    const { data: user } = await supabase.from('users').select('cards_collected').eq('uid', req.student_uid).single();
    if (!user) return;

    const coll = (user.cards_collected || []) as CardCollected[];
    const cardOwned = coll.find((c: any) => c.cardId === req.card_id);
    if (cardOwned) {
      cardOwned.redeemedCount = Math.max(0, (cardOwned.redeemedCount || 0) - 1);
    }

    await supabase.from('redemptions').update({ status: "rejected" }).eq('id', requestId);
    await supabase.from('users').update({ cards_collected: coll }).eq('uid', req.student_uid);
  },

  exchangeCommonCards: async (studentUid: string): Promise<Card[]> => {
    const { data: cardsSettings } = await supabase.from('settings').select('*').eq('id', 'cards').single();
    const rates = (cardsSettings?.drop_rates as GachaRates)?.exchange || DEFAULT_DROP_RATES.exchange;

    const overrides = cardsSettings?.overrides || {};
    const custom = cardsSettings?.custom || [];
    const base = CARD_POOL.map(card => ({ ...card, ...(overrides[card.id] || {}) }));
    const activePool = [...base, ...custom];

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

      const matchingCards = activePool.filter(c => c.rarity === selectedRarity);
      if (matchingCards.length === 0) {
        const fallbackCards = CARD_POOL.filter(c => c.rarity === selectedRarity);
        return fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
      }
      return matchingCards[Math.floor(Math.random() * matchingCards.length)];
    };

    const newCards = [drawRandomCard(), drawRandomCard()];

    const { data: userProfile } = await supabase.from('users').select('*').eq('uid', studentUid).single();
    if (!userProfile) throw new Error("Student profile not found");
    
    const coll = (userProfile.cards_collected || []) as CardCollected[];
    let commonAvailable = 0;
    coll.forEach((item: any) => {
      const card = activePool.find(c => c.id === item.cardId);
      if (card && card.rarity === "common") {
        commonAvailable += (item.count || 0) - (item.redeemedCount || 0);
      }
    });

    if (commonAvailable < 5) throw new Error("Not enough common cards (need 5)");

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
    newCards.forEach(newCard => {
      const existing = updatedColl.find((c: any) => c.cardId === newCard.id);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
      } else {
        updatedColl.push({ cardId: newCard.id, count: 1, redeemedCount: 0 });
      }
    });

    await supabase.from('users').update({ cards_collected: updatedColl }).eq('uid', studentUid);

    return newCards;
  }
};

// ============================================================
// ANNOUNCEMENT SERVICE
// ============================================================
export const announcementService = {
  getAnnouncements: async (): Promise<Announcement[]> => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      authorName: row.author_name,
      createdAt: Number(row.created_at),
      pinned: row.pinned
    }));
  },

  subscribeAnnouncements: (callback: (list: Announcement[]) => void) => {
    const fetchList = async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (data) {
        callback(data.map(row => ({
          id: row.id,
          title: row.title,
          content: row.content,
          authorName: row.author_name,
          createdAt: Number(row.created_at),
          pinned: row.pinned
        })));
      }
    };

    fetchList();

    const channel = supabase
      .channel(`public:announcements:${Math.random().toString(36).substr(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  addAnnouncement: async (title: string, content: string, authorName: string, pinned?: boolean): Promise<void> => {
    pinned = pinned || false;
    await supabase.from('announcements').insert({
      id: `ann-${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      content: content.trim(),
      author_name: authorName,
      created_at: Date.now(),
      pinned
    });
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await supabase.from('announcements').delete().eq('id', id);
  }
};

// ============================================================
// LESSON SERVICE
// ============================================================
export const lessonService = {
  subscribeLessons: (callback: (lessons: Lesson[]) => void) => {
    const fetchList = async () => {
      const { data } = await supabase.from('lessons').select('*').order('created_at', { ascending: false });
      if (data) {
        callback(data.map(mapLessonFromDb));
      }
    };

    fetchList();

    const channel = supabase
      .channel(`public:lessons:${Math.random().toString(36).substr(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => {
        fetchList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    const uid = await getCurrentUid();
    if (!uid) throw new Error("No user signed in");
    const { data: profile } = await supabase.from('users').select('*').eq('uid', uid).single();

    let assignmentId = "";
    if (hasAssignment) {
      const boardId = `board-${Math.random().toString(36).substr(2, 9)}`;
      await supabase.from('boards').insert({
        id: boardId,
        title: `งาน: ${title}`,
        description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
        created_at: Date.now(),
        type: assignmentType || "individual",
        lesson_id: "",
        is_locked: false,
        target_rooms: targetRooms || []
      });
      assignmentId = boardId;
    }

    const lessonId = `lesson-${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('lessons').insert({
      id: lessonId,
      title,
      content,
      canva_url: canvaUrl,
      youtube_url: youtubeUrl,
      created_at: Date.now(),
      author_email: profile ? (profile.email || "") : "",
      has_assignment: !!hasAssignment,
      assignment_id: assignmentId,
      assignment_type: assignmentType || "",
      target_rooms: targetRooms || []
    });

    if (hasAssignment && assignmentId) {
      await supabase.from('boards').update({ lesson_id: lessonId }).eq('id', assignmentId);
    }
  },

  deleteLesson: async (id: string): Promise<void> => {
    await supabase.from('lessons').delete().eq('id', id);
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
    let assignmentId = existingAssignmentId || "";

    if (hasAssignment) {
      if (assignmentId) {
        await supabase.from('boards').update({
          title: `งาน: ${title}`,
          description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
          type: assignmentType || "individual",
          target_rooms: targetRooms || []
        }).eq('id', assignmentId);
      } else {
        const boardId = `board-${Math.random().toString(36).substr(2, 9)}`;
        await supabase.from('boards').insert({
          id: boardId,
          title: `งาน: ${title}`,
          description: assignmentDescription || `ส่งงานสำหรับบทเรียน: ${title}`,
          created_at: Date.now(),
          type: assignmentType || "individual",
          lesson_id: id,
          is_locked: false,
          target_rooms: targetRooms || []
        });
        assignmentId = boardId;
      }
    } else {
      if (assignmentId) {
        await supabase.from('boards').delete().eq('id', assignmentId);
        assignmentId = "";
      }
    }

    await supabase.from('lessons').update({
      title,
      content,
      canva_url: canvaUrl,
      youtube_url: youtubeUrl,
      has_assignment: !!hasAssignment,
      assignment_id: assignmentId,
      assignment_type: assignmentType || "",
      target_rooms: targetRooms || []
    }).eq('id', id);
  }
};

// ============================================================
// BOARD SERVICE
// ============================================================
export const boardService = {
  subscribeBoards: (callback: (boards: AssignmentBoard[]) => void) => {
    const fetchList = async () => {
      const { data } = await supabase.from('boards').select('*').order('created_at', { ascending: false });
      if (data) {
        callback(data.map(mapBoardFromDb));
      }
    };

    fetchList();

    const channel = supabase
      .channel(`public:boards:${Math.random().toString(36).substr(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => {
        fetchList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  addBoard: async (title: string, description: string, type?: "individual" | "group", targetRooms?: string[]): Promise<void> => {
    type = type || "individual";
    await supabase.from('boards').insert({
      id: `board-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      created_at: Date.now(),
      type,
      is_locked: false,
      target_rooms: targetRooms || []
    });
  },

  deleteBoard: async (id: string): Promise<void> => {
    await supabase.from('boards').delete().eq('id', id);
  },

  toggleLockBoard: async (boardId: string, isLocked: boolean): Promise<void> => {
    await supabase.from('boards').update({ is_locked: isLocked }).eq('id', boardId);
  }
};

// ============================================================
// SUBMISSION SERVICE
// ============================================================
export const submissionService = {
  subscribeSubmissions: (boardId: string, callback: (submissions: Submission[]) => void) => {
    const fetchList = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });
      if (data) {
        callback(data.map(mapSubmissionFromDb));
      }
    };

    fetchList();

    const channel = supabase
      .channel(`public:submissions:${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `board_id=eq.${boardId}` }, () => {
        fetchList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  addSubmission: async (
    boardId: string, 
    title: string, 
    description: string, 
    linkUrl: string, 
    isGroup?: boolean, 
    members?: { name: string; room: string; studentNo: string }[]
  ): Promise<void> => {
    isGroup = isGroup || false;
    members = members || [];
    const uid = await getCurrentUid();
    if (!uid) throw new Error("No user signed in");

    const { data: profile } = await supabase.from('users').select('*').eq('uid', uid).single();
    if (!profile) throw new Error("No profile found");

    const submissionId = `sub-${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('submissions').insert({
      id: submissionId,
      board_id: boardId,
      uid: uid,
      student_name: profile.full_name || profile.display_name || "นักเรียน",
      student_no: profile.student_no || "-",
      grade_class: profile.grade && profile.room ? `ม.${profile.grade}/${profile.room}` : "ทั่วไป",
      title,
      description,
      link_url: linkUrl,
      likes: [],
      comments: [],
      created_at: Date.now(),
      is_group: isGroup,
      members,
      status: "pending"
    });

    // Reward: 1 Pack for submitting (awarded to all group members)
    if (isGroup && members && members.length > 0) {
      for (const m of members) {
        const { data: mProfiles } = await supabase
          .from('users')
          .select('uid, packs_count')
          .eq('room', String(m.room))
          .eq('student_no', String(m.studentNo));
        
        if (mProfiles) {
          for (const mp of mProfiles) {
            await supabase
              .from('users')
              .update({ packs_count: (mp.packs_count || 0) + 1 })
              .eq('uid', mp.uid);
          }
        }
      }
      
      const submitterInGroup = members.find(m => String(m.room) === String(profile.room) && String(m.studentNo) === String(profile.studentNo));
      if (!submitterInGroup) {
         await supabase.from('users').update({ packs_count: (profile.packs_count || 0) + 1 }).eq('uid', uid);
      }
    } else {
      await supabase.from('users').update({ packs_count: (profile.packs_count || 0) + 1 }).eq('uid', uid);
    }
  },

  deleteSubmission: async (submissionId: string): Promise<void> => {
    await supabase.from('submissions').delete().eq('id', submissionId);
  },

  toggleLike: async (submissionId: string): Promise<void> => {
    const uid = await getCurrentUid();
    if (!uid) throw new Error("No user signed in");

    const { data: sub } = await supabase.from('submissions').select('likes').eq('id', submissionId).single();
    if (!sub) return;

    const likesList = (sub.likes || []) as string[];
    const hasLiked = likesList.includes(uid);
    const newLikes = hasLiked
      ? likesList.filter(id => id !== uid)
      : [...likesList, uid];

    await supabase.from('submissions').update({ likes: newLikes }).eq('id', submissionId);
  },

  addComment: async (submissionId: string, content: string): Promise<void> => {
    const uid = await getCurrentUid();
    if (!uid) throw new Error("No user signed in");

    const { data: profile } = await supabase.from('users').select('full_name, display_name').eq('uid', uid).single();
    if (!profile) return;

    const { data: sub } = await supabase.from('submissions').select('comments').eq('id', submissionId).single();
    if (!sub) return;

    const newComment = {
      id: "comment-" + Math.random().toString(36).substr(2, 9),
      uid: uid,
      authorName: profile.full_name || profile.display_name || "ผู้ใช้",
      content,
      createdAt: Date.now()
    };

    const commentsList = (sub.comments || []) as any[];
    await supabase.from('submissions').update({ comments: [...commentsList, newComment] }).eq('id', submissionId);
  },

  gradeSubmission: async (
    submissionId: string, 
    score: number, 
    maxScore: number, 
    status: "graded" | "resubmit", 
    teacherFeedback: string,
    awardPack?: boolean
  ): Promise<void> => {
    await supabase.from('submissions').update({
      score,
      max_score: maxScore,
      status,
      teacher_feedback: teacherFeedback
    }).eq('id', submissionId);

    if (awardPack) {
      const { data: sub } = await supabase.from('submissions').select('*').eq('id', submissionId).single();
      if (sub) {
         if (sub.is_group && sub.members && sub.members.length > 0) {
            for (const m of sub.members) {
              const { data: mProfiles } = await supabase
                .from('users')
                .select('uid, packs_count')
                .eq('room', String(m.room))
                .eq('student_no', String(m.studentNo));
              
              if (mProfiles) {
                for (const mp of mProfiles) {
                  await supabase
                    .from('users')
                    .update({ packs_count: (mp.packs_count || 0) + 1 })
                    .eq('uid', mp.uid);
                }
              }
            }
         } else {
            const { data: u } = await supabase.from('users').select('packs_count').eq('uid', sub.uid).single();
            if (u) {
              await supabase.from('users').update({ packs_count: (u.packs_count || 0) + 1 }).eq('uid', sub.uid);
            }
         }
      }
    }
  },

  subscribeAllSubmissions: (callback: (submissions: Submission[]) => void) => {
    const fetchList = async () => {
      const { data } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });
      if (data) {
        callback(data.map(mapSubmissionFromDb));
      }
    };

    fetchList();

    const channel = supabase
      .channel(`public:submissions:all:${Math.random().toString(36).substr(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  getAllSubmissions: async (): Promise<Submission[]> => {
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapSubmissionFromDb);
  }
};

export async function syncCardsFromSupabase(): Promise<void> {
  if (typeof window === "undefined" || !supabase) return;
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'cards')
      .single();
    if (!error && data) {
      const DROP_RATES_KEY = "mock_drop_rates";
      const CARD_POOL_STORAGE_KEY = "mock_card_pool_overrides";
      const CUSTOM_CARDS_KEY = "mock_custom_cards";

      if (data.drop_rates) {
        localStorage.setItem(DROP_RATES_KEY, JSON.stringify(data.drop_rates));
      }
      if (data.overrides) {
        localStorage.setItem(CARD_POOL_STORAGE_KEY, JSON.stringify(data.overrides));
      }
      if (data.custom) {
        localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(data.custom));
      }
      window.dispatchEvent(new Event("storage"));
    }
  } catch (e) {
    console.error("syncCardsFromSupabase error:", e);
  }
}
