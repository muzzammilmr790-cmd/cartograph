"use client";

import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Read saved theme from localStorage or cookie
    const saved = (localStorage.getItem("cartograph_theme") as Theme) || "system";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem("cartograph_theme", newTheme);
    root.setAttribute("data-theme", newTheme);

    const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveDark = newTheme === "dark" || (newTheme === "system" && isSystemDark);

    if (effectiveDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  const handleSelect = (selected: Theme) => {
    setTheme(selected);
    applyTheme(selected);
  };

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <div
      className="inline-flex items-center rounded-md bg-zinc-100 p-0.5 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-xs font-mono select-none"
      role="group"
      aria-label="Theme selector"
    >
      <button
        type="button"
        onClick={() => handleSelect("system")}
        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
          theme === "system"
            ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Follow System Theme"
      >
        System
      </button>
      <button
        type="button"
        onClick={() => handleSelect("light")}
        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
          theme === "light"
            ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Force Light Theme"
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => handleSelect("dark")}
        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
          theme === "dark"
            ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Force Dark Theme"
      >
        Dark
      </button>
    </div>
  );
}
