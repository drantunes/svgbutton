import ChoicesModule from "choices.js"
import { parseSvg, type IconGeometry } from "./icon.ts"
import { editorDefaults, simpleIconAssetPath } from "./values.ts"

type Icon = [slug: string, title: string]
type Selection = { slug: string; geometry: IconGeometry }

// The package shares CommonJS declarations with its ESM default export.
const Choices = ChoicesModule as unknown as typeof ChoicesModule.default

export function setupSimpleIconsPicker(onIconChange: () => void) {
  const panel = document.querySelector<HTMLElement>("#simple-icons-fields")!
  const list = document.querySelector<HTMLSelectElement>("#simple-icons-list")!
  const catalogStatus = document.querySelector<HTMLElement>("#simple-icons-catalog-status")!
  const status = document.querySelector<HTMLElement>("#simple-icons-status")!
  const picker = new Choices(list, {
    allowHTML: false,
    itemSelectText: "",
    labelId: "simple-icons-label",
    noResultsText: "No matching brands.",
    renderChoiceLimit: 60,
    searchPlaceholderValue: "Search brands…",
    searchResultLimit: 60,
    shouldSort: false,
  })
  let catalogLoaded = false
  let catalogLoading = false
  let iconLoading = false
  let icon: Selection | undefined
  let selection = 0

  async function loadCatalog() {
    if (catalogLoaded || catalogLoading) return
    catalogLoading = true
    catalogStatus.textContent = "Loading the icon catalog…"
    try {
      const response = await fetch("/simple-icons/catalog.json")
      if (!response.ok) throw new Error()
      const catalog = (await response.json()) as Icon[]
      picker.setChoices(
        catalog.filter(([slug]) => slug !== editorDefaults.icon).map(([value, label]) => ({ value, label })),
      )
      catalogLoaded = true
      catalogStatus.textContent = ""
    } catch {
      catalogStatus.textContent = "Could not load the icon catalog. Reopen the picker to try again."
    } finally {
      catalogLoading = false
    }
  }

  async function chooseIcon(slug: string, title: string) {
    const request = ++selection
    iconLoading = true
    icon = undefined
    status.textContent = `Loading ${title}…`
    onIconChange()

    try {
      const response = await fetch(simpleIconAssetPath(slug))
      if (!response.ok) throw new Error()
      const geometry = parseSvg(await response.text())
      if (request !== selection) return
      icon = { slug, geometry }
      status.textContent = ""
    } catch {
      if (request !== selection) return
      picker.setChoiceByValue("")
      status.textContent = `Could not load ${title}. Select it again to retry.`
    }
    iconLoading = false
    onIconChange()
  }

  list.addEventListener("showDropdown", () => {
    void loadCatalog()
  })
  list.addEventListener("change", () => {
    const option = list.selectedOptions[0]
    if (option?.value) void chooseIcon(option.value, option.text)
  })

  return {
    chooseIcon,
    get value() {
      return icon
    },
    get pending() {
      return iconLoading
    },
    show(active: boolean) {
      if (panel.hidden === !active) return
      panel.hidden = !active
      if (active) void loadCatalog()
      else picker.hideDropdown(true)
    },
  }
}
