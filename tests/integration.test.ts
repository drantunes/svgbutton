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
  assert.equal(head.headers.get("content-type"), get.headers.get("content-type"))
  assert.equal(head.headers.get("cache-control"), get.headers.get("cache-control"))
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

test("the Worker revalidates API inputs and sends no-store on errors", async () => {
  const options: Record<string, string>[] = [
    ...invalidIcons.map((svg) => ({ iconSvg: encodeIcon(svg) })),
    { iconSvg: "***" },
    { iconPath: 'M0 0" onload="x', iconViewBox: "0 0 1 1" },
    { icon: "none", iconSvg: encodeIcon(monoIcon) },
    { scale: "0.25" },
    { fg: "url(https://example.org/icon.svg)" },
  ]
  for (const params of options) {
    const error = await server.fetch(path(params))
    assert.equal(error.status, 400, await error.clone().text())
    assert.equal(error.headers.get("cache-control"), "no-store")
    assert.match(error.headers.get("content-type") ?? "", /^text\/plain/)
  }
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
  assert.match(await index.text(), /Destination URL[\s\S]*Copy Markdown[\s\S]*Copy SVG URL[\s\S]*Download SVG/)
  for (const resource of ["/editor.js", "/editor.css"]) assert.equal((await server.fetch(resource)).status, 200)
  assert.equal((await server.fetch("/missing")).status, 404)
  const rejected = await server.fetch(BUTTON_PATH, { method: "POST" })
  assert.equal(rejected.status, 405)
  assert.equal(rejected.headers.get("allow"), "GET, HEAD")
  assert.equal(rejected.headers.get("cache-control"), "no-store")
})
