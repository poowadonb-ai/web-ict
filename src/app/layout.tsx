import type { Metadata } from "next";
import { Prompt, Outfit } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
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
  description: "ระบบการเรียนการสอนออนไลน์วิชาเทคโนโลยีสารสนเทศ พร้อมกระดานส่งงานแบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} ${outfit.variable}`}>
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
