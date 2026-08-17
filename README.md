# ez-signature

Multi-brand Outlook email signature generator. Staff type four fields, pick a
property, and get a signature that installs correctly in every Outlook.

`index.html` is the whole app. No build step, no framework, no dependencies at
runtime. Open the file or serve the folder.

```
index.html          the app: brand configs, signature builder, UI
assets/             versioned images, never overwritten
  social/<hex>/     icon set, one folder per colour
tools/make-icons.mjs regenerates the icon set in any colour
test.mjs            loads the page in Chromium, asserts the markup rules
docs/qa-matrix.md   the real acceptance gate
render.yaml         Render static site config
_headers            Cloudflare Pages headers
```

## Run

```bash
npm run serve      # http://localhost:8080
npm test           # needs: npm install
```

## Deploy

Static folder, so anywhere. Both configs are committed:

- **Cloudflare Pages** — connect the repo, build command empty, output directory `/`.
- **Render** — `render.yaml` is a static site with no build command.

### One decision that is expensive to reverse

Image URLs are baked into every signature staff install. If the URLs move, every
already-installed signature loses its images, and there is no way to fix them
remotely — each person has to reinstall.

So before rollout, set `ASSET_BASE` at the top of the script in `index.html` to a
domain you control:

```js
const ASSET_BASE = "https://sig.canareef.com/assets/";
```

It defaults to wherever the page is served from, which is right for testing and
wrong the day you change hosts.

## Adding a property

One object in `BRANDS` plus two images. No code changes.

```bash
node tools/make-icons.mjs 876432 1a4f7a   # icon set per brand colour
```

Icons are pre-rendered PNGs, one folder per colour, because Outlook cannot
recolour an image: no SVG, no CSS masks, no filters, no icon fonts. Setting a
brand's `brandColour` points its icons at the matching folder, so they track the
font colour. Regenerate after changing a colour.

Available networks: facebook, instagram, youtube, linkedin, x, tiktok, whatsapp,
pinterest, tripadvisor. Add more in `NETWORKS` in `tools/make-icons.mjs`.

## Why the markup looks like 2003

Outlook for Windows renders signatures with Word, which ignores flexbox, grid,
CSS classes, `<style>` blocks, `max-width`, unitless line-heights, SVG, web
fonts and background images. So: tables, inline styles, explicit `width` as both
an attribute and a style, `mso-line-height-rule: exactly` with px line-heights,
and colour restated on every element. `test.mjs` enforces all of it — if a
change breaks one of those rules, the test fails rather than the signature
silently degrading in someone's mailbox.

Images are hosted at public HTTPS URLs, never base64: embedded images blow the
8 KB ceiling Outlook on the web enforces and are blocked in several Outlook
paths.

## Not shipped

No accounts, no saved signatures, no admin panel, no headshot upload, no
analytics, no bulk deployment via PowerShell or Graph, no Gmail or Apple Mail
install guides. See section 11 of `signature-generator-prd.md`.

Icon glyphs from [simple-icons](https://simpleicons.org) (CC0), except LinkedIn,
which is from Font Awesome 6 Brands (CC BY 4.0) — simple-icons removed it after
a trademark request.
