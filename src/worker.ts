import { parseButton, renderButton } from "./button.ts"
import { BUTTON_PATH, byteLength, InputError, MAX_URL_BYTES } from "./values.ts"
import editor from "./editor.html"
import styles from "./editor.css"
import script from "../dist/editor.js.txt"

const editorPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const svgPolicy = "default-src 'none'; sandbox"

const pages = new Map([
  ["/", { body: editor, type: "text/html; charset=utf-8", policy: editorPolicy }],
  ["/editor.css", { body: styles, type: "text/css; charset=utf-8" }],
  ["/editor.js", { body: script, type: "text/javascript; charset=utf-8" }],
])

export default {
  fetch(request: Request): Response {
    const head = request.method === "HEAD"
    const url = new URL(request.url)

    function send(body: string, status: number, headers: Record<string, string>) {
      return new Response(head ? null : body, {
        status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          ...headers,
        },
      })
    }

    const page = pages.get(url.pathname)
    if (!page && url.pathname !== BUTTON_PATH) return send("Route not found.", 404, {})
    if (!head && request.method !== "GET") {
      return send("Method not allowed.", 405, { Allow: "GET, HEAD" })
    }
    if (page) {
      return send(page.body, 200, {
        "Content-Type": page.type,
        ...(page.policy ? { "Content-Security-Policy": page.policy } : {}),
      })
    }
    if (byteLength(request.url) > MAX_URL_BYTES) {
      return send("The SVG URL exceeds 8192 bytes. Download the SVG and add it to your repository.", 414, {})
    }

    try {
      const svg = renderButton(parseButton(url.searchParams))
      return send(svg, 200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Content-Security-Policy": svgPolicy,
      })
    } catch (error) {
      if (error instanceof InputError) return send(error.message, 400, {})
      console.error(error)
      return send("Could not render the button.", 500, {})
    }
  },
}
