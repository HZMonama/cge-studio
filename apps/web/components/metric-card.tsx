"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  CaretDownIcon,
  CheckCircleIcon,
  CircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/app-store"

export type MetricCardStatus = "ok" | "warn" | "error" | "unknown"

function StatusIcon({ status }: { status: MetricCardStatus }) {
  if (status === "ok") return <CheckCircleIcon className="size-4 text-emerald-500" weight="fill" />
  if (status === "warn") return <WarningCircleIcon className="size-4 text-amber-500" weight="fill" />
  if (status === "error") return <XCircleIcon className="size-4 text-rose-500" weight="fill" />
  return <CircleIcon className="size-4 text-muted-foreground/45" weight="fill" />
}

export function MetricCard({
  children,
  className,
  defaultExpanded = false,
  expanded,
  footerAction,
  icon,
  label,
  onExpandedChange,
  status = "unknown",
}: {
  children?: React.ReactNode
  className?: string
  defaultExpanded?: boolean
  expanded?: boolean
  footerAction?: {
    label: string
    onClick?: () => void
    disabled?: boolean
  }
  icon: React.ReactNode
  label: string
  onExpandedChange?: (expanded: boolean) => void
  status?: MetricCardStatus
}) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(defaultExpanded)
  const { theme } = useAppStore()
  const isExpanded = expanded ?? uncontrolledExpanded

  function toggleExpanded() {
    const next = !isExpanded
    if (expanded == null) {
      setUncontrolledExpanded(next)
    }
    onExpandedChange?.(next)
  }

  return (
    <div
      className={cn(
        "group/metric-card border bg-background/70 transition-colors duration-200 hover:bg-background/70",
        isExpanded
          ? theme === "light"
            ? "border-sky-500/70"
            : "border-emerald-400/70"
          : "border-border/70",
        !isExpanded &&
          (theme === "light"
            ? "hover:border-sky-500/70 focus-within:border-sky-500/70"
            : "hover:border-emerald-400/70 focus-within:border-emerald-400/70"),
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex h-14 w-full items-center justify-between gap-3 px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-expanded={isExpanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            {icon}
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {label}
          </span>
        </span>
        <span className="flex shrink-0 items-center">
          <StatusIcon status={status} />
          <CaretDownIcon
            className={cn(
              "-mr-3 ml-0 size-3.5 translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover/metric-card:-mr-0 group-hover/metric-card:ml-2 group-hover/metric-card:translate-x-0 group-hover/metric-card:opacity-100 group-focus-within/metric-card:-mr-0 group-focus-within/metric-card:ml-2 group-focus-within/metric-card:translate-x-0 group-focus-within/metric-card:opacity-100",
              isExpanded && "-mr-0 ml-2 translate-x-0 rotate-180 opacity-100",
            )}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children && (
              <motion.div
                initial={{ y: -4 }}
                animate={{ y: 0 }}
                exit={{ y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="border-t border-border/50 px-4 py-4"
              >
                {children}
              </motion.div>
            )}
            {footerAction && (
              <motion.div
                initial={{ y: -4 }}
                animate={{ y: 0 }}
                exit={{ y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex justify-end border-t border-border/50 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={footerAction.onClick}
                  disabled={footerAction.disabled}
                  className="h-7 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {footerAction.label}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
