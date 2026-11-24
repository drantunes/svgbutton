import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { buttonUrl, markdown, parseButton, renderButton } from "../src/button.ts"
import { normalizedSvg, parseSvg } from "../src/icon.ts"
import { DEPLOY_PATH, MASTRA_PATHS } from "../src/preset.ts"
import { decodeIcon, encodeIcon, InputError } from "../src/values.ts"
import { invalidIcons, largeIcon, monoIcon, presetHash } from "./fixtures.ts"

const render = (options: Record<string, string> = {}) => renderButton(parseButton(new URLSearchParams(options)))
const origin = "https://button.example"

test("default preset is byte-for-byte identical to the supplied SVG", () => {
  const svg = render()
  assert.equal(createHash("sha256").update(svg).digest("hex"), presetHash)
  assert.match(svg, /width="110" height="34" viewBox="0 0 110 34"/)
})

test("scale changes dimensions and preserves the viewBox", () => {
  assert.match(render({ scale: "0.5" }), /width="55" height="17" viewBox="0 0 110 34"/)
  assert.match(render({ scale: "2.0" }), /width="220" height="68" viewBox="0 0 110 34"/)
  assert.match(render({ scale: "1.25" }), /width="137.5" height="42.5" viewBox="0 0 110 34"/)
  for (const scale of ["0", "0.49", "3.01", "Infinity", "1e0"]) assert.throws(() => render({ scale }), /scale/)
})

test("long Unicode labels grow the button and escape XML characters", () => {
  const text = 'Café launch & résumé <production> "right now" 🧪'
  const svg = render({ text })
  const width = Number(svg.match(/^<svg width="(\d+)"/)?.[1])
  assert.ok(width > 250)
  assert.match(svg, /Café launch &amp; résumé &lt;production&gt; &quot;right now&quot; 🧪/)
  assert.equal(render({ text: text.normalize("NFD") }), svg)
  assert.throws(() => render({ text: "x".repeat(121) }), /text/)
})

test("colors, border width, and radius are independent", () => {
  const svg = render({ bg: "white", fg: "red", iconColor: "blue", border: "teal", borderWidth: "2", radius: "8", divider: "orange" })
  assert.ok(svg.includes(`d="${DEPLOY_PATH}" fill="#ff0000"`))
  assert.ok(MASTRA_PATHS.every((d) => svg.includes(`d="${d}" fill="#0000ff"`)))
  assert.match(svg, /rx="7" fill="#ffffff" stroke="#008080" stroke-width="2"/)
  assert.match(svg, /stroke="#ffa500" stroke-opacity="0.6"/)
  assert.throws(() => render({ fg: "url(https://example.org/p)" }), /fg/)
})

test("icon size scales around the icon center without moving the divider or label", () => {
  const size = { iconSize: "10" }
  const svg = render(size)
  assert.match(svg, /width="110" height="34"/)
  assert.match(svg, /<line x1="38.5"[^>]*\/>\n<g transform="translate\(10.338725 8.5\) scale\(0.5\)">/)
  assert.ok(svg.includes(`</g>\n<path d="${DEPLOY_PATH}"`))
  assert.match(render({ ...size, iconPath: "M0 0L4 2Z", iconViewBox: "0 0 4 2" }),
    /scale\(0.5\)">\n<svg x="10.67745" y="7" width="20" height="20"/)
  assert.equal(render({ ...size, icon: "none" }), render({ icon: "none" }))
  assert.equal(render({ iconSize: "20.0" }), render())
  assert.throws(() => render({ iconSize: "7.9" }), /iconSize/)
  assert.throws(() => render({ iconSize: "24.1" }), /iconSize/)
})

test("iconless and path layouts work and icon sources are mutually exclusive", () => {
  assert.doesNotMatch(render({ icon: "none" }), /<line/)
  const svg = render({ iconPath: "M 0 0 L 4 2 Z", iconViewBox: "0,0,4,2", iconColor: "green" })
  assert.match(svg, /viewBox="0 0 4 2" preserveAspectRatio="xMidYMid meet"/)
  assert.match(svg, /fill="#008000"/)
  const invalidOptions: Record<string, string>[] = [
    { icon: "none", iconPath: "M0 0Z" },
    { iconPath: "M0 0Z", iconSvg: "abc" },
    { iconViewBox: "0 0 1 1" },
    { iconPath: "M0", iconViewBox: "0 0 4 2" },
    { iconPath: "M1e999 0L1 1", iconViewBox: "0 0 4 2" },
  ]
  for (const options of invalidOptions) assert.throws(() => render(options))
})

test("UTF-8 imports are normalized and recolored while preserving none", () => {
  const encoded = encodeIcon(monoIcon)
  assert.equal(encoded, Buffer.from(monoIcon).toString("base64url"))
  assert.equal(decodeIcon(encoded), monoIcon)
  const normalized = normalizedSvg(parseSvg(monoIcon))
  assert.equal(normalizedSvg(parseSvg(normalized)), normalized)
  assert.doesNotMatch(normalized, /<title/)
  const svg = render({ iconSvg: encoded, iconColor: "#0f0" })
  assert.match(svg, /<g fill="none" stroke="#00ff00" transform="translate\(1 1\)"/)
  assert.match(svg, /<circle cx="10" cy="4" fill="#00ff00" r="2" stroke="none"/)

  const multi = encodeIcon('<svg viewBox="0 0 4 4"><circle r="1" fill="red"/><circle r="1" fill="blue"/></svg>')
  const multiSvg = render({ iconSvg: multi, iconColor: "#0f0" })
  assert.match(multiSvg, /<circle fill="#ff0000" r="1"\/><circle fill="#0000ff" r="1"\/>/)
})

test("multicolor SVGs preserve currentColor with and without an explicit color", () => {
  const shapes = '<circle r="1" fill="currentColor"/><circle r="1" fill="red"/>'
  const implicit = encodeIcon(`<svg viewBox="0 0 4 4">${shapes}</svg>`)
  const explicit = encodeIcon(`<svg viewBox="0 0 4 4" color="blue">${shapes}</svg>`)
  for (const iconSvg of [implicit, explicit]) {
    assert.equal(render({ iconSvg, iconColor: "green" }), render({ iconSvg, iconColor: "white" }))
  }
  assert.match(render({ iconSvg: implicit }), /color="#000000"><g><circle fill="currentColor"/)
  assert.match(render({ iconSvg: explicit }), /<g color="#0000ff"><circle fill="currentColor"/)
})

test("SVG root dimensions matter only when the viewBox is absent", () => {
  const shape = '<circle r="1"/>'
  const withBox = parseSvg(`<svg width="1em" viewBox="0 0 24 12" height="100%">${shape}</svg>`)
  assert.deepEqual(withBox, parseSvg(`<svg viewBox="0 0 24 12">${shape}</svg>`))
  assert.deepEqual(withBox, parseSvg(`<svg width="24px" height="12">${shape}</svg>`))
  assert.throws(() => parseSvg(`<svg width="1em" height="12">${shape}</svg>`), /width/)
  assert.throws(() => parseSvg(`<svg width="24" height="100%">${shape}</svg>`), /height/)
  assert.throws(() => parseSvg(`<svg width="24" height="12" viewBox="0 0 0 12">${shape}</svg>`), /viewBox/)
})

test("validation rejects invalid Base64URL, invalid XML, and unsupported content", () => {
  for (const icon of invalidIcons) assert.throws(() => render({ iconSvg: encodeIcon(icon) }), InputError)
  for (const encoded of ["***", "abcd=", "_w", "Y", "YR"]) assert.throws(() => decodeIcon(encoded), /Base64URL/)
})

test("URL generation orders parameters, omits defaults, and separates the destination", () => {
  const button = parseButton(new URLSearchParams("rev=2&scale=1.0&fg=%23ABC&icon=mastra&bg=black&text=A%CC%81%26%5Bx%5D"))
  const url = buttonUrl(origin, button)
  assert.equal(url?.href, `${origin}/v1/button.svg?text=%C3%81%26%5Bx%5D&fg=%23aabbcc&rev=2`)
  assert.equal(buttonUrl(origin, parseButton(new URLSearchParams("scale=1")))?.href, `${origin}/v1/button.svg`)
  assert.equal(markdown(button.text, url!.href, "https://example.org/deploy(a)"),
    `[![Á\\&\\[x\\]](${url!.href})](https://example.org/deploy%28a%29)`)
  const iconButton = parseButton(new URLSearchParams({ iconSvg: encodeIcon(monoIcon) }))
  const iconUrl = buttonUrl(origin, iconButton)!
  assert.equal(renderButton(parseButton(iconUrl.searchParams)), renderButton(iconButton))
  const simpleButton = parseButton(new URLSearchParams("scale=1.0&icon=github&iconSize=12.0&text=GitHub"))
  assert.equal(buttonUrl(origin, simpleButton)?.href, `${origin}/v1/button.svg?text=GitHub&iconSize=12&icon=github`)
})

test("local rendering remains available when the SVG exceeds the URL limit", () => {
  const button = parseButton(new URLSearchParams({ iconSvg: encodeIcon(largeIcon) }))
  assert.equal(buttonUrl(origin, button), null)
  assert.match(renderButton(button), /<polyline/)
})
