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
