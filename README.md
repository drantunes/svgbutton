# SVG Button

Make SVG buttons for GitHub READMEs. Start with the original 110 × 34 Mastra Deploy button and customize the label, colors, and icon. Hono serves the editor and API on Cloudflare Workers Free.

## Use in a GitHub README

Open your deployed editor at `https://svgbutton.YOUR_SUBDOMAIN.workers.dev/`. If you need to set it up first, see [Deploy](#deploy). Customize the button, add a destination URL if you want it to be clickable, then click **Copy Markdown** and paste it into your README.

```markdown
[![Deploy](https://svgbutton.YOUR_SUBDOMAIN.workers.dev/v1/button.svg)](https://example.com/deploy)
```

To keep the image in your repository, click **Download SVG**, commit it as `docs/button.svg`, and use a relative image path.

```markdown
[![Deploy](docs/button.svg)](https://example.com/deploy)
```

Choose **Simple Icons** to search the bundled catalog. It includes icons that fit this project's SVG limits. The editor adds the slug to the image URL, such as `?icon=github`. Check [Simple Icons' brand usage notes](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md) before using a logo.

## Run locally

Use Node.js 24.14 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:8787](http://localhost:8787/) to preview and edit a button. For a GitHub README, use the URL from a public deployment or commit the downloaded SVG. GitHub cannot load images from your local server.

The editor follows your system theme until you click the sun or moon. Your choice stays in this browser.

## API

`GET /v1/button.svg` returns `image/svg+xml`. `HEAD` returns the same status and headers with an empty body. Invalid, unknown, or duplicate parameters return `400`. URLs over 8,192 bytes return `414`. Other methods return `405` with `Allow: GET, HEAD`.

| Parameter | Default | Description |
| --- | --- | --- |
| `text` | `Deploy` | Label, 1–120 Unicode characters on one line. The button grows with the label. |
| `bg` | `#000000` | Background color. |
| `fg` | `#f2f2f2` | Label color. |
| `border` | `#18181b` | Border color. |
| `borderWidth` | `1` | Border width in pixels, 0–8. |
| `radius` | `6` | Outer corner radius in pixels, 0–17. |
| `divider` | `#3a3a3a` | Divider color at 60% opacity. |
| `iconColor` | `#f2f2f2` | Color of the Mastra icon, a custom path, or a monochrome SVG. |
| `iconSize` | `20` | Icon box size in pixels, 8–24. The icon stays centered in its slot. |
| `icon` | `mastra` | `mastra`, `none`, or a lowercase catalog slug such as `github`. `none` removes the icon and divider. |
| `iconPath` | | SVG path data (`d`). Use with `iconViewBox`. |
| `iconViewBox` | | Four numbers separated by spaces or commas. Use with `iconPath`. |
| `iconSvg` | | UTF-8 SVG encoded as Base64URL without padding. |
| `scale` | `1` | 0.5–3. Changes the output dimensions and keeps the same `viewBox`. |
| `rev` | | Optional cache key suffix. Up to 64 ASCII letters, digits, periods, hyphens, or underscores. |

Choose at most one of `icon`, `iconPath`, and `iconSvg`. Colors accept 3-, 4-, 6-, and 8-digit hex with an optional `#`. See [the color list](src/values.ts) for supported names. URL-encode query values, including `#` as `%23`.

The deployed catalog is available at `/simple-icons/catalog.json`. A slug follows the catalog in the current deployment. To pin the artwork in a README, download and commit the rendered SVG.

```sh
curl -G http://localhost:8787/v1/button.svg \
  --data-urlencode 'text=Deploy & review' \
  --data-urlencode 'icon=github' \
  --data-urlencode 'iconColor=#78cfff' \
  --data-urlencode 'scale=2'
```

## Import an SVG

In the editor, choose **Import SVG**. Upload a file, paste the markup, or enter a direct HTTPS URL that allows CORS. The editor embeds the icon in the button URL. The Worker validates the embedded SVG and renders it without fetching the original source.

Use an `svg` root with a `viewBox`. If the SVG has no `viewBox`, provide its width and height in pixels. Supported elements are `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polygon`, and `polyline`. The editor strips `title` and `desc` and rejects scripts, styles, external references, and animations. See [the SVG validator](src/icon.ts) for the full list of supported attributes.

- The input SVG can contain up to **16 KiB of UTF-8 XML**, 128 elements, 16 levels of nesting, and 512 path commands and points combined. A standalone path can use up to 8,192 characters.
- The **complete button URL** can use up to **8,192 bytes**, including the encoded icon. If the preview works but the URL is too long to copy, click **Download SVG** and commit it with your README.

## Test

```sh
npm run check
npm test
npm run deploy:check
```

`npm test` runs the unit tests and the HTTP tests against Wrangler's local runtime. `npm run deploy:check` builds the Worker without publishing it.

## Deploy

To publish from your machine, run `npx wrangler login` once, then `npm run deploy`. Wrangler prints the public editor URL.

GitHub Actions tests every push and deploys `main` after the tests pass. Add these in [Settings → Secrets and variables → Actions](https://github.com/drantunes/svgbutton/settings/secrets/actions).

| Name | Store as | Where to get it |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens). Use the **Edit Cloudflare Workers** template and select your account. |
| `CLOUDFLARE_ACCOUNT_ID` | [Repository variable](https://github.com/drantunes/svgbutton/settings/variables/actions) | Copy the ID from [Workers & Pages](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/#find-account-id-in-workers--pages). |

Until both values are set, the deploy job reports a skip. After setup, run the workflow from the [Actions tab](https://github.com/drantunes/svgbutton/actions) or push to `main`. If your token can edit only an existing Worker, publish `svgbutton` from your machine first. [Cloudflare Workers permissions](https://developers.cloudflare.com/workers/authorization/)

## Cache

Wrangler enables [native Workers Cache](https://developers.cloudflare.com/workers/cache/configuration/). Successful SVG responses use `Cache-Control: public, max-age=86400`. The editor and errors use `no-store`. The editor uses a stable parameter order and drops defaults such as `scale=1.0`. Change `rev` when you want a fresh URL in a README.

After deploying, send the same GET twice with a fresh `rev`. Look for `Cf-Cache-Status: MISS` on the first response and `HIT` on the second.

```sh
url='https://svgbutton.YOUR_SUBDOMAIN.workers.dev/v1/button.svg?rev=cache-test-1'
for attempt in 1 2; do
  curl -sS -D - -o /dev/null "$url" | grep -i '^cf-cache-status:'
done
```
