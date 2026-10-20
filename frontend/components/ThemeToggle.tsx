"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-md border border-border bg-card/60 ${className || ""}`} />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
      className={`relative inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer shadow-sm ${className || ""}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-primary transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-primary transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  )
}
