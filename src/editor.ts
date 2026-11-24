import { buttonUrl, markdown, parseButton, renderButton } from "./button.ts"
import { normalizedSvg, parseSvg } from "./icon.ts"
import { setupSimpleIconsPicker } from "./simple-icons-picker.ts"
import { setupTheme } from "./theme.ts"
import { byteLength, encodeIcon, InputError, MAX_ICON_BYTES } from "./values.ts"

const form = document.querySelector<HTMLFormElement>("#editor")!
const preview = document.querySelector<HTMLImageElement>("#preview")!
const output = document.querySelector<HTMLTextAreaElement>("#markdown")!
const pathFields = document.querySelector<HTMLElement>("#path-fields")!
const svgFields = document.querySelector<HTMLElement>("#svg-fields")!
const dimensions = document.querySelector<HTMLElement>("#dimensions")!
const renderStatus = document.querySelector<HTMLElement>("#render-status")!
const actionStatus = document.querySelector<HTMLElement>("#action-status")!
const importStatus = document.querySelector<HTMLElement>("#import-status")!
const copyMarkdown = document.querySelector<HTMLButtonElement>("#copy-markdown")!
const copyUrl = document.querySelector<HTMLButtonElement>("#copy-url")!
const download = document.querySelector<HTMLButtonElement>("#download")!
const importFile = form.elements.namedItem("importFile") as HTMLInputElement
const importSource = form.elements.namedItem("importSource") as HTMLTextAreaElement
const simpleIcons = setupSimpleIconsPicker(render)

const fields = ["text", "bg", "fg", "border", "borderWidth", "radius", "divider", "iconColor", "scale", "rev"]
let previewUrl = ""
let publishedUrl = ""
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
  pathFields.hidden = source !== "path"
  svgFields.hidden = source !== "svg"
  simpleIcons.show(source === "simple-icons")
  setStatus(actionStatus, "")
  setStatus(renderStatus, "")
  output.value = ""
  download.disabled = copyUrl.disabled = copyMarkdown.disabled = true
  publishedUrl = ""

  try {
    const params = new URLSearchParams()
    for (const name of fields) params.set(name, field(name))
    if (source === "path") {
      params.set("iconPath", field("iconPath"))
      params.set("iconViewBox", field("iconViewBox"))
    } else if (source === "svg") {
      if (!importedIcon) throw new InputError("Import an SVG from a URL, a file, or pasted markup.")
      params.set("iconSvg", importedIcon)
    } else if (source === "simple-icons") {
      if (!simpleIcons.value) throw new InputError("Choose a brand from Simple Icons.")
      params.set("iconSvg", simpleIcons.value)
    } else {
      params.set("icon", source)
    }

    const button = parseButton(params)
    const svg = renderButton(button)
    const url = buttonUrl(location.origin, button)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    preview.src = previewUrl
    preview.alt = button.text
    preview.hidden = false
    download.disabled = false

    if (!url) {
      setStatus(renderStatus, "The URL exceeds 8192 bytes. Download the SVG and add it to your repository.")
      return
    }
    publishedUrl = url.href
    copyUrl.disabled = false

    output.value = markdown(button.text, publishedUrl, destination(field("destination")))
    copyMarkdown.disabled = false
  } catch (error) {
    if (download.disabled) {
      preview.hidden = true
      dimensions.textContent = ""
    }
    setStatus(renderStatus, message(error), true)
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

async function copy(value: string, confirmation: string, fallback: () => void) {
  try {
    await navigator.clipboard.writeText(value)
    setStatus(actionStatus, confirmation)
  } catch {
    fallback()
  }
}

form.addEventListener("submit", (event) => event.preventDefault())
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
copyMarkdown.addEventListener("click", () => {
  void copy(output.value, "Markdown copied.", () => {
    output.focus()
    output.select()
    setStatus(actionStatus, "Copy the selected Markdown.", true)
  })
})
copyUrl.addEventListener("click", () => {
  const value = publishedUrl
  void copy(value, "SVG URL copied.", () => { window.prompt("Copy the SVG URL", value) })
})
download.addEventListener("click", () => {
  const link = document.createElement("a")
  link.href = previewUrl
  link.download = "button.svg"
  link.click()
  setStatus(actionStatus, "SVG download started.")
})
setupTheme()
render()
