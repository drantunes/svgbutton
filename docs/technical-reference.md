# SVG Button technical reference

For the online editor and embedding instructions, see the [product guide](../README.md).

## API

`GET /v1/button.svg` returns `image/svg+xml`. `HEAD` returns the same status and headers with an empty body. Invalid, unknown, or duplicate parameters return `400`. URLs over 8,192 bytes return `414`. Other methods return `405` with `Allow: GET, HEAD`.

With no parameters, the API returns the original 110 × 34 Mastra Deploy button.

| Parameter | Default | Description |
| --- | --- | --- |
| `text` | `Deploy` | Label, 1–120 Unicode characters on one line. The button grows with the label. |
| `fontSize` | `15` | Label size in pixels before scaling, 8–24. The button adjusts its width. |
| `paddingX` | `0` | Extra space in pixels on the left and right, 0–48 per side. |
| `paddingY` | `0` | Extra space in pixels at the top and bottom, 0–48 per side. |
| `layout` | `standard` | `standard` uses one background. `split` gives the icon and label separate backgrounds and hides the divider. |
| `bg` | `#000000` | Button background in `standard`, label background in `split`. Also covers the entire button when there is no icon. |
| `iconBg` | `#3a3a3a` | Icon or left label background in `split`. |
| `fg` | `#f2f2f2` | Label color. |
| `border` | `#18181b` | Border color. |
| `borderWidth` | `1` | Border width in pixels, 0–8. |
| `radius` | `6` | Outer corner radius in pixels, 0–17. |
| `divider` | `#3a3a3a` | Divider color at 60% opacity in `standard`. |
| `iconColor` | `#f2f2f2` | Color of the left label, the Mastra icon, a custom path, or a monochrome SVG. |
| `iconSize` | `20` | Icon box size in pixels, 8–24. The icon stays centered in its slot. |
| `icon` | `mastra` | `mastra`, `none`, or a lowercase catalog slug such as `github`. `none` removes the icon and divider. |
| `iconText` | | Left label, 1–120 Unicode characters on one line. Uses `fontSize`. |
| `iconPath` | | SVG path data (`d`). Use with `iconViewBox`. |
| `iconViewBox` | | Four numbers separated by spaces or commas. Use with `iconPath`. |
| `iconSvg` | | UTF-8 SVG encoded as Base64URL without padding. |
| `scale` | `1` | 0.5–3. Changes the output dimensions and keeps the same `viewBox`. |
| `rev` | | Optional cache key suffix. Up to 64 ASCII letters, digits, periods, hyphens, or underscores. |

Choose at most one of `icon`, `iconText`, `iconPath`, and `iconSvg`. Colors accept 3-, 4-, 6-, and 8-digit hex with an optional `#`. See [the color list](../src/values.ts) for supported names. URL-encode query values, including `#` as `%23`.

Icon slugs come from the catalog bundled with each deployment. To keep the artwork fixed, download the rendered SVG and commit it to your repository. See the [hosted icon catalog](https://svgbutton.com/simple-icons/catalog.json) and the [Simple Icons brand usage notes](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md).

```sh
curl -G https://svgbutton.com/v1/button.svg \
  --data-urlencode 'text=Build passing' \
  --data-urlencode 'icon=github' \
  --data-urlencode 'layout=split' \
  --data-urlencode 'iconBg=#24292f' \
  --data-urlencode 'bg=#1a7f37' \
  --data-urlencode 'scale=2'
```

## SVG import requirements

Use an `svg` root with a `viewBox`. If the SVG has no `viewBox`, provide its width and height in pixels. Supported elements are `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polygon`, and `polyline`. The editor strips `title` and `desc` and rejects scripts, styles, external references, and animations. See [the SVG validator](../src/icon.ts) for the full list of supported attributes.

`class` is outside the importer's allowlist. The importer rebuilds the icon from geometry and supported presentation attributes. Apply any required CSS values directly to the shapes as attributes such as `fill`, `stroke`, or `stroke-width`, then remove the classes and stylesheet before uploading.

- The input SVG can contain up to **16 KiB of UTF-8 XML**, 128 elements, 16 levels of nesting, and 512 path commands and points combined. A standalone path can use up to 8,192 characters.
- The **complete button URL** can use up to **8,192 bytes**, including the encoded icon. If the preview works but the URL is too long to copy, click **Download SVG** and commit it with your README.

## Run locally

Use Node.js 24.14 or newer.

```sh
npm ci
npm run dev
```

Open the [local editor](http://localhost:8787/) to preview and edit a button. For a GitHub README, use an SVG URL from a public deployment or commit the downloaded file.

```sh
curl 'http://localhost:8787/v1/button.svg?text=Create+your+Button&icon=materialdesignicons'
```

## Run checks

```sh
npm run check
npm test
npm run deploy:check
```

`npm test` runs the unit tests and the HTTP tests against Wrangler's local runtime. `npm run deploy:check` builds the Worker without publishing it.

## Deploy

To publish from your machine, run `npx wrangler login` once, then `npm run deploy`. Wrangler prints the public editor URL.

## Cache

Wrangler enables [native Workers Cache](https://developers.cloudflare.com/workers/cache/configuration/). Successful SVG responses use `Cache-Control: public, max-age=86400`. The editor and errors use `no-store`. The editor uses a stable parameter order and drops defaults such as `scale=1.0`. Change `rev` when you want a fresh URL in a README.
