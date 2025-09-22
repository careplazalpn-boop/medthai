import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "แพทย์แผนไทยศูนย์บริการสาธารณสุขเทศบาลเมืองลำพูน",
  description: "ระบบคิวนวดแพทย์แผนไทย",
};

// Props interface สำหรับ RootLayout
interface LayoutProps {
  children: React.ReactNode;
  eaDir?: string; // optional เพื่อไม่ให้เกิด error
}

export default function RootLayout({ children, eaDir }: LayoutProps) {
  return (
    <html lang="en" dir={eaDir ?? "ltr"}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
