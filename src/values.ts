export const SVG_NS = "http://www.w3.org/2000/svg"
export const MAX_URL_BYTES = 8192
export const MAX_ICON_BYTES = 16 * 1024
export const MAX_PATH_LENGTH = 8192
export const MAX_TEXT_LENGTH = 120
export const BUTTON_PATH = "/v1/button.svg"
export const ICON_CENTER = { x: 20.67745, y: 17 }
export const ICON_SIZE_RANGE = { min: 8, max: 24 }

export const defaults = {
  text: "Deploy",
  bg: "#000000",
  fg: "#f2f2f2",
  border: "#18181b",
  borderWidth: 1,
  radius: 6,
  divider: "#3a3a3a",
  iconColor: "#f2f2f2",
  iconSize: 20,
  scale: 1,
  rev: "",
} as const

export class InputError extends Error {}

export function isSimpleIconSlug(slug: string): boolean {
  return slug !== "mastra" && slug !== "none" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)
}

export function simpleIconAssetPath(slug: string): string {
  return `/simple-icons/${encodeURIComponent(slug)}.svg`
}

const colors = new Map(Object.entries({
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", maroon: "#800000", purple: "#800080", fuchsia: "#ff00ff",
  lime: "#00ff00", olive: "#808000", navy: "#000080", teal: "#008080",
  aqua: "#00ffff", orange: "#ffa500", transparent: "#00000000",
}))

export function color(value: string, label: string): string {
  const normalized = value.trim().toLowerCase()
  const named = colors.get(normalized)
  if (named) return named
  if (!/^#?(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(normalized)) {
    throw new InputError(`${label}: use a hexadecimal color or a supported color name.`)
  }
  let hex = normalized.replace(/^#/, "")
  if (hex.length < 5) hex = [...hex].map((char) => char + char).join("")
  if (hex.length === 8 && hex.endsWith("ff")) hex = hex.slice(0, 6)
  return `#${hex}`
}

export function decimal(value: string, label: string, min: number, max: number): number {
  const normalized = value.trim()
  const number = Number(normalized)
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) || number < min || number > max) {
    throw new InputError(`${label}: enter a decimal between ${min} and ${max}.`)
  }
  return number
}

export function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function encodeIcon(source: string): string {
  const bytes = new TextEncoder().encode(source)
  if (bytes.length > MAX_ICON_BYTES) throw new InputError("SVG exceeds the 16 KiB limit.")
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

export function decodeIcon(value: string): string {
  if (value.length > Math.ceil(MAX_ICON_BYTES * 4 / 3) || !/^[\w-]+$/.test(value)) {
    throw new InputError("iconSvg: use unpadded Base64URL with up to 16 KiB of SVG.")
  }
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
    if (encodeIcon(source) !== value) throw new Error("Invalid Base64URL.")
    return source
  } catch {
    throw new InputError("iconSvg: invalid Base64URL or non-UTF-8 SVG.")
  }
}
