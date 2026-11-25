import { buttonUrl, markdown, parseButton, renderButton } from "./button.ts"
import { normalizedSvg, parseSvg } from "./icon.ts"
import { setupSimpleIconsPicker } from "./simple-icons-picker.ts"
import { setupTheme } from "./theme.ts"
import { byteLength, color, editorDefaults, encodeIcon, InputError, MAX_ICON_BYTES } from "./values.ts"

const form = document.querySelector<HTMLFormElement>("#editor")!
const preview = document.querySelector<HTMLImageElement>("#preview")!
const imagePreview = document.querySelector<HTMLElement>("#image-preview")!
const formatButtons = document.querySelectorAll<HTMLButtonElement>("#preview-formats button")
const output = document.querySelector<HTMLTextAreaElement>("#output")!
const outputHighlight = document.querySelector<HTMLElement>("#output-highlight")!
const pathFields = document.querySelector<HTMLElement>("#path-fields")!
const svgFields = document.querySelector<HTMLElement>("#svg-fields")!
const iconTextField = document.querySelector<HTMLElement>("#icon-text-field")!
const iconColorLabel = document.querySelector<HTMLElement>("#icon-color-label")!
const iconSizeField = document.querySelector<HTMLElement>("#icon-size-field")!
const backgroundLabel = document.querySelector<HTMLElement>("#background-label")!
const iconBackgroundLabel = document.querySelector<HTMLElement>("#icon-background-label")!
const iconBackgroundField = document.querySelector<HTMLElement>("#icon-background-field")!
const dividerField = document.querySelector<HTMLElement>("#divider-field")!
const dimensions = document.querySelector<HTMLElement>("#dimensions")!
const renderStatus = document.querySelector<HTMLElement>("#render-status")!
const actionStatus = document.querySelector<HTMLElement>("#action-status")!
const importStatus = document.querySelector<HTMLElement>("#import-status")!
const copyOutput = document.querySelector<HTMLButtonElement>("#copy-output")!
const copyTooltip = document.querySelector<HTMLElement>("#copy-tooltip")!
const download = document.querySelector<HTMLButtonElement>("#download")!
const importFile = form.elements.namedItem("importFile") as HTMLInputElement
const importSource = form.elements.namedItem("importSource") as HTMLTextAreaElement
const simpleIcons = setupSimpleIconsPicker(render)

const fields = [
  "text", "fontSize", "paddingX", "paddingY", "layout", "bg", "fg", "border", "borderWidth", "radius",
  "iconColor", "scale", "rev",
]
const outputLabels = { image: "Image URL", markdown: "Markdown", svg: "SVG" }
type Format = keyof typeof outputLabels
const outputPatterns: Record<Format, RegExp> = {
  image: /(?<link>.+)/g,
  markdown: /(?<link>(?<=\]\()[^)]+)|(?<escape>\\.)|(?<punctuation>!?\[|\]\(|\]|\))/g,
  svg: /(?<tag><\/?[\w:-]+|\/?>)|(?<attribute>[\w:-]+(?=="))|(?<value>"[^"]*")|(?<escape>&[\w#]+;)/g,
}
let format: Format = "image"
let outputValues: Record<Format, string>
let copyTimer: number | undefined
let previewUrl = ""
let importedIcon = ""
let importAttempt = 0

function field(name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value
}

function message(error: unknown): string {
  return error instanceof InputError ? error.message : "Could not process the SVG."
}

function setStatus(element: HTMLElement, text: string, isError = false) {
  element.textContent = text
  element.classList.toggle("error", isError)
  element.hidden = !text
}

function syncOutputScroll() {
  outputHighlight.style.translate = `${-output.scrollLeft}px ${-output.scrollTop}px`
}

function highlightOutput(value: string) {
  const fragment = document.createDocumentFragment()
  let end = 0
  for (const match of value.matchAll(outputPatterns[format])) {
    const span = document.createElement("span")
    const kind = Object.keys(match.groups!).find((key) => match.groups![key] !== undefined)
    span.className = `code-${kind}`
    span.textContent = match[0]
    fragment.append(value.slice(end, match.index), span)
    end = match.index + match[0].length
  }
  fragment.append(value.slice(end))
  outputHighlight.replaceChildren(fragment)
  syncOutputScroll()
}

function updateOutput() {
  output.value = outputValues[format]
  output.rows = format === "svg" ? 8 : 3
  highlightOutput(output.value)
  output.setAttribute("aria-label", outputLabels[format])
  copyOutput.disabled = !output.value
  copyOutput.setAttribute("aria-label", `Copy ${format === "image" ? "image URL" : outputLabels[format]}`)
  imagePreview.hidden = format !== "image"
  window.clearTimeout(copyTimer)
  copyTooltip.textContent = ""
}

function destination(value: string): string {
  if (!value.trim()) return ""
  try {
    const url = new URL(value)
    if (/^https?:$/.test(url.protocol) && url.hostname && !url.username && !url.password) return url.href
  } catch {
    // The same message covers incomplete URLs.
  }
  throw new InputError("Destination URL: enter a complete HTTP or HTTPS address.")
}

function render() {
  const source = field("source")
  const split = field("layout") === "split"
  const hasIcon = source !== "none"
  const hasLeftLabel = source === "text"
  backgroundLabel.textContent = split && hasIcon ? "Text background" : "Background"
  iconBackgroundLabel.textContent = hasLeftLabel ? "Left label background" : "Icon background"
  iconBackgroundField.hidden = !split || !hasIcon
  dividerField.hidden = split || !hasIcon
  iconTextField.hidden = !hasLeftLabel
  iconColorLabel.textContent = hasLeftLabel ? "Left label color" : "Icon color"
  iconSizeField.hidden = hasLeftLabel
  pathFields.hidden = source !== "path"
  svgFields.hidden = source !== "svg"
  simpleIcons.show(source === "simple-icons")
  setStatus(actionStatus, "")
  setStatus(renderStatus, "")
  outputValues = { image: "", markdown: "", svg: "" }
  download.disabled = true
  preview.hidden = true
  dimensions.textContent = ""

  try {
    if (source === "simple-icons" && simpleIcons.pending) return
    const selectedIcon = source === "simple-icons" ? simpleIcons.value : undefined
    const params = new URLSearchParams()
    for (const name of fields) params.set(name, field(name))
    if (!hasLeftLabel) params.set("iconSize", field("iconSize"))
    if (!iconBackgroundField.hidden) params.set("iconBg", field("iconBg"))
    if (!dividerField.hidden) params.set("divider", field("divider"))
    if (source === "path") {
      params.set("iconPath", field("iconPath"))
      params.set("iconViewBox", field("iconViewBox"))
    } else if (source === "svg") {
      if (!importedIcon) throw new InputError("Import an SVG from a URL, a file, or pasted markup.")
      params.set("iconSvg", importedIcon)
    } else if (hasLeftLabel) {
      params.set("iconText", field("iconText"))
    } else if (source === "simple-icons") {
      if (!selectedIcon) throw new InputError("Choose a brand from Simple Icons.")
      params.set("icon", selectedIcon.slug)
    } else {
      params.set("icon", source)
    }

    const button = parseButton(params)
    const svg = renderButton(button, selectedIcon?.geometry)
    const url = buttonUrl(location.origin, button)
    const label = button.icon.kind === "text" ? `${button.icon.label} · ${button.text}` : button.text
    outputValues.svg = svg
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    preview.src = previewUrl
    preview.alt = label
    preview.hidden = false
    download.disabled = false

    if (!url) {
      setStatus(renderStatus, "The URL exceeds 8192 bytes. Use the SVG tab or download the file.")
      return
    }
    outputValues.image = url.href
    outputValues.markdown = markdown(label, url.href, destination(field("destination")))
  } catch (error) {
    setStatus(renderStatus, message(error), true)
  } finally {
    updateOutput()
  }
}

async function readIcon(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) throw new InputError("The SVG file is empty.")
  const reader = stream.getReader()
  const bytes = new Uint8Array(MAX_ICON_BYTES)
  let offset = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (offset + value.length > bytes.length) {
        await reader.cancel()
        throw new InputError("SVG exceeds the 16 KiB limit.")
      }
      bytes.set(value, offset)
      offset += value.length
    }
  } finally {
    reader.releaseLock()
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset))
  } catch {
    throw new InputError("Use a UTF-8 encoded SVG file.")
  }
}

async function importIcon(load: () => string | Promise<string>) {
  const attempt = ++importAttempt
  setStatus(importStatus, "Reading SVG…")
  try {
    const source = await load()
    const normalized = normalizedSvg(parseSvg(source))
    const encoded = encodeIcon(byteLength(normalized) <= MAX_ICON_BYTES ? normalized : source)
    if (attempt !== importAttempt) return
    importedIcon = encoded
    importSource.value = normalized
    setStatus(importStatus, "SVG imported.")
    render()
  } catch (error) {
    if (attempt === importAttempt) setStatus(importStatus, message(error), true)
  }
}

async function importByUrl(): Promise<string> {
  let url: URL
  try {
    url = new URL(field("importUrl"))
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error()
  } catch {
    throw new InputError("Enter a valid HTTPS URL for the SVG.")
  }

  let response: Response
  try {
    response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new InputError("Could not import this URL. Check CORS and redirects, or use a file or pasted markup.")
  }
  if (!response.ok) throw new InputError(`The source returned HTTP ${response.status}. Use a file or pasted markup.`)
  return readIcon(response.body)
}

async function copy() {
  const value = output.value
  const copiedFormat = format
  setStatus(actionStatus, "")
  try {
    await navigator.clipboard.writeText(value)
    if (format !== copiedFormat || output.value !== value) return
    copyTooltip.textContent = "Copied!"
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => { copyTooltip.textContent = "" }, 1800)
  } catch {
    if (format !== copiedFormat || output.value !== value) return
    output.focus()
    output.select()
    setStatus(actionStatus, "Copy the selected text.", true)
  }
}

for (const button of formatButtons) {
  button.addEventListener("click", () => {
    format = button.dataset.format as Format
    for (const choice of formatButtons) choice.setAttribute("aria-pressed", String(choice === button))
    setStatus(actionStatus, "")
    updateOutput()
  })
}

for (const picker of form.querySelectorAll<HTMLInputElement>("input[type=color][data-color-for]")) {
  const input = form.elements.namedItem(picker.dataset.colorFor!) as HTMLInputElement
  let typedValue: string
  let typedColor: string | undefined

  function syncPicker() {
    typedValue = input.value
    try {
      typedColor = color(typedValue, input.name)
      picker.value = typedColor.slice(0, 7)
    } catch (error) {
      if (!(error instanceof InputError)) throw error
      // Keep the previous swatch while the text is incomplete or invalid.
      typedColor = undefined
    }
  }

  function applyPickedColor() {
    // The native picker edits RGB. Preserve typed opacity and restore the original text when RGB returns to it.
    const picked = picker.value
    const value = picked === typedColor?.slice(0, 7) ? typedValue : picked + (typedColor?.slice(7) ?? "")
    if (input.value === value) return
    input.value = value
    render()
  }

  syncPicker()
  input.addEventListener("input", syncPicker)
  picker.addEventListener("input", applyPickedColor)
  picker.addEventListener("change", applyPickedColor)
}

form.addEventListener("submit", (event) => event.preventDefault())
output.addEventListener("scroll", syncOutputScroll)
form.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement
  if (target.name && !target.name.startsWith("import")) render()
})
preview.addEventListener("load", () => {
  dimensions.textContent = `${preview.naturalWidth} × ${preview.naturalHeight} px`
})
document.querySelector("#import-url")!.addEventListener("click", () => { void importIcon(importByUrl) })
document.querySelector("#import-source")!.addEventListener("click", () => { void importIcon(() => importSource.value) })
importFile.addEventListener("change", () => {
  const file = importFile.files?.[0]
  if (file) void importIcon(() => readIcon(file.stream()))
  importFile.value = ""
})
copyOutput.addEventListener("click", () => { void copy() })
download.addEventListener("click", () => {
  const link = document.createElement("a")
  link.href = previewUrl
  link.download = "button.svg"
  link.click()
  setStatus(actionStatus, "SVG download started.")
})
setupTheme()
if (field("source") === "simple-icons") {
  void simpleIcons.chooseIcon(editorDefaults.icon, editorDefaults.iconTitle)
} else {
  render()
}
