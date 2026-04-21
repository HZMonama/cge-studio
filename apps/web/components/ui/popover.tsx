"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger {...props} />
}

function PopoverPortal({ ...props }: PopoverPrimitive.Portal.Props) {
  return <PopoverPrimitive.Portal {...props} />
}

function PopoverPositioner({
  side = "right",
  align = "start",
  sideOffset = 8,
  className,
  ...props
}: PopoverPrimitive.Positioner.Props) {
  return (
    <PopoverPrimitive.Positioner
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={cn("isolate z-50", className)}
      {...props}
    />
  )
}

function PopoverContent({ className, ...props }: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Popup
      className={cn(
        "w-72 origin-(--transform-origin) border bg-popover text-popover-foreground shadow-md outline-none",
        "transition-[opacity,scale] duration-150",
        "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
        "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverContent }
