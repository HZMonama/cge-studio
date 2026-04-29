"use client";

import { useEffect } from "react";
import { hydrateAppStore } from "@/stores/app-store";

export function ThemeInit() {
  useEffect(() => {
    hydrateAppStore();
  }, []);

  return null;
}
