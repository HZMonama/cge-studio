import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { cn } from "@/lib/utils";
import { AgentationProvider } from "@/components/agentation-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "cge-ui",
  description: "Local-first UI scaffold for claude-grc-engineering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark h-full bg-background antialiased", spaceGrotesk.variable, jetbrainsMono.variable)}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <AgentationProvider />
      </body>
    </html>
  );
}
