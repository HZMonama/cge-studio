"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Hook that detects clicks outside of a referenced element
 * @param handler - Callback to execute when clicking outside
 * @param enabled - Whether the click detection is active (default: true)
 * @returns Ref to attach to the element
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  handler: () => void,
  enabled: boolean = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      
      // Check if click is outside the referenced element
      if (ref.current && !ref.current.contains(target)) {
        handler();
      }
    }

    // Use capture phase to ensure we catch clicks before they might be stopped
    document.addEventListener("mousedown", handleClick, true);
    
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
    };
  }, [handler, enabled]);

  return ref;
}
