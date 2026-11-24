import { SaxesParser } from "saxes"
import { numberList, pathData, PATH_COMMAND_LIMIT, svgNumber, transformList, viewBox } from "./geometry.ts"
import type { ViewBox } from "./geometry.ts"
import { byteLength, color, escapeXml, InputError, MAX_ICON_BYTES, SVG_NS } from "./values.ts"

type Shape = {
  name: string
  attributes: Record<string, string>
  children: Shape[]
}

export type IconGeometry = { viewBox: ViewBox; root: Shape }

const shapes = new Map<string, readonly string[]>([
  ["path", ["d"]],
  ["rect", ["x", "y", "width", "height", "rx", "ry"]],
  ["circle", ["cx", "cy", "r"]],
  ["ellipse", ["cx", "cy", "rx", "ry"]],
  ["line", ["x1", "y1", "x2", "y2"]],
  ["polyline", ["points"]],
  ["polygon", ["points"]],
])

const presentation = new Map([
  ["fill-rule", ["nonzero", "evenodd"]],
  ["stroke-linecap", ["butt", "round", "square"]],
  ["stroke-linejoin", ["miter", "round", "bevel"]],
])

const nonnegative = new Set(["width", "height", "r", "rx", "ry", "stroke-width"])
const opacities = new Set(["opacity", "fill-opacity", "stroke-opacity"])
const paintAttributes = new Set(["fill", "stroke", "color"])
const metadata = new Set(["title", "desc"])

export function parseSvg(source: string): IconGeometry {
  if (byteLength(source) > MAX_ICON_BYTES) throw new InputError("SVG exceeds the 16 KiB limit.")

  const parser = new SaxesParser({ xmlns: true })
  const stack: Shape[] = []
  let root: Shape | undefined
  let namespace = ""
  let box: ViewBox | undefined
  let nodes = 0
  let geometryCount = 0
  let commands = 0

  parser.on("error", () => { throw new InputError("Invalid SVG XML structure.") })
  parser.on("xmldecl", ({ encoding, version }) => {
    if (version !== "1.0" || (encoding && encoding.toLowerCase() !== "utf-8")) {
      throw new InputError("SVG: use UTF-8 encoded XML 1.0.")
    }
  })
  parser.on("doctype", () => { throw new InputError("SVG: DOCTYPE and custom entity declarations are unsupported.") })
  parser.on("processinginstruction", () => { throw new InputError("SVG: processing instructions are unsupported.") })

  function checkText(value: string) {
    const parent = stack.at(-1)
    if (value.trim() && !(parent && metadata.has(parent.name))) {
      throw new InputError("SVG: text is only allowed in title and desc.")
    }
  }
  parser.on("text", checkText)
  parser.on("cdata", checkText)

  parser.on("opentag", (tag) => {
    if (++nodes > 128 || stack.length >= 16) throw new InputError("SVG: element count or nesting depth limit exceeded.")
    const parent = stack.at(-1)
    const name = tag.local
    const properties = shapes.get(name)
    if (!parent) namespace = tag.uri
    if (tag.prefix || tag.uri !== namespace || (namespace !== "" && namespace !== SVG_NS)
      || (!parent ? name !== "svg" : !(
        (parent.name === "svg" || parent.name === "g") && (name === "g" || properties || metadata.has(name))
      ))) {
      throw new InputError(`SVG: unsupported element <${tag.name}>.`)
    }

    const attributes: Record<string, string> = Object.create(null)
    let explicitBox: ViewBox | undefined
    let width = 0
    let height = 0
    for (const { name: key, value } of Object.values(tag.attributes)) {
      if (!parent) {
        if (key === "xmlns" && value === SVG_NS) continue
        if (key === "role" && /^(img|presentation)$/.test(value)) continue
        if (key === "viewBox") {
          explicitBox = viewBox(value)
          continue
        }
        if (key === "width" || key === "height") {
          const pixels = svgNumber(value.trim().replace(/px$/, ""), key, 0.001)
          if (key === "width") width = pixels
          else height = pixels
          continue
        }
      }
      if (metadata.has(name)) throw new InputError(`SVG: unsupported attribute "${key}" on <${name}>.`)

      if (paintAttributes.has(key)) {
        const paint = value.trim()
        attributes[key] = key !== "color" && /^(none|currentColor)$/i.test(paint)
          ? (paint.toLowerCase() === "none" ? "none" : "currentColor")
          : color(paint, key)
      } else if (opacities.has(key)) {
        attributes[key] = String(svgNumber(value, key, 0, 1))
      } else if (key === "stroke-width" || key === "stroke-miterlimit") {
        attributes[key] = String(svgNumber(value, key, key === "stroke-miterlimit" ? 1 : 0))
      } else if (presentation.get(key)?.includes(value.trim())) {
        attributes[key] = value.trim()
      } else if (key === "transform") {
        attributes[key] = transformList(value)
      } else if (properties?.includes(key)) {
        if (key === "d") {
          const path = pathData(value)
          commands += path.commands
          attributes[key] = path.value
        } else if (key === "points") {
          const points = numberList(value, key)
          if (points.length < (name === "polygon" ? 6 : 4) || points.length % 2 !== 0) {
            throw new InputError(`SVG: invalid coordinate pairs on <${name}>.`)
          }
          commands += points.length / 2
          attributes[key] = points.join(" ")
        } else {
          attributes[key] = String(svgNumber(value, key, nonnegative.has(key) ? 0 : undefined))
        }
      } else {
        throw new InputError(`SVG: unsupported attribute "${key}" on <${name}>.`)
      }
    }

    if (commands > PATH_COMMAND_LIMIT) throw new InputError("SVG: total path command and point limit exceeded.")
    const required = ({
      path: ["d"], rect: ["width", "height"], circle: ["r"], ellipse: ["rx", "ry"],
      polygon: ["points"], polyline: ["points"],
    } as Record<string, string[]>)[name]
    if (required?.some((key) => !(key in attributes))) {
      throw new InputError(`SVG: required geometry attributes are missing on <${name}>.`)
    }

    const node: Shape = { name, attributes, children: [] }
    if (!parent) {
      root = node
      if (explicitBox) box = explicitBox
      else if (width && height) box = [0, 0, width, height]
      else throw new InputError("SVG: provide a viewBox or width and height in pixels.")
    } else if (!metadata.has(name)) {
      parent.children.push(node)
    }
    if (properties) geometryCount++
    stack.push(node)
  })
  parser.on("closetag", () => { stack.pop() })
  parser.write(source).close()

  if (!root || !box || !geometryCount) throw new InputError("SVG: include at least one supported shape.")
  return { viewBox: box, root }
}

export function pathIcon(d: string, box: ViewBox): IconGeometry {
  return {
    viewBox: box,
    root: { name: "svg", attributes: {}, children: [{ name: "path", attributes: { d }, children: [] }] },
  }
}

function serializeAttributes(attributes: Shape["attributes"]): string {
  return Object.keys(attributes).sort().map((name) => ` ${name}="${escapeXml(attributes[name])}"`).join("")
}

function serializeNode(node: Shape): string {
  const attributes = serializeAttributes(node.attributes)
  if (node.children.length === 0) return `<${node.name}${attributes}/>`
  return `<${node.name}${attributes}>${node.children.map(serializeNode).join("")}</${node.name}>`
}

export function normalizedSvg(icon: IconGeometry): string {
  return `<svg xmlns="${SVG_NS}" viewBox="${icon.viewBox.join(" ")}"${serializeAttributes(icon.root.attributes)}>${icon.root.children.map(serializeNode).join("")}</svg>`
}

function isMonochrome(root: Shape): boolean {
  const paints = new Set<string>()

  function visit(node: Shape, fill: string, stroke: string, current: string) {
    fill = node.attributes.fill ?? fill
    stroke = node.attributes.stroke ?? stroke
    current = node.attributes.color ?? current
    if (shapes.has(node.name)) {
      for (const paint of node.name === "line" ? [stroke] : [fill, stroke]) {
        const resolved = paint === "currentColor" ? current : paint
        if (resolved !== "none" && !(resolved.length === 9 && resolved.endsWith("00"))) {
          paints.add(resolved.slice(0, 7))
        }
      }
    }
    for (const child of node.children) visit(child, fill, stroke, current)
  }

  visit(root, "#000000", "none", "#000000")
  return paints.size <= 1
}

function recolor(node: Shape, ink: string, inheritedColor: string): Shape {
  const attributes = { ...node.attributes }
  const current = attributes.color ?? inheritedColor
  for (const key of ["fill", "stroke"]) {
    const paint = attributes[key] === "currentColor" ? current : attributes[key]
    if (paint === undefined || paint === "none") continue
    if (paint.length === 9) {
      const alpha = Number.parseInt(paint.slice(7), 16)
      const inkAlpha = ink.length === 9 ? Number.parseInt(ink.slice(7), 16) : 255
      attributes[key] = ink.slice(0, 7) + Math.round(alpha * inkAlpha / 255).toString(16).padStart(2, "0")
    } else {
      attributes[key] = ink
    }
  }
  return { ...node, attributes, children: node.children.map((child) => recolor(child, ink, current)) }
}

export function renderIcon(icon: IconGeometry, ink: string): string {
  const monochrome = isMonochrome(icon.root)
  const root = monochrome ? recolor(icon.root, ink, "#000000") : icon.root
  // Clip and center the imported viewBox within the 20 × 20 icon area.
  const group = serializeNode({ ...root, name: "g" })
  return `<svg x="10.67745" y="7" width="20" height="20" viewBox="${icon.viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet" overflow="hidden" fill="${monochrome ? ink : "#000000"}" color="${ink}">${group}</svg>`
}
