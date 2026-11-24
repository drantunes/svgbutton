const themeKey = "svgbutton-theme"

export function setupTheme() {
  const root = document.documentElement
  const toggle = document.querySelector<HTMLButtonElement>("#theme-toggle")!
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!
  const system = matchMedia("(prefers-color-scheme: dark)")

  try {
    const saved = localStorage.getItem(themeKey) ?? localStorage.getItem("mastra-button-theme")
    if (saved === "light" || saved === "dark") root.dataset.theme = saved
  } catch {
    // Follow the system theme when storage is unavailable.
  }

  function updateToggle() {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : system.matches
    toggle.setAttribute("aria-pressed", String(dark))
    toggle.title = dark ? "Switch to light mode" : "Switch to dark mode"
    themeColor.content = getComputedStyle(root).backgroundColor
  }

  toggle.addEventListener("click", () => {
    const theme = toggle.getAttribute("aria-pressed") === "true" ? "light" : "dark"
    root.dataset.theme = theme
    try {
      localStorage.setItem(themeKey, theme)
    } catch {
      // The toggle still works for this page.
    }
    updateToggle()
  })
  system.addEventListener("change", updateToggle)
  updateToggle()
  toggle.hidden = false
}
