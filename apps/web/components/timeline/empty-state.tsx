"use client";

import { motion } from "motion/react";

const INSPECTOR_SHORTCUTS = [
  { id: "github-inspector", label: "GitHub Inspector", icon: "/github_dark.svg" },
  { id: "aws-inspector",    label: "AWS Inspector",    icon: "/aws_dark.svg" },
  { id: "gcp-inspector",    label: "GCP Inspector",    icon: "/google_cloud.svg" },
  { id: "okta-inspector",   label: "Okta Inspector",   icon: "/okta_dark.png" },
];

export function EmptyState({ onQuickRun }: { onQuickRun?: (commandPath: string) => void }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-max text-center">
        <motion.p
          className="text-[48pt] font-semibold leading-none tracking-tight text-foreground"
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: [0.25, 0, 0.2, 1] }}
        >
          CGE Studio
        </motion.p>
        <motion.p
          className="mt-2 text-2xl font-normal italic text-muted-foreground/60"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, ease: [0.25, 0, 0.2, 1], delay: 0.1 }}
        >
          alpha
        </motion.p>
        <motion.div
          className="mt-14"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0, 0.2, 1], delay: 0.22 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-border/40" />
            <span className="font-mono text-[11px] text-muted-foreground/40">Start here</span>
            <div className="flex-1 border-t border-dashed border-border/40" />
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            {INSPECTOR_SHORTCUTS.map((inspector, i) => (
              <motion.button
                key={inspector.id}
                type="button"
                onClick={() => onQuickRun?.(`/${inspector.id}:setup`)}
                className="inline-flex items-center gap-2.5 border border-border/60 bg-card/60 p-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.35, ease: [0.25, 0, 0.2, 1], delay: 0.32 + i * 0.06 }}
              >
                <img src={inspector.icon} alt="" className="w-4 h-4 flex-shrink-0 object-contain" />
                <span className="ml-1">{inspector.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
