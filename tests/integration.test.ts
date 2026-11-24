import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { after, before, test } from "node:test"
import { createTestHarness } from "wrangler"
import { buttonUrl, parseButton, renderButton } from "../src/button.ts"
import { BUTTON_PATH, encodeIcon, MAX_URL_BYTES } from "../src/values.ts"
import { invalidIcons, largeIcon, monoIcon, presetHash } from "./fixtures.ts"

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] })
before(() => server.listen())
after(() => server.close())

function path(options: Record<string, string>): string {
  return `${BUTTON_PATH}?${new URLSearchParams(options)}`
}

test("GET serves the preset and HEAD returns matching headers with no body", async () => {
  const get = await server.fetch(BUTTON_PATH)
  const head = await server.fetch(BUTTON_PATH, { method: "HEAD" })
  assert.equal(get.status, 200)
  assert.equal(head.status, 200)
  assert.equal(get.headers.get("content-type"), "image/svg+xml; charset=utf-8")
  assert.equal(get.headers.get("cache-control"), "public, max-age=86400")
  assert.equal(get.headers.get("content-security-policy"), "default-src 'none'; sandbox")
  assert.equal(get.headers.get("x-content-type-options"), "nosniff")
  assert.equal(get.headers.get("referrer-policy"), "no-referrer")
  for (const header of ["content-type", "cache-control", "content-security-policy", "x-content-type-options", "referrer-policy"]) {
    assert.equal(head.headers.get(header), get.headers.get(header))
  }
  assert.equal(head.body, null)
  assert.equal(await head.text(), "")
  assert.equal(createHash("sha256").update(await get.text()).digest("hex"), presetHash)
})

test("GET renders scale, a Unicode label, and a Base64URL icon with the requested colors", async () => {
  const options = new URLSearchParams({
    text: "Café launch & résumé for the production release",
    fg: "orange",
    iconColor: "blue",
    iconSvg: encodeIcon(monoIcon),
    scale: "2",
    rev: "v2",
  })
  const button = parseButton(options)
  const url = buttonUrl("https://button.example", button)!
  const response = await server.fetch(url.href)
  assert.equal(response.status, 200)
  const svg = await response.text()
  assert.equal(svg, renderButton(button))
  assert.match(svg, /height="68"/)
  assert.match(svg, /Café launch &amp; résumé for the production release/)
  assert.match(svg, /<text .*fill="#ffa500"/)
  assert.match(svg, /<g fill="none" stroke="#0000ff"/)
})

test("the generated button URL round-trips tiny decimal values through the API", async () => {
  const options = { borderWidth: "0.0000001", radius: "0.00000025" }
  const button = parseButton(new URLSearchParams(options))
  const url = buttonUrl("https://button.example", button)!
  assert.deepEqual(Object.fromEntries(url.searchParams), options)

  const response = await server.fetch(url.href)
  assert.equal(response.status, 200)
  assert.equal(await response.text(), renderButton(button))
})

test("the Worker revalidates API inputs and sends no-store on errors", async () => {
  const options: Record<string, string>[] = [
    ...invalidIcons.map((svg) => ({ iconSvg: encodeIcon(svg) })),
    { iconSvg: "***" },
    { iconPath: 'M0 0" onload="x', iconViewBox: "0 0 1 1" },
    { icon: "none", iconSvg: encodeIcon(monoIcon) },
    { icon: "github", iconSvg: encodeIcon(monoIcon) },
    { scale: "0.25" },
    { fg: "url(https://example.org/icon.svg)" },
    { unexpected: "true" },
  ]
  for (const params of options) {
    const error = await server.fetch(path(params))
    assert.equal(error.status, 400, await error.clone().text())
    assert.equal(error.headers.get("cache-control"), "no-store")
    assert.equal(error.headers.get("content-type"), "text/plain; charset=utf-8")
  }
  assert.equal((await server.fetch(`${BUTTON_PATH}?scale=1&scale=2`)).status, 400)
  const errorHead = await server.fetch(path({ scale: "9" }), { method: "HEAD" })
  assert.equal(errorHead.status, 400)
  assert.equal(await errorHead.text(), "")
})

test("the URL limit counts the full URL in bytes and returns 414 when exceeded", async () => {
  const base = new URL(path({ iconSvg: encodeIcon(largeIcon) }), "https://button.example")
  const response = await server.fetch(base.href)
  assert.equal(response.status, 414)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.match(await response.text(), /8192 bytes/)
  const { url } = await server.listen()
  const prefix = `${url.origin}${BUTTON_PATH}?text=`
  const boundary = prefix + "x".repeat(MAX_URL_BYTES - prefix.length)
  assert.equal((await fetch(boundary)).status, 400)
  assert.equal((await fetch(boundary + "x")).status, 414)
})

test("the local Worker serves the editor and its assets and handles routing", async () => {
  const index = await server.fetch("/")
  assert.equal(index.status, 200)
  assert.equal(index.headers.get("cache-control"), "no-store")
  assert.equal(index.headers.get("content-type"), "text/html; charset=utf-8")
  assert.match(index.headers.get("content-security-policy") ?? "", /script-src 'self'.*img-src 'self' blob:/)
  const markup = await index.text()
  assert.match(markup, /^<!doctype html>/)
  assert.match(markup, /<title>SVG Button · GitHub README buttons<\/title>/)
  assert.ok(markup.includes(`src="${BUTTON_PATH}"`))
  assert.match(markup, /id="theme-toggle"[^>]*aria-label="Dark mode"[^>]*><svg class="theme-icon theme-icon-light"/)
  assert.match(markup, /class="theme-icon theme-icon-dark"/)
  assert.match(markup, /name="iconSize" type="number" min="8" max="24" step="any" value="20"/)
  assert.match(markup, /<option value="simple-icons">Simple Icons<\/option>/)
  assert.match(index.headers.get("content-security-policy") ?? "", /connect-src 'self' https:/)
  assert.match(markup, /Destination URL[\s\S]*Copy Markdown[\s\S]*Copy SVG URL[\s\S]*Download SVG/)
  const assets = [
    ["/editor.js", "text/javascript; charset=utf-8"],
    ["/editor.css", "text/css; charset=utf-8"],
  ]
  for (const [resource, type] of assets) {
    const response = await server.fetch(resource)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), type)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.ok(markup.includes(`"${resource}"`))
  }
  for (const missing of ["/missing", `${BUTTON_PATH}/`, "/v1/%62utton.svg"]) {
    const response = await server.fetch(missing)
    assert.equal(response.status, 404)
    assert.equal(response.headers.get("cache-control"), "no-store")
  }
  for (const route of [BUTTON_PATH, "/", ...assets.map(([path]) => path)]) {
    const rejected = await server.fetch(route, { method: "POST" })
    assert.equal(rejected.status, 405)
    assert.equal(rejected.headers.get("allow"), "GET, HEAD")
    assert.equal(rejected.headers.get("cache-control"), "no-store")
  }
})

test("a Simple Icons slug produces the same cacheable button as an embedded SVG", async () => {
  const catalog = await server.fetch("/simple-icons/catalog.json")
  assert.equal(catalog.status, 200)
  const brands = await catalog.json() as [slug: string, title: string][]
  assert.ok(brands.some(([slug, title]) => slug === "github" && title === "GitHub"))

  const icon = await server.fetch("/simple-icons/github.svg")
  assert.equal(icon.status, 200)
  const svg = await icon.text()
  const options = { text: "GitHub", iconColor: "#78cfff", iconSize: "10" }
  const shortPath = path({ ...options, icon: "github" })
  const embedded = await server.fetch(path({ ...options, iconSvg: encodeIcon(svg) }))
  const response = await server.fetch(shortPath)
  assert.equal(embedded.status, 200)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400")
  const rendered = await response.text()
  assert.match(rendered, /fill="#78cfff"/)
  assert.match(rendered, /<g transform="translate\(10.338725 8.5\) scale\(0.5\)">/)
  assert.equal(rendered, await embedded.text())

  const head = await server.fetch(shortPath, { method: "HEAD" })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get("cache-control"), "public, max-age=86400")
  assert.equal(head.body, null)

  for (const slug of ["does-not-exist-9999", "../catalog", "https://example.com/icon.svg"]) {
    const invalid = await server.fetch(path({ icon: slug }))
    assert.equal(invalid.status, 400)
    assert.equal(invalid.headers.get("cache-control"), "no-store")
    assert.match(await invalid.text(), /Simple Icons slug/)
  }
})
