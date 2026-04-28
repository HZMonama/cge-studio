"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";

export function ThemeInit() {
  const { theme, setMounted, setTheme } = useThemeStore();

  useEffect(() => {
    // Apply the initial theme class on mount
    setTheme(theme);
    setMounted(true);
  }, []);

  return null;
}
