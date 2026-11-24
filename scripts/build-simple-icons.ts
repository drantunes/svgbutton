import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import type { SimpleIcon } from "simple-icons"
import { normalizedSvg, parseSvg } from "../src/icon.ts"
import { byteLength, InputError, MAX_ICON_BYTES } from "../src/values.ts"

const output = new URL("../dist/assets/simple-icons/", import.meta.url)
const catalogFile = new URL("catalog.json", output)
const stamp = new URL("../dist/simple-icons-build", import.meta.url)
const inputs = [
  import.meta.url, "../package-lock.json", "../src/icon.ts", "../src/geometry.ts", "../src/values.ts",
]
const hash = createHash("sha256")
for (const input of inputs) hash.update(await readFile(new URL(input, import.meta.url)))
const fingerprint = hash.digest("hex")

const [lastBuild, catalog] = await Promise.all([
  readFile(stamp, "utf8").catch(() => null),
  readFile(catalogFile, "utf8").catch(() => null),
])

if (lastBuild !== fingerprint || !catalog) {
  const icons = Object.values(await import("simple-icons"))
    .filter((value): value is SimpleIcon => "slug" in value)
  const entries: [slug: string, title: string][] = []
  await rm(stamp, { force: true })
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })

  for (const { slug, title, svg } of icons) {
    let normalized: string
    try {
      normalized = normalizedSvg(parseSvg(svg))
    } catch (error) {
      if (error instanceof InputError) continue
      throw error
    }
    if (byteLength(normalized) > MAX_ICON_BYTES) continue
    await writeFile(new URL(`${slug}.svg`, output), normalized)
    entries.push([slug, title])
  }

  entries.sort((a, b) => a[1].localeCompare(b[1], "en"))
  await writeFile(catalogFile, JSON.stringify(entries))
  await writeFile(stamp, fingerprint)
  console.log(`Built ${entries.length} Simple Icons (${icons.length - entries.length} exceed the SVG limits).`)
}
