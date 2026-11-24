# Mastra Button

Generate SVG buttons for GitHub READMEs. The default button reproduces the supplied `mastra-deploy.svg` byte for byte, including the Mastra logo and the “Deploy” outlines. The editor and the API share one TypeScript renderer.

The service runs on Cloudflare Workers Free within the [plan quotas](https://developers.cloudflare.com/workers/platform/limits/). Rendering uses bundled XML and SVG parsers and requires no database, authentication, or network requests.

## Run locally

Requires Node.js 22.18 or later.

```sh
npm ci
npm run dev
```

Open [the editor](http://localhost:8787/) or [the default SVG](http://localhost:8787/v1/button.svg). Wrangler rebuilds the editor when files in `src/` change.

```sh
npm run check             # Type checking
npm run test:unit         # Rendering, validation, and URLs
npm run test:integration  # HTTP in Wrangler's local runtime
npm test                  # Both suites
npm run deploy:check      # Dry-run deployment build
```

## API

`GET /v1/button.svg` returns `image/svg+xml`. `HEAD /v1/button.svg` returns the headers with an empty body. With no parameters, the button measures 110 × 34 px. Invalid, unknown, or duplicate parameters return `400`. URLs over 8192 bytes return `414`. Unsupported methods return `405`.

| Parameter | Default | Values |
| --- | --- | --- |
| `text` | `Deploy` | 1 to 120 Unicode characters on one line. The width follows the label. “Deploy” uses the original vector outlines. |
| `bg` | `#000000` | Background color. |
| `fg` | `#f2f2f2` | Label color. |
| `border` | `#18181b` | Border color. |
| `borderWidth` | `1` | Decimal from 0 to 8 px in the base layout. |
| `radius` | `6` | Outer corner radius from 0 to 17 px in the base layout. |
| `divider` | `#3a3a3a` | Divider color, drawn at 60% opacity. |
| `iconColor` | `#f2f2f2` | Color of the Mastra icon, a custom path, or a monochrome SVG. |
| `icon` | `mastra` | `mastra` or `none`. `none` removes the icon and divider. |
| `iconPath` | | SVG `d` path data. Requires `iconViewBox`. |
| `iconViewBox` | | Four space- or comma-separated numbers. Use with `iconPath`. |
| `iconSvg` | | Complete UTF-8 SVG encoded in unpadded Base64URL. |
| `scale` | `1` | Decimal from 0.5 to 3. Scales `width` and `height` while preserving the layout `viewBox`. The default design measures 55 × 17 px at 0.5 and 220 × 68 px at 2. |
| `rev` | | Up to 64 ASCII letters, digits, periods, hyphens, or underscores. Change it to publish a new URL in your README. |

Choose one of `icon`, `iconPath`, or `iconSvg`. Omit all three for the Mastra preset. Colors accept 3-, 4-, 6-, or 8-digit hex, with an optional leading `#`. Supported names are `black`, `white`, `red`, `green`, `blue`, `yellow`, `gray`, `grey`, `silver`, `maroon`, `purple`, `fuchsia`, `lime`, `olive`, `navy`, `teal`, `aqua`, `orange`, and `transparent`. URL-encode query values, including `#` as `%23`.

```sh
curl -G 'http://localhost:8787/v1/button.svg' \
  --data-urlencode 'text=Deploy & review' \
  --data-urlencode 'fg=#f0f9ff' \
  --data-urlencode 'iconColor=#78cfff' \
  --data-urlencode 'scale=2'
```

## Import an SVG

Choose **Import SVG** in the editor. Enter a direct HTTPS URL that allows CORS, upload an `.svg` file, or paste the SVG markup. The browser validates and normalizes the file, then encodes its UTF-8 bytes as Base64URL. The icon travels in the query string. The Worker validates it again and reconstructs the allowed geometry.

| Accepted elements | Accepted attributes |
| --- | --- |
| `svg` | `xmlns`, `viewBox` or pixel `width` and `height`, and optional `role="img"` or `role="presentation"`. |
| `g` | Presentation and transform attributes listed below. |
| `path` | `d` |
| `rect` | `x`, `y`, `width`, `height`, `rx`, `ry` |
| `circle` | `cx`, `cy`, `r` |
| `ellipse` | `cx`, `cy`, `rx`, `ry` |
| `line` | `x1`, `y1`, `x2`, `y2` |
| `polygon`, `polyline` | `points` |
| `title`, `desc` | Plain text, discarded during normalization. |

The `svg`, groups, and shapes also accept `fill`, `stroke`, `color`, `opacity`, `fill-opacity`, `stroke-opacity`, `fill-rule`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, and `transform`. Supported transforms are `matrix`, `translate`, `scale`, `rotate`, `skewX`, and `skewY`. Both `fill` and `stroke` accept `none` and `currentColor`. Recoloring preserves `none` and opacity. Multicolor icons keep their explicit colors.

The importer rejects scripts, event handlers, CSS, references, embedded HTML, DOCTYPE declarations, animations, gradients, and masks. If the editor reports an unsupported feature, export the icon as simple shapes with presentation attributes.

The importer accepts up to 16 KiB of UTF-8 XML, 128 elements, 16 levels of nesting, and 512 combined path commands and points. A standalone path can contain up to 8192 characters. Coordinates must be within ±100000, and `viewBox` dimensions must be between 0.001 and 100000. If the full URL exceeds 8192 bytes after encoding, use **Download SVG** and reference the saved file from your README.

## GitHub Markdown

After deployment, replace `YOUR_SUBDOMAIN` with your Worker subdomain. The destination appears only in the outer link.

```markdown
[![Deploy](https://mastra-button.YOUR_SUBDOMAIN.workers.dev/v1/button.svg)](https://example.com/deploy)
```

For an SVG saved in your repository, use a relative path.

```markdown
[![Deploy](docs/button.svg)](https://example.com/deploy)
```

## Deploy and verify caching

```sh
npx wrangler login
npm run deploy
```

Wrangler prints the deployed URL. The Wrangler configuration enables [native Workers Cache](https://developers.cloudflare.com/workers/cache/configuration/) through `cache.enabled`. Valid SVG responses use `Cache-Control: public, max-age=86400`. The editor and error responses use `no-store`.

The editor uses a stable parameter order, omits defaults, and normalizes equivalent values. For example, both `scale=1` and `scale=1.0` produce a URL without a scale parameter. Set a new `rev` in your README to create a new cache key for the same image.

To check production caching, use a fresh `rev` and send two identical GET requests.

```sh
url='https://mastra-button.YOUR_SUBDOMAIN.workers.dev/v1/button.svg?rev=cache-test-1'
curl -sS -D - -o /dev/null "$url" | grep -iE '^(cf-cache-status|cache-control):'
curl -sS -D - -o /dev/null "$url" | grep -iE '^(cf-cache-status|cache-control):'
```

For a cold cache key, look for a `MISS` on the first response and a `HIT` on the second. Run this check against the deployed Cloudflare endpoint.
