"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({ theme: "dark", toggleTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const stored = localStorage.getItem("rhd-theme") as Theme | null
    const resolved: Theme = stored === "light" ? "light" : "dark"
    setTheme(resolved)
    document.documentElement.setAttribute("data-theme", resolved)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("rhd-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
