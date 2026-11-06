import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const library3am = localFont({
  src: "./fonts/Library3am.otf",
  variable: "--font-library-3am",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LATCH — The Coordination Layer for AI Coding Agents",
  description: "Zero-collision coordination engine for machine-speed AI agents. Exclusive write locking, dependency blast radius checks, and live causal patch sync.",
  icons: {
    icon: [
      { url: "/latch-junction.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/latch-junction.svg",
    apple: "/latch-junction.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${library3am.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/latch-junction.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/latch-junction.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Fira+Code:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-[var(--font-body)] antialiased selection:bg-primary selection:text-primary-foreground transition-colors duration-200">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
