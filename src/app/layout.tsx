import type { Metadata } from "next";
import { Prompt, Outfit } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import StarField from "@/components/StarField";
import "./globals.css";

const prompt = Prompt({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "ICT Online Classroom | ห้องเรียนออนไลน์เทคโนโลยีสารสนเทศ",
  description: "ระบบการเรียนการสอนออนไลน์วิชาเทคโนโลยีสารสนเทศ พร้อมกระดานส่งงานแบบเรียลไทม์ ระบบการ์ดสะสม และ Leaderboard แบบ Real-time",
  keywords: "ICT, ห้องเรียนออนไลน์, เทคโนโลยีสารสนเทศ, นักเรียน, ครู",
  openGraph: {
    title: "ICT Online Classroom",
    description: "แพลตฟอร์มการเรียนรู้ออนไลน์สำหรับนักเรียนและครูยุคใหม่",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} ${outfit.variable}`}>
      <body>
        {/* Animated star background — visible on all pages */}
        <StarField />

        <AuthProvider>
          <Navbar />
          <main
            className="page-enter"
            style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}
          >
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
