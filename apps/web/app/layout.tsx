import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";

import { cn } from "@/lib/utils";
import { AgentationProvider } from "@/components/agentation-provider";
import { ThemeInit } from "@/components/theme-init";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  title: "cge-studio",
  description: "Local UI for claude-grc-engineering cli.",
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
      className={cn(
        "h-full bg-background antialiased",
        spaceGrotesk.variable,
        jetbrainsMono.variable,
        instrumentSerif.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <ThemeInit />
        {children}
        <AgentationProvider />
      </body>
    </html>
  );
}
