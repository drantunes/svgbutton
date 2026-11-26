import { pathData, viewBox } from "./geometry.ts"
import { normalizedSvg, parseSvg, pathIcon, renderIcon } from "./icon.ts"
import type { IconGeometry } from "./icon.ts"
import { DEPLOY_PATH, MASTRA_PATHS } from "./preset.ts"
import {
  BUTTON_PATH,
  byteLength,
  color,
  decimal,
  decimalRanges,
  decodeIcon,
  defaults,
  encodeIcon,
  escapeXml,
  fixedSizeRange,
  ICON_CENTER,
  InputError,
  isSimpleIconSlug,
  MAX_FIXED_SIZE_PIXELS,
  MAX_TEXT_LENGTH,
  MAX_URL_BYTES,
  SVG_NS,
} from "./values.ts"

const keys = [
  "text",
  "fontSize",
  "paddingX",
  "paddingY",
  "layout",
  "bg",
  "iconBg",
  "fg",
  "border",
  "borderWidth",
  "radius",
  "divider",
  "iconColor",
  "iconSize",
  "icon",
  "iconText",
  "iconPath",
  "iconViewBox",
  "iconSvg",
  "scale",
  "rev",
  "width",
  "height",
] as const
const known = new Set<string>(keys)

type Icon =
  | { kind: "mastra" }
  | { kind: "none" }
  | { kind: "text"; label: string }
  | { kind: "path" | "svg"; geometry: IconGeometry }
  | { kind: "simple"; slug: string }

type Dimensions = { width: number; height: number }

type Button = {
  text: string
  fontSize: number
  paddingX: number
  paddingY: number
  layout: "standard" | "split"
  bg: string
  iconBg: string
  fg: string
  border: string
  borderWidth: number
  radius: number
  divider: string
  iconColor: string
  iconSize: number
  icon: Icon
  scale: number
  rev: string
  fixedSize?: Dimensions
}

function readLabel(value: string, field: string): string {
  const text = value.normalize("NFC").trim()
  if (/[\p{Cc}\p{Cs}\uFFFD\uFFFE\uFFFF]/u.test(text) || !text || [...text].length > MAX_TEXT_LENGTH) {
    throw new InputError(`${field}: enter 1 to ${MAX_TEXT_LENGTH} valid characters on one line.`)
  }
  return text
}

const readFixedSize = (params: URLSearchParams): Dimensions | undefined => {
  const rawWidth = params.get("width")
  const rawHeight = params.get("height")
  if (rawWidth === null && rawHeight === null) return undefined
  if (rawWidth === null || rawHeight === null) throw new InputError("Provide width and height together.")

  const { min, max } = fixedSizeRange
  const width = decimal(rawWidth, "Width", min, max)
  const height = decimal(rawHeight, "Height", min, max)
  if (Math.ceil(width) * Math.ceil(height) > MAX_FIXED_SIZE_PIXELS) {
    throw new InputError(
      `Fixed Size: width × height must be at most ${MAX_FIXED_SIZE_PIXELS.toLocaleString("en-US")} pixels (rounded up on each axis).`,
    )
  }
  return { width, height }
}

export const parseButton = (params: URLSearchParams): Button => {
  const seen = new Set<string>()
  for (const key of params.keys()) {
    if (!known.has(key)) throw new InputError(`Unknown parameter: ${key}.`)
    if (seen.has(key)) throw new InputError(`Duplicate parameter: ${key}.`)
    seen.add(key)
  }

  const text = readLabel(params.get("text") ?? defaults.text, "text")
  const rev = params.get("rev") ?? defaults.rev
  if (!/^[a-zA-Z\d._-]{0,64}$/.test(rev)) {
    throw new InputError("rev: use up to 64 ASCII letters, digits, periods, hyphens, or underscores.")
  }
  const layout = params.get("layout") ?? defaults.layout
  if (layout !== "standard" && layout !== "split") {
    throw new InputError('layout: use "standard" or "split".')
  }
  const fixedSize = readFixedSize(params)

  const name = params.get("icon")
  const iconText = params.get("iconText")
  const path = params.get("iconPath")
  const box = params.get("iconViewBox")
  const source = params.get("iconSvg")
  if ([name, iconText, path, source].filter((value) => value !== null).length > 1) {
    throw new InputError("Choose one icon source: icon, iconText, iconPath, or iconSvg.")
  }
  if ((path === null) !== (box === null)) {
    throw new InputError("Provide iconPath and iconViewBox together.")
  }

  let icon: Icon = { kind: "mastra" }
  if (path !== null && box !== null) {
    icon = { kind: "path", geometry: pathIcon(pathData(path).value, viewBox(box)) }
  } else if (source !== null) {
    icon = { kind: "svg", geometry: parseSvg(decodeIcon(source)) }
  } else if (iconText !== null) {
    icon = { kind: "text", label: readLabel(iconText, "iconText") }
  } else if (name === "none") {
    icon = { kind: "none" }
  } else if (name !== null && name !== "mastra") {
    if (!isSimpleIconSlug(name)) {
      throw new InputError('icon: use "mastra", "none", or a lowercase Simple Icons slug.')
    }
    icon = { kind: "simple", slug: name }
  }

  function readColor(key: "bg" | "iconBg" | "fg" | "border" | "divider" | "iconColor") {
    return color(params.get(key) ?? defaults[key], key)
  }

  function readDecimal(key: keyof typeof decimalRanges) {
    const { min, max } = decimalRanges[key]
    return decimal(params.get(key) ?? String(defaults[key]), key, min, max)
  }

  return {
    text,
    rev,
    icon,
    layout,
    fontSize: readDecimal("fontSize"),
    paddingX: readDecimal("paddingX"),
    paddingY: readDecimal("paddingY"),
    bg: readColor("bg"),
    iconBg: readColor("iconBg"),
    fg: readColor("fg"),
    border: readColor("border"),
    divider: readColor("divider"),
    iconColor: readColor("iconColor"),
    iconSize: readDecimal("iconSize"),
    borderWidth: readDecimal("borderWidth"),
    radius: readDecimal("radius"),
    scale: readDecimal("scale"),
    fixedSize,
  }
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
const wide =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\p{Regional_Indicator}]/u

function measureLabel(text: string): number {
  let width = 0
  for (const { segment } of segmenter.segment(text)) {
    const letter = segment.normalize("NFD")[0]
    if (/^[ .,:;!iIl|'’`]/.test(letter)) width += 4
    else if (wide.test(segment)) width += 15
    else if (/^[MW@#%&QO]/.test(letter)) width += 11
    else if (/^[A-Z\d]/.test(letter)) width += 9
    else width += 8
  }
  return width
}

function svgNumber(value: number): number {
  return Number(value.toFixed(8))
}

const ICON_TEXT_X = 13
const PRESET_TEXT_X = 48
const PRESET_TEXT_Y = 22

const buttonLayout = (button: Button) => {
  const { icon, text, fontSize, paddingX, paddingY } = button
  const hasIcon = icon.kind !== "none"
  const split = hasIcon && button.layout === "split"
  const textScale = fontSize / defaults.fontSize
  const iconTextWidth = icon.kind === "text" ? svgNumber(measureLabel(icon.label) * textScale) : 0
  const dividerX = icon.kind === "text" ? ICON_TEXT_X + Math.ceil(iconTextWidth) + 10 : 38.5
  const outlined = text === defaults.text
  const textX = icon.kind === "text" ? dividerX + 10 : hasIcon ? PRESET_TEXT_X : 13
  const textY = svgNumber(PRESET_TEXT_Y + (fontSize - defaults.fontSize) / 3)
  const textWidth = svgNumber((outlined ? 50 : measureLabel(text)) * textScale)
  const width = svgNumber(textX + Math.ceil(textWidth) + (hasIcon ? 12 : 13) + 2 * paddingX)
  const height = svgNumber(34 + 2 * paddingY)
  return {
    hasIcon,
    split,
    fontSize,
    textScale,
    iconTextWidth,
    dividerX,
    outlined,
    textX,
    textY,
    textWidth,
    width,
    height,
  }
}

type ButtonLayout = ReturnType<typeof buttonLayout>

const renderSvgRoot = ({ fixedSize, scale }: Button, { width, height }: Dimensions): string => {
  const { width: outputWidth, height: outputHeight } = fixedSize ?? {
    width: svgNumber(width * scale),
    height: svgNumber(height * scale),
  }
  const fixedStyle = fixedSize
    ? ` style="width:${outputWidth}px!important;min-width:${outputWidth}px!important;max-width:${outputWidth}px!important;height:${outputHeight}px!important;min-height:${outputHeight}px!important;max-height:${outputHeight}px!important"`
    : ""
  return `<svg width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="${SVG_NS}"${fixedStyle}>`
}

const renderBackground = (button: Button, { width, height, split, dividerX }: ButtonLayout): string[] => {
  const inset = button.borderWidth / 2
  const bg = button.bg === defaults.bg ? "black" : button.bg
  const border = button.border === defaults.border ? "#18181B" : button.border
  const strokeWidth = button.borderWidth === defaults.borderWidth ? "" : ` stroke-width="${button.borderWidth}"`
  const rect = (fill: string) =>
    `<rect x="${inset}" y="${inset}" width="${svgNumber(width - button.borderWidth)}" height="${svgNumber(height - button.borderWidth)}" rx="${svgNumber(Math.max(0, button.radius - inset))}" fill="${fill}" stroke="${border}"${strokeWidth}/>`
  if (!split) return [rect(bg)]

  const boundary = svgNumber((dividerX + button.paddingX - inset) / (width - button.borderWidth))
  // Equal stop offsets create a hard edge inside the same rounded rectangle.
  return [
    `<defs><linearGradient id="split-background"><stop offset="${boundary}" stop-color="${button.iconBg}"/><stop offset="${boundary}" stop-color="${bg}"/></linearGradient></defs>`,
    rect("url(#split-background)"),
  ]
}

const labelSvg = (label: string, x: number, width: number, fill: string, { fontSize, textY }: ButtonLayout): string => {
  return `<text x="${x}" y="${textY}" fill="${fill}" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" direction="ltr" unicode-bidi="plaintext" xml:space="preserve" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(label)}</text>`
}

const renderButtonLabel = (button: Button, layout: ButtonLayout): string => {
  const { textX, textY, fontSize, textScale, textWidth, outlined } = layout
  const fill = button.fg === defaults.fg ? "#F2F2F2" : button.fg
  if (!outlined) return labelSvg(button.text, textX, textWidth, fill, layout)

  let transform = textX === PRESET_TEXT_X ? "" : ` transform="translate(${textX - PRESET_TEXT_X} 0)"`
  if (fontSize !== defaults.fontSize) {
    transform = ` transform="translate(${textX} ${textY}) scale(${svgNumber(textScale)}) translate(${-PRESET_TEXT_X} ${-PRESET_TEXT_Y})"`
  }
  return `<path d="${DEPLOY_PATH}" fill="${fill}"${transform}/>`
}

const renderButtonIcon = (button: Button, layout: ButtonLayout, simpleIcon?: IconGeometry): string[] => {
  const { icon, iconSize, iconColor } = button
  if (icon.kind === "none") return []
  const ink = iconColor === defaults.iconColor ? "#F2F2F2" : iconColor
  if (icon.kind === "text") return [labelSvg(icon.label, ICON_TEXT_X, layout.iconTextWidth, ink, layout)]

  let artwork: string[]
  if (icon.kind === "mastra") {
    artwork = MASTRA_PATHS.map((d) => `<path d="${d}" fill="${ink}"/>`)
  } else {
    const geometry = icon.kind === "simple" ? simpleIcon : icon.geometry
    if (!geometry) throw new Error("Missing Simple Icons geometry.")
    artwork = [renderIcon(geometry, ink)]
  }
  if (iconSize === defaults.iconSize) return artwork

  const factor = iconSize / defaults.iconSize
  const x = svgNumber(ICON_CENTER.x * (1 - factor))
  const y = svgNumber(ICON_CENTER.y * (1 - factor))
  return [`<g transform="translate(${x} ${y}) scale(${svgNumber(factor)})">`, ...artwork, "</g>"]
}

export const renderButton = (button: Button, simpleIcon?: IconGeometry): string => {
  const layout = buttonLayout(button)
  const { paddingX, paddingY } = button
  const lines = [renderSvgRoot(button, layout), ...renderBackground(button, layout)]
  const padded = paddingX !== 0 || paddingY !== 0
  if (padded) lines.push(`<g transform="translate(${paddingX} ${paddingY})">`)
  if (layout.hasIcon && !layout.split) {
    const divider = button.divider === defaults.divider ? "#3A3A3A" : button.divider
    lines.push(
      `<line x1="${layout.dividerX}" y1="5" x2="${layout.dividerX}" y2="29" stroke="${divider}" stroke-opacity="0.6"/>`,
    )
  }
  lines.push(...renderButtonIcon(button, layout, simpleIcon), renderButtonLabel(button, layout))
  if (padded) lines.push("</g>")
  lines.push("</svg>", "")
  return lines.join("\n")
}

function formatDecimal(value: number): string {
  // Within the allowed ranges, only numbers below 1e-6 use exponent notation.
  const [mantissa, exponent] = String(value).split("e-")
  if (!exponent) return mantissa
  return "0." + "0".repeat(Number(exponent) - 1) + mantissa.replace(".", "")
}

export function buttonUrl(origin: string, button: Button): URL | null {
  const url = new URL(BUTTON_PATH, origin)
  for (const key of keys) {
    if (key === "icon") {
      if (button.icon.kind === "none") url.searchParams.set(key, "none")
      if (button.icon.kind === "simple") url.searchParams.set(key, button.icon.slug)
    }
    if (key === "iconText" && button.icon.kind === "text") url.searchParams.set(key, button.icon.label)
    if ("geometry" in button.icon) {
      if (key === "iconPath" && button.icon.kind === "path") {
        url.searchParams.set(key, button.icon.geometry.root.children[0].attributes.d)
      }
      if (key === "iconViewBox" && button.icon.kind === "path") {
        url.searchParams.set(key, button.icon.geometry.viewBox.join(" "))
      }
      if (key === "iconSvg" && button.icon.kind === "svg") {
        const source = normalizedSvg(button.icon.geometry)
        if (byteLength(source) > MAX_URL_BYTES) return null
        url.searchParams.set(key, encodeIcon(source))
      }
    }
    if (key in defaults) {
      const field = key as keyof typeof defaults
      const value = button[field]
      if (value !== defaults[field]) {
        url.searchParams.set(key, typeof value === "number" ? formatDecimal(value) : value)
      }
    }
  }
  if (button.fixedSize) {
    url.searchParams.set("width", String(button.fixedSize.width))
    url.searchParams.set("height", String(button.fixedSize.height))
  }
  return byteLength(url.href) <= MAX_URL_BYTES ? url : null
}

export function markdown(label: string, image: string, destination: string): string {
  const alt = label.replace(/[\\\[\]`*_~!<>&]/g, "\\$&")
  const safeUrl = (url: string) => url.replaceAll("(", "%28").replaceAll(")", "%29")
  const markup = `![${alt}](${safeUrl(image)})`
  return destination ? `[${markup}](${safeUrl(destination)})` : markup
}
