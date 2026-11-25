import { SVGPathData } from "svg-pathdata"
import { InputError, MAX_PATH_LENGTH } from "./values.ts"

const SVG_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const COORD_LIMIT = 100_000
export const PATH_COMMAND_LIMIT = 512

export function svgNumber(raw: string, label: string, min = -COORD_LIMIT, max = COORD_LIMIT): number {
  const value = raw.trim()
  const number = Number(value)
  if (!SVG_NUMBER.test(value) || number < min || number > max) {
    throw new InputError(`${label}: invalid or out-of-range SVG number.`)
  }
  return number
}

export function numberList(value: string, label: string): number[] {
  return value
    .trim()
    .split(/\s*,\s*|\s+/)
    .map((part) => svgNumber(part, label))
}

export type ViewBox = [number, number, number, number]

export function viewBox(value: string): ViewBox {
  const numbers = numberList(value, "viewBox")
  const [x, y, width, height] = numbers
  if (numbers.length !== 4 || width < 0.001 || height < 0.001) {
    throw new InputError("viewBox: enter four numbers with width and height between 0.001 and 100000.")
  }
  return [x, y, width, height]
}

export function pathData(value: string): { value: string; commands: number } {
  if (value.length > MAX_PATH_LENGTH) {
    throw new InputError(`SVG path exceeds the ${MAX_PATH_LENGTH}-character limit.`)
  }
  const source = value.trim()
  if (!/^[Mm][MmLlHhVvCcSsQqTtAaZz\dEe.,+\-\s]*$/.test(source)) {
    throw new InputError("Invalid SVG path. Use SVG commands and start with M or m.")
  }
  try {
    const commands = SVGPathData.parse(source)
    if (commands.length === 0 || commands.length > PATH_COMMAND_LIMIT) throw new Error()
    for (const command of commands) {
      for (const part of Object.values(command)) {
        if (typeof part === "number" && (!Number.isFinite(part) || Math.abs(part) > COORD_LIMIT)) {
          throw new Error()
        }
      }
    }
    const normalized = SVGPathData.encode(commands)
    if (normalized.length > MAX_PATH_LENGTH) throw new Error()
    return { value: normalized, commands: commands.length }
  } catch {
    throw new InputError("Invalid SVG path or coordinate or command limit exceeded.")
  }
}

const transforms = new Map([
  ["matrix", [6]],
  ["translate", [1, 2]],
  ["scale", [1, 2]],
  ["rotate", [1, 3]],
  ["skewX", [1]],
  ["skewY", [1]],
])

export function transformList(value: string): string {
  const source = value.trim()
  const parts: string[] = []
  const token = /([a-zA-Z]+)\(([^()]*)\)(?:[\t\n\r ]*,?[\t\n\r ]*(?=[a-zA-Z])|$)/y
  while (token.lastIndex < source.length) {
    const match = token.exec(source)
    if (!match || parts.length >= 8) throw new InputError("Invalid or overly long SVG transform.")
    const [, name, args] = match
    const numbers = numberList(args, "transform")
    if (!transforms.get(name)?.includes(numbers.length)) {
      throw new InputError(`Unsupported SVG transform: ${name}.`)
    }
    parts.push(`${name}(${numbers.join(" ")})`)
  }
  if (parts.length === 0) throw new InputError("Empty SVG transform.")
  return parts.join(" ")
}
