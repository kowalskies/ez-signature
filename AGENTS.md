# AGENTS.md

Multi-brand Outlook email signature generator. `index.html` **is** the app: brand
configs, signature builder, form, preview, outputs, install docs. No build step,
no framework, no runtime dependencies. Deployed as a static folder.

Run `node test.mjs` after every change. It is the spec.

## The one thing to understand

Outlook for Windows renders signatures with **Word**, not a browser. Word ignores
flexbox, grid, CSS classes, `<style>` blocks, `max-width`, unitless line-heights,
SVG, web fonts and background images. The signature markup therefore looks like
2003 on purpose. A preview looking right proves nothing — that is why the rules
below are asserted in tests rather than trusted to review.

Never apply app-UI instincts to `buildHtml()`. Tailwind-era CSS in there is a bug.

## Signature markup rules (all test-enforced)

- Tables and inline styles only. No `<div>` for layout, no classes, no `<style>`.
- Width as **both** an attribute and a style. Never `max-width` — Word ignores it.
- Every line-height in **px**, plus `mso-line-height-rule: exactly` on text cells.
  Word ignores unitless and percentage values.
- Every link carries `color` and `text-decoration` on **both** the `<a>` and a
  nested `<span>`. Without the span, Outlook restyles `mailto:`/`tel:` to blue.
- Explicit `color` on every text node. Nothing left to the client's default.
- The rule under the property name is a 1px `<td>` with `bgcolor`, not a
  `border-bottom`. Word drops thin borders unpredictably.
- Every `<img>`: `width`, `height`, `alt`, `border="0"`, `display:block`.
  `display:block` kills the phantom gap under images.
- `white-space: nowrap` on identity and contact lines.
- Padding only on `<td>`, never margin.
- Optional rows are **omitted**, never rendered empty.
- Column widths derive from the logo, and must sum to 600.
- Escape through `esc()` / `escAttr()`. Staff type `&` and `'` into job titles.
- Phone hrefs are E.164 via `sanitizePhone()`; display text stays readable.

## Hard limits

| Limit | Value | Why |
|---|---|---|
| Signature width | 600px | Safe maximum for email |
| Signature HTML | 8,000 chars hard, 7,500 warn | Outlook on the web rejects above it |
| Logo / icon asset | under 50 KB | |
| Banner asset | 120 KB budget | Every recipient downloads it every email |

Currently ~6.3 KB. The PRD's 5 KB target is **not reachable** with the mandated
inline rules plus a 445-character disclaimer and seven absolute image URLs; see
the note in `test.mjs`. The disclaimer toggle is the lever if it ever matters.

## Images

**Hosted HTTPS URLs only. Never base64** — it blows the 8 KB ceiling and is
blocked in several Outlook paths. This is also why there is no upload button: a
host's upload endpoint must send `Access-Control-Allow-Origin` for the browser to
read back where the file went, and image hosts generally do not. Custom banner
URLs are instead verified by loading them as an `<img>`, which CORS does not
restrict, and the outputs stay locked until that succeeds.

`ASSET_BASE` at the top of the script is **the expensive-to-reverse decision**.
Asset URLs are baked into every installed signature, so if they move, every
already-installed signature loses its images with no remote fix. Point it at a
permanent domain before rollout.

Assets are versioned and immutable (`banner-canareef-v1.png`). Classic Outlook
copies images into its own store at insertion time, so overwriting a live asset
does nothing for existing installs.

Logos are **transparent** by decision, not by oversight. Outlook dark mode inverts
the body background but not images, so a transparent logo does not vanish — it
loses contrast. Measured against the 3:1 threshold for graphics: Canareef brown
3.23 / 2.81 / 3.90 on OWA, desktop and iOS dark; Palmscape green 2.33 / 2.03 /
2.82. Accepted over putting a white box behind every logo. Do not "fix" this by
flattening onto white — that was tried and rejected. The fix, if ever needed, is a
reversed lockup on the brand colour.

Social icons are pre-rendered PNGs, one folder per colour, because Outlook cannot
recolour an image. Changing a brand colour means regenerating:
`node tools/make-icons.mjs <hex>`.

## Tools

```bash
node test.mjs                      # the spec — run after every change
node tools/make-icons.mjs <hex>    # icon set in a brand colour
python3 tools/make-logos.py        # master logo PNG -> signature asset (needs Pillow)
npm run serve                      # http://localhost:8080
```

Logo masters live in the repo root. `make-logos.py` prints the 1x dimensions to
put in the brand's `logo.w` / `logo.h`.

## Adding or editing a brand

One object in `BRANDS`, plus a logo and optionally a banner. No code changes.
A brand carrying a `draft` string shows a warning under the property selector
listing what is unfinished; delete the field when it is ready.

Toggles (`showRes`, `showWebsite`, `showDisclaimer`) default to the safe state and
`Reset to defaults` restores that default, never the last-used state. Anything
that appears in both outputs must be handled in `buildHtml()` **and**
`buildPlainText()` — the plain-text website line is the easy one to miss.

## Outputs

Four, from the same data: rich clipboard copy, `.htm` download, HTML source, and
plain text for mobile. The plain-text flavour on the clipboard is the purpose-built
mobile string, never the preview's `innerText` — that would drag the disclaimer
into a plain-text paste.

`buildHtml()` output goes to two places that must never drift: the preview iframe,
and a hidden off-screen mirror node the clipboard fallback selects from. The
iframe exists so app CSS cannot leak into the preview; the mirror exists because a
`Range` cannot reach inside an iframe's document.

Outlook mobile has no HTML signature field at all. Plain text is a first-class
output, not a fallback, and staff will report it as a bug — the app says why at the
point of copying.

## What is deliberately not built

No accounts, no saved signatures, no admin panel, no headshot upload, no image
upload, no analytics, no colour picker or font selector (brand comes from config —
that is the point), no bulk deployment, no Gmail or Apple Mail guides. See §2 and
§11 of `signature-generator-prd.md` before adding any of it.

## Still open

- `ASSET_BASE` not pointed at a permanent domain.
- Palmscape: website, reservations address, disclaimer wording, social handles.
- `docs/qa-matrix.md` is empty. Nothing has been installed and sent from a real
  Outlook, which is where this project actually succeeds or fails. Do not claim
  the signature works until that grid has entries.
- Banner is 218 KB as PNG, over the 120 KB budget, and 1.42x rather than 2x.

## Style

Match the existing code: plain JS, no build step, comments that explain *why* an
Outlook workaround exists rather than restating the code. Prefer deleting to
adding. Do not introduce a framework, a bundler, or a dependency without being
asked. When a constraint makes a request impossible, say so with the measurement
that proves it rather than building something that looks right and breaks in a
recipient's inbox.
