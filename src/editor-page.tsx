import { BUTTON_PATH, decimalRanges, defaults, editorDefaults } from "./values.ts"

const previewParams = new URLSearchParams({ text: editorDefaults.text, icon: editorDefaults.icon })

type ColorFieldProps = {
  name: "bg" | "iconBg" | "fg" | "border" | "divider" | "iconColor"
  label: string
  labelId?: string
  fieldId?: string
  hidden?: boolean
}

function ColorField({ name, label, labelId = `${name}-color-label`, fieldId, hidden }: ColorFieldProps) {
  const inputId = `color-${name}`
  return (
    <div class="color-field" id={fieldId} hidden={hidden}>
      <label id={labelId} for={inputId}>{label}</label>
      <div class="color-control">
        <input id={inputId} name={name} value={defaults[name]} spellcheck={false} />
        <input type="color" value={defaults[name]} data-color-for={name} aria-labelledby={`color-picker-label ${labelId}`} />
      </div>
    </div>
  )
}

function EditorPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#eff0f4" />
        <title>SVG Button · GitHub README buttons</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="stylesheet" href="/editor.css" />
        <script type="module" src="/editor.js"></script>
      </head>
      <body>
        <main class="shell">
          <header class="intro">
            <div>
              <h1>SVG Button<span>.</span></h1>
              <p>Customize an SVG button for your project's README.</p>
            </div>
            <div class="intro-actions">
              <a class="repository-link" href="https://github.com/drantunes/svgbutton" target="_blank" rel="noopener noreferrer">GitHub</a>
              <button id="theme-toggle" type="button" aria-label="Dark mode" aria-pressed="false" hidden>
                <svg class="theme-icon theme-icon-light" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42" />
                </svg>
                <svg class="theme-icon theme-icon-dark" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
                  <path d="M20.7 15.4A8.9 8.9 0 0 1 8.6 3.3 9 9 0 1 0 20.7 15.4Z" />
                </svg>
              </button>
            </div>
          </header>

          <span id="color-picker-label" hidden>Choose</span>
          <form id="editor" class="workspace">
            <div class="controls">
              <section class="control-card" aria-labelledby="button-title">
                <h2 id="button-title">Button</h2>
                <div class="fields">
                  <label class="full">Label
                    <input name="text" value={editorDefaults.text} required />
                  </label>
                  <label class="full">Destination URL
                    <input name="destination" type="url" placeholder="https://example.com/deploy" aria-describedby="destination-hint" />
                  </label>
                  <small class="full hint" id="destination-hint">Optional. The link opens when someone clicks the button in your README.</small>
                  <label>Scale
                    <input name="scale" type="number" {...decimalRanges.scale} step="any" value={defaults.scale} required />
                  </label>
                  <label>Revision
                    <input name="rev" maxlength={64} placeholder="e.g. v2" />
                  </label>
                </div>
              </section>

              <section class="control-card" aria-labelledby="appearance-title">
                <h2 id="appearance-title">Appearance</h2>
                <div class="fields">
                  <label class="full">Layout
                    <select name="layout">
                      <option value="standard" selected>Standard</option>
                      <option value="split">Split</option>
                    </select>
                  </label>
                  <ColorField name="bg" label="Background" labelId="background-label" />
                  <ColorField name="iconBg" label="Icon background" labelId="icon-background-label" fieldId="icon-background-field" hidden />
                  <ColorField name="fg" label="Text color" />
                  <ColorField name="border" label="Border color" />
                  <ColorField name="divider" label="Divider color" fieldId="divider-field" />
                  <label>Border width
                    <input name="borderWidth" type="number" {...decimalRanges.borderWidth} step="any" value={defaults.borderWidth} />
                  </label>
                  <label>Corner radius
                    <input name="radius" type="number" {...decimalRanges.radius} step="any" value={defaults.radius} />
                  </label>
                  <label>Extra horizontal padding (px)
                    <input name="paddingX" type="number" {...decimalRanges.paddingX} step="any" value={defaults.paddingX} />
                  </label>
                  <label>Extra vertical padding (px)
                    <input name="paddingY" type="number" {...decimalRanges.paddingY} step="any" value={defaults.paddingY} />
                  </label>
                  <label>Label size (px)
                    <input name="fontSize" type="number" {...decimalRanges.fontSize} step="any" value={defaults.fontSize} />
                  </label>
                </div>
              </section>

              <section class="control-card" aria-labelledby="icon-title">
                <h2 id="icon-title">Icon</h2>
                <div class="fields">
                  <label class="full">Source
                    <select name="source">
                      <option value="mastra">Mastra</option>
                      <option value="none">No icon</option>
                      <option value="simple-icons" selected>Simple Icons</option>
                      <option value="text">Text</option>
                      <option value="path">SVG path</option>
                      <option value="svg">Import SVG</option>
                    </select>
                  </label>
                  <label id="icon-text-field" class="full" hidden>Left label
                    <input name="iconText" value="BUILD" spellcheck={false} />
                  </label>
                  <ColorField name="iconColor" label="Icon color" labelId="icon-color-label" />
                  <label id="icon-size-field">Icon size (px)
                    <input name="iconSize" type="number" {...decimalRanges.iconSize} step="any" value={defaults.iconSize} />
                  </label>
                </div>
                <section id="simple-icons-fields" class="extra fields" hidden>
                  <div class="brand-field full">
                    <label id="simple-icons-label" for="simple-icons-list">Brand</label>
                    <select id="simple-icons-list" aria-describedby="simple-icons-status">
                      <option value="">Choose a brand</option>
                      <option value={editorDefaults.icon} selected>{editorDefaults.iconTitle}</option>
                    </select>
                  </div>
                  <small id="simple-icons-catalog-status" class="full hint" role="status"></small>
                  <small id="simple-icons-status" class="full hint" role="status"></small>
                </section>
                <section id="path-fields" class="extra fields" hidden>
                  <label class="full">Path (d)
                    <textarea name="iconPath" rows={2} placeholder="M0 0H24V24H0Z" spellcheck={false}></textarea>
                  </label>
                  <label class="full">ViewBox
                    <input name="iconViewBox" value="0 0 24 24" spellcheck={false} />
                  </label>
                </section>
                <section id="svg-fields" class="extra fields" hidden>
                  <label class="full">SVG HTTPS URL
                    <input name="importUrl" type="url" placeholder="https://example.com/icon.svg" />
                  </label>
                  <button id="import-url" type="button">Import from URL</button>
                  <label class="full">.svg file
                    <input name="importFile" type="file" accept=".svg,image/svg+xml" />
                  </label>
                  <label class="full">SVG markup
                    <textarea name="importSource" rows={3} placeholder="Paste the SVG file contents" spellcheck={false}></textarea>
                  </label>
                  <button id="import-source" type="button">Use pasted SVG</button>
                  <small id="import-status" class="full hint" role="status">If the source blocks CORS, upload a file or paste the SVG markup.</small>
                </section>
              </section>
            </div>

            <section class="result" aria-labelledby="preview-title">
              <div class="result-title">
                <h2 id="preview-title">Preview</h2>
                <span id="dimensions"></span>
              </div>
              <div class="preview-toolbar">
                <div id="preview-formats" class="preview-formats" role="group" aria-label="Preview format">
                  <button type="button" data-format="image" aria-pressed="true">Image</button>
                  <button type="button" data-format="markdown" aria-pressed="false">Markdown</button>
                  <button type="button" data-format="svg" aria-pressed="false">SVG</button>
                </div>
                <div class="copy-control">
                  <button id="copy-output" type="button" aria-label="Copy image URL" disabled>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                      <rect x="8" y="8" width="12" height="12" rx="2" />
                      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                    </svg>
                  </button>
                  <span id="copy-tooltip" class="copy-tooltip" role="status"></span>
                </div>
              </div>
              <div id="image-preview" class="preview">
                <img id="preview" src={`${BUTTON_PATH}?${previewParams}`} alt={editorDefaults.text} />
              </div>
              <div class="preview-code">
                <pre aria-hidden="true"><code id="output-highlight"></code></pre>
                <textarea id="output" aria-label="Image URL" readonly rows={3} spellcheck={false} wrap="off"></textarea>
              </div>
              <p id="render-status" role="status" hidden></p>
              <div class="actions">
                <button id="download" type="button" disabled>Download SVG</button>
              </div>
              <small id="action-status" class="hint" role="status" hidden></small>
            </section>
          </form>
          <noscript>Enable JavaScript to edit and export the button.</noscript>
        </main>
      </body>
    </html>
  )
}

export const editorHtml = "<!doctype html>\n" + (<EditorPage />).toString()
