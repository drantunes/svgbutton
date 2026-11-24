import { pathData, viewBox } from "./geometry.ts"
import { normalizedSvg, parseSvg, pathIcon, renderIcon } from "./icon.ts"
import type { IconGeometry } from "./icon.ts"
import { DEPLOY_PATH, MASTRA_PATHS } from "./preset.ts"
import {
  BUTTON_PATH, byteLength, color, decimal, decodeIcon, defaults, encodeIcon, escapeXml,
  InputError, isSimpleIconSlug, MAX_TEXT_LENGTH, MAX_URL_BYTES, SVG_NS,
} from "./values.ts"

const keys = [
  "text", "bg", "fg", "border", "borderWidth", "radius", "divider", "iconColor",
  "icon", "iconPath", "iconViewBox", "iconSvg", "scale", "rev",
] as const
const known = new Set<string>(keys)

type Icon =
  | { kind: "mastra" | "none" }
  | { kind: "path" | "svg"; geometry: IconGeometry }
  | { kind: "simple"; slug: string }

type Button = {
  text: string
  bg: string
  fg: string
  border: string
  borderWidth: number
  radius: number
  divider: string
  iconColor: string
  icon: Icon
  scale: number
  rev: string
}

export function parseButton(params: URLSearchParams): Button {
  const seen = new Set<string>()
  for (const key of params.keys()) {
    if (!known.has(key)) throw new InputError(`Unknown parameter: ${key}.`)
    if (seen.has(key)) throw new InputError(`Duplicate parameter: ${key}.`)
    seen.add(key)
  }

  const text = (params.get("text") ?? defaults.text).normalize("NFC").trim()
  if (/[\p{Cc}\p{Cs}\uFFFD\uFFFE\uFFFF]/u.test(text) || !text || [...text].length > MAX_TEXT_LENGTH) {
    throw new InputError(`text: enter 1 to ${MAX_TEXT_LENGTH} valid characters on one line.`)
  }
  const rev = params.get("rev") ?? defaults.rev
  if (!/^[a-zA-Z\d._-]{0,64}$/.test(rev)) {
    throw new InputError("rev: use up to 64 ASCII letters, digits, periods, hyphens, or underscores.")
  }

  const name = params.get("icon")
  const path = params.get("iconPath")
  const box = params.get("iconViewBox")
  const source = params.get("iconSvg")
  if ([name, path, source].filter((value) => value !== null).length > 1) {
    throw new InputError("Choose one icon source: icon, iconPath, or iconSvg.")
  }
  if ((path === null) !== (box === null)) {
    throw new InputError("Provide iconPath and iconViewBox together.")
  }

  let icon: Icon = { kind: "mastra" }
  if (path !== null && box !== null) {
    icon = { kind: "path", geometry: pathIcon(pathData(path).value, viewBox(box)) }
  } else if (source !== null) {
    icon = { kind: "svg", geometry: parseSvg(decodeIcon(source)) }
  } else if (name === "none") {
    icon = { kind: "none" }
  } else if (name !== null && name !== "mastra") {
    if (!isSimpleIconSlug(name)) {
      throw new InputError('icon: use "mastra", "none", or a lowercase Simple Icons slug.')
    }
    icon = { kind: "simple", slug: name }
  }

  function readColor(key: "bg" | "fg" | "border" | "divider" | "iconColor") {
    return color(params.get(key) ?? defaults[key], key)
  }

  return {
    text, rev, icon,
    bg: readColor("bg"),
    fg: readColor("fg"),
    border: readColor("border"),
    divider: readColor("divider"),
    iconColor: readColor("iconColor"),
    borderWidth: decimal(params.get("borderWidth") ?? String(defaults.borderWidth), "borderWidth", 0, 8),
    radius: decimal(params.get("radius") ?? String(defaults.radius), "radius", 0, 17),
    scale: decimal(params.get("scale") ?? String(defaults.scale), "scale", 0.5, 3),
  }
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
const wide = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\p{Regional_Indicator}]/u

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

export function renderButton(button: Button, simpleIcon?: IconGeometry): string {
  const { icon, text, scale } = button
  const hasIcon = icon.kind !== "none"
  const outlined = text === defaults.text
  const textX = hasIcon ? 48 : 13
  const textWidth = outlined ? 50 : measureLabel(text)
  const width = textX + textWidth + (hasIcon ? 12 : 13)
  const height = 34
  const inset = button.borderWidth / 2
  const bg = button.bg === defaults.bg ? "black" : button.bg
  const border = button.border === defaults.border ? "#18181B" : button.border
  const divider = button.divider === defaults.divider ? "#3A3A3A" : button.divider
  const fg = button.fg === defaults.fg ? "#F2F2F2" : button.fg
  const ink = button.iconColor === defaults.iconColor ? "#F2F2F2" : button.iconColor

  const lines = [
    `<svg width="${svgNumber(width * scale)}" height="${svgNumber(height * scale)}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="${SVG_NS}">`,
    `<rect x="${inset}" y="${inset}" width="${svgNumber(width - button.borderWidth)}" height="${svgNumber(height - button.borderWidth)}" rx="${svgNumber(Math.max(0, button.radius - inset))}" fill="${bg}" stroke="${border}"${button.borderWidth === 1 ? "" : ` stroke-width="${button.borderWidth}"`}/>`,
  ]
  if (hasIcon) {
    lines.push(`<line x1="38.5" y1="5" x2="38.5" y2="29" stroke="${divider}" stroke-opacity="0.6"/>`)
  }
  if (icon.kind === "mastra") {
    for (const d of MASTRA_PATHS) lines.push(`<path d="${d}" fill="${ink}"/>`)
  } else if (icon.kind === "simple") {
    if (!simpleIcon) throw new Error("Missing Simple Icons geometry.")
    lines.push(renderIcon(simpleIcon, ink))
  } else if ("geometry" in icon) {
    lines.push(renderIcon(icon.geometry, ink))
  }

  if (outlined) {
    lines.push(`<path d="${DEPLOY_PATH}" fill="${fg}"${hasIcon ? "" : ' transform="translate(-35 0)"'}/>`)
  } else {
    lines.push(`<text x="${textX}" y="22" fill="${fg}" font-family="system-ui, sans-serif" font-size="15" font-weight="600" direction="ltr" unicode-bidi="plaintext" xml:space="preserve" textLength="${textWidth}" lengthAdjust="spacingAndGlyphs">${escapeXml(text)}</text>`)
  }
  lines.push("</svg>", "")
  return lines.join("\n")
}

export function buttonUrl(origin: string, button: Button): URL | null {
  const url = new URL(BUTTON_PATH, origin)
  for (const key of keys) {
    if (key === "icon") {
      if (button.icon.kind === "none") url.searchParams.set(key, "none")
      if (button.icon.kind === "simple") url.searchParams.set(key, button.icon.slug)
    }
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
      if (button[field] !== defaults[field]) url.searchParams.set(key, String(button[field]))
    }
  }
  return byteLength(url.href) <= MAX_URL_BYTES ? url : null
}

export function markdown(label: string, image: string, destination: string): string {
  const alt = label.replace(/[\\\[\]`*_~!<>&]/g, "\\$&")
  const safeUrl = (url: string) => url.replaceAll("(", "%28").replaceAll(")", "%29")
  const markup = `![${alt}](${safeUrl(image)})`
  return destination ? `[${markup}](${safeUrl(destination)})` : markup
}
