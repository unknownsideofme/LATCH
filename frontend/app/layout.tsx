import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LATCH — The Coordination Layer for AI Coding Agents",
  description: "Zero-collision coordination engine for machine-speed AI agents. Exclusive write locking, dependency blast radius checks, and live causal patch sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0B0E11] text-[#F0F3F6] font-[var(--font-body)] antialiased selection:bg-[#3ECF8E] selection:text-black">
        {children}
      </body>
    </html>
  );
}
