import { parseSvg, type IconGeometry } from "./icon.ts"
import { simpleIconAssetPath } from "./values.ts"

type Icon = [slug: string, title: string]
type Selection = { slug: string; geometry: IconGeometry }

const resultLimit = 60

export function setupSimpleIconsPicker(onIconChange: () => void) {
  const panel = document.querySelector<HTMLElement>("#simple-icons-fields")!
  const search = document.querySelector<HTMLInputElement>("#simple-icons-search")!
  const list = document.querySelector<HTMLSelectElement>("#simple-icons-list")!
  const results = document.querySelector<HTMLElement>("#simple-icons-results")!
  const status = document.querySelector<HTMLElement>("#simple-icons-status")!
  let catalog: Icon[] | undefined
  let loading = false
  let selected = ""
  let icon: Selection | undefined
  let selection = 0

  function updateResults() {
    if (!catalog) return
    const query = search.value.trim().toLowerCase()
    const matches = catalog.filter(([slug, title]) => slug.includes(query) || title.toLowerCase().includes(query))
    const visible = matches.slice(0, resultLimit)
    list.replaceChildren(...visible.map(([slug, title]) => new Option(title, slug)))
    list.selectedIndex = visible.findIndex(([slug]) => slug === selected)
    list.disabled = visible.length === 0
    results.textContent = matches.length === 0
      ? "No matching brands."
      : `Showing ${visible.length} of ${matches.length.toLocaleString()} brands.`
  }

  async function loadCatalog() {
    loading = true
    results.textContent = "Loading the icon catalog…"
    try {
      const response = await fetch("/simple-icons/catalog.json")
      if (!response.ok) throw new Error()
      catalog = await response.json() as Icon[]
      updateResults()
    } catch {
      results.textContent = "Could not load the icon catalog. Reopen the picker to try again."
    } finally {
      loading = false
    }
  }

  async function chooseIcon() {
    const slug = list.value
    const title = list.selectedOptions[0]?.text
    if (!slug || !title) return

    const request = ++selection
    selected = slug
    icon = undefined
    status.textContent = `Loading ${title}…`
    onIconChange()

    try {
      const response = await fetch(simpleIconAssetPath(slug))
      if (!response.ok) throw new Error()
      const geometry = parseSvg(await response.text())
      if (request !== selection) return
      icon = { slug, geometry }
      status.textContent = `Selected ${title}.`
      onIconChange()
    } catch {
      if (request !== selection) return
      selected = ""
      list.selectedIndex = -1
      status.textContent = `Could not load ${title}. Select it again to retry.`
    }
  }

  search.addEventListener("input", updateResults)
  list.addEventListener("change", () => { void chooseIcon() })

  return {
    get value() { return icon },
    show(active: boolean) {
      if (panel.hidden === !active) return
      panel.hidden = !active
      if (active && !catalog && !loading) void loadCatalog()
    },
  }
}
