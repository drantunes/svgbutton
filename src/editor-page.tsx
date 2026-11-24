import { BUTTON_PATH, defaults } from "./values.ts"

function EditorPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f5f3ee" />
        <title>Mastra Button · SVG Buttons for GitHub</title>
        <link rel="stylesheet" href="/editor.css" />
        <script type="module" src="/editor.js"></script>
      </head>
      <body>
        <main class="shell">
          <header class="intro">
            <div>
              <h1>Mastra Button<span>.</span></h1>
              <p>Customize an SVG button for your project's README.</p>
            </div>
            <button id="theme-toggle" type="button" aria-pressed="false" hidden>Dark mode</button>
          </header>

          <form id="editor" class="workspace">
            <div class="controls">
              <fieldset>
                <legend>Button</legend>
                <div class="fields">
                  <label class="full">Label
                    <input name="text" value={defaults.text} required />
                  </label>
                  <label class="full">Destination URL
                    <input name="destination" type="url" placeholder="https://example.com/deploy" aria-describedby="destination-hint" />
                  </label>
                  <small class="full hint" id="destination-hint">Optional. The link opens when someone clicks the button in your README.</small>
                  <label>Scale
                    <input name="scale" type="number" min="0.5" max="3" step="any" value={defaults.scale} required />
                  </label>
                  <label>Revision
                    <input name="rev" maxlength={64} placeholder="e.g. v2" />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Appearance</legend>
                <div class="fields">
                  <label>Background <input name="bg" value={defaults.bg} spellcheck={false} /></label>
                  <label>Text color <input name="fg" value={defaults.fg} spellcheck={false} /></label>
                  <label>Border color <input name="border" value={defaults.border} spellcheck={false} /></label>
                  <label>Divider color <input name="divider" value={defaults.divider} spellcheck={false} /></label>
                  <label>Border width
                    <input name="borderWidth" type="number" min="0" max="8" step="any" value={defaults.borderWidth} />
                  </label>
                  <label>Corner radius
                    <input name="radius" type="number" min="0" max="17" step="any" value={defaults.radius} />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Icon</legend>
                <div class="fields">
                  <label>Source
                    <select name="source">
                      <option value="mastra">Mastra</option>
                      <option value="none">No icon</option>
                      <option value="simple-icons">Simple Icons</option>
                      <option value="path">SVG path</option>
                      <option value="svg">Import SVG</option>
                    </select>
                  </label>
                  <label>Icon color <input name="iconColor" value={defaults.iconColor} spellcheck={false} /></label>
                </div>
                <section id="simple-icons-fields" class="extra fields" hidden>
                  <label class="full">Search Simple Icons
                    <input id="simple-icons-search" type="search" placeholder="e.g. GitHub" autocomplete="off" />
                  </label>
                  <label class="full">Brand
                    <select id="simple-icons-list" size={6} aria-describedby="simple-icons-results" disabled></select>
                  </label>
                  <small id="simple-icons-results" class="full hint" role="status"></small>
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
              </fieldset>
            </div>

            <section class="result" aria-labelledby="preview-title">
              <div class="result-title">
                <h2 id="preview-title">Preview</h2>
                <span id="dimensions">110 × 34 px</span>
              </div>
              <div class="preview">
                <img id="preview" src={BUTTON_PATH} alt={defaults.text} />
              </div>
              <p id="render-status" role="status" hidden></p>
              <label class="markdown">Markdown for GitHub
                <textarea id="markdown" readonly rows={3} spellcheck={false}></textarea>
              </label>
              <div class="actions">
                <button id="copy-markdown" class="primary" type="button" disabled>Copy Markdown</button>
                <button id="copy-url" type="button" disabled>Copy SVG URL</button>
                <button id="download" type="button" disabled>Download SVG</button>
              </div>
              <small id="action-status" class="hint" role="status"></small>
            </section>
          </form>
          <noscript>Enable JavaScript to edit and export the button.</noscript>
        </main>
      </body>
    </html>
  )
}

export const editorHtml = "<!doctype html>\n" + (<EditorPage />).toString()
