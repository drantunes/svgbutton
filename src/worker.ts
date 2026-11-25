import { Hono } from "hono"
import { parseButton, renderButton } from "./button.ts"
import { editorHtml } from "./editor-page.tsx"
import { parseSvg, type IconGeometry } from "./icon.ts"
import { BUTTON_PATH, byteLength, InputError, MAX_URL_BYTES, simpleIconAssetPath } from "./values.ts"
import choicesStyles from "choices.js/public/assets/styles/choices.min.css"
import styles from "./editor.css"
import favicon from "./favicon.svg"
import script from "../dist/editor.js.txt"

const editorPolicy =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self' https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const svgPolicy = "default-src 'none'; sandbox"

const app = new Hono<{ Bindings: { ASSETS: { fetch(request: Request): Promise<Response> } } }>({
  // Keep percent-encoded paths distinct from registered routes.
  getPath: (request) => new URL(request.url).pathname,
})

app.use("*", async (c, next) => {
  c.header("Content-Type", "text/plain; charset=utf-8")
  c.header("Cache-Control", "no-store")
  c.header("X-Content-Type-Options", "nosniff")
  c.header("Referrer-Policy", "no-referrer")
  await next()
})

app.get("/", (c) => {
  c.header("Content-Security-Policy", editorPolicy)
  return c.html(editorHtml, 200, { "Content-Type": "text/html; charset=utf-8" })
})

app.get("/editor.css", (c) => c.body(choicesStyles + "\n" + styles, 200, { "Content-Type": "text/css; charset=utf-8" }))
app.get("/editor.js", (c) => c.body(script, 200, { "Content-Type": "text/javascript; charset=utf-8" }))
app.get("/favicon.svg", (c) =>
  c.body(favicon, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Security-Policy": svgPolicy,
  }),
)

app.get(BUTTON_PATH, async (c) => {
  const requestUrl = c.req.url
  if (byteLength(requestUrl) > MAX_URL_BYTES) {
    return c.body("The SVG URL exceeds 8192 bytes. Download the SVG and add it to your repository.", 414)
  }

  const button = parseButton(new URL(requestUrl).searchParams)
  let simpleIcon: IconGeometry | undefined
  if (button.icon.kind === "simple") {
    const { slug } = button.icon
    const assetUrl = new URL(simpleIconAssetPath(slug), requestUrl)
    const asset = await c.env.ASSETS.fetch(new Request(assetUrl))
    if (asset.status === 404) throw new InputError(`icon: unknown Simple Icons slug "${slug}".`)
    if (!asset.ok) throw new Error(`Could not load Simple Icons asset "${slug}" (HTTP ${asset.status}).`)
    simpleIcon = parseSvg(await asset.text())
  }

  const svg = renderButton(button, simpleIcon)
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "Content-Security-Policy": svgPolicy,
  })
})

app.on("ALL", ["/", "/editor.css", "/editor.js", "/favicon.svg", BUTTON_PATH], (c) => {
  return c.body("Method not allowed.", 405, { Allow: "GET, HEAD" })
})

app.notFound((c) => c.body("Route not found.", 404))

app.onError((error, c) => {
  if (error instanceof InputError) return c.body(error.message, 400)
  console.error(error)
  return c.body("Could not render the button.", 500)
})

export default app
