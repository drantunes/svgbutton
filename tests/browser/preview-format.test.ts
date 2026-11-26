import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { chromium, type Browser } from "playwright"
import { createTestHarness } from "wrangler"

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] })
let browser: Browser
let url: URL

before(async () => {
  browser = await chromium.launch()
  url = (await server.listen()).url
})
after(async () => {
  await Promise.all([browser?.close(), server.close()])
})

const formats = ["Image", "Markdown", "SVG"] as const
const transparent = "rgba(0, 0, 0, 0)"
const palettes = {
  light: {
    text: "rgb(36, 34, 50)",
    selectedText: "rgb(88, 50, 162)",
    selectedBackground: "rgb(232, 226, 245)",
    selectedBorder: "rgb(131, 125, 146)",
  },
  dark: {
    text: "rgb(232, 233, 238)",
    selectedText: "rgb(232, 233, 238)",
    selectedBackground: "rgb(48, 51, 61)",
    selectedBorder: "rgb(104, 111, 126)",
  },
}

for (const theme of ["light", "dark"] as const) {
  test(`preview formats distinguish selected and unselected buttons in the ${theme} theme`, async (t) => {
    const page = await browser.newPage({ colorScheme: theme })
    t.after(() => page.close())
    page.setDefaultTimeout(10_000)
    await page.goto(url.href)
    await page.locator("#download:enabled").waitFor()
    const toggle = page.getByRole("button", { name: "Dark mode" })
    assert.equal(await toggle.getAttribute("aria-pressed"), String(theme === "dark"))

    const picker = page.getByRole("group", { name: "Preview format" })
    const palette = palettes[theme]

    async function assertSelection(selected: (typeof formats)[number]) {
      const actual = await picker.getByRole("button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const { color, backgroundColor, borderTopColor } = getComputedStyle(button)
          return {
            name: button.textContent?.trim(),
            pressed: button.getAttribute("aria-pressed"),
            color,
            backgroundColor,
            borderTopColor,
          }
        }),
      )
      const expected = formats.map((name) => {
        const pressed = name === selected
        return {
          name,
          pressed: String(pressed),
          color: pressed ? palette.selectedText : palette.text,
          backgroundColor: pressed ? palette.selectedBackground : transparent,
          borderTopColor: pressed ? palette.selectedBorder : transparent,
        }
      })
      assert.deepEqual(actual, expected, `${selected} selected in the ${theme} theme`)
    }

    await assertSelection("Image")
    for (const format of ["Markdown", "SVG", "Image"] as const) {
      await picker.getByRole("button", { name: format, exact: true }).click()
      await page.mouse.move(0, 0)
      await assertSelection(format)
    }
  })
}

test("Fixed Size applies and removes custom dimensions across the editor and hosted SVG", async (t) => {
  const page = await browser.newPage()
  t.after(() => page.close())
  page.setDefaultTimeout(10_000)
  await page.goto(url.href)
  await page.locator("#download:enabled").waitFor()

  const fixedSize = page.getByRole("checkbox", { name: "Fixed Size" })
  const width = page.getByLabel("Width (px)", { exact: true })
  const height = page.getByLabel("Height (px)", { exact: true })
  const scale = page.getByLabel("Scale", { exact: true })
  const output = page.locator("#output")
  assert.equal(await fixedSize.isChecked(), false)
  assert.equal(await width.isVisible(), false)
  await scale.fill("2")
  await page
    .locator("#dimensions")
    .filter({ hasText: / × 68 px$/ })
    .waitFor()
  const automaticUrl = await output.inputValue()

  await fixedSize.check()
  assert.equal(await scale.isDisabled(), true)
  assert.equal(await height.inputValue(), "68")
  await width.fill("240")
  await height.fill("74")
  await page.getByText("240 × 74 px", { exact: true }).waitFor()
  const fixedUrl = new URL(await output.inputValue())
  assert.equal(fixedUrl.searchParams.get("width"), "240")
  assert.equal(fixedUrl.searchParams.get("height"), "74")
  await page.getByRole("button", { name: "Markdown", exact: true }).click()
  assert.ok((await output.inputValue()).includes(fixedUrl.href))
  await page.getByRole("button", { name: "SVG", exact: true }).click()
  const svg = await output.inputValue()
  assert.equal(await (await page.request.get(fixedUrl.href)).text(), svg)

  await fixedSize.uncheck()
  assert.equal(await width.isVisible(), false)
  assert.equal(await scale.isEnabled(), true)
  assert.doesNotMatch(await output.inputValue(), /<svg [^>]*style=/)
  await page.getByRole("button", { name: "Image", exact: true }).click()
  assert.equal(await output.inputValue(), automaticUrl)

  await page.goto(fixedUrl.href)
  assert.equal(
    await page
      .locator("svg")
      .first()
      .evaluate((svg) => getComputedStyle(svg).maxWidth),
    "240px",
  )

  await page.goto("about:blank")
  await page.setContent(
    `<style>svg { width: 100% !important; height: 100vh !important; max-width: 10px; min-height: 100px; }</style>${svg}`,
  )
  const size = await page.locator("svg").first().boundingBox()
  assert.equal(size?.width, 240)
  assert.equal(size?.height, 74)
})
