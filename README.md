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
tools/make-logos.py  master logo PNG -> signature-ready JPEG
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

Static folder, so anywhere. All three need no build step:

- **GitHub Pages** — repo Settings → Pages → Source **Deploy from a branch**,
  branch `main`, folder `/ (root)`, Save. Live at
  `https://kowalskies.github.io/ez-signature/` in a minute or two. `.nojekyll`
  stops Jekyll from touching the files.
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
node tools/make-icons.mjs 876432 2a5e50   # icon set per brand colour
```

Logo masters live in the repo root. Run one through the tool to get a
signature-ready asset:

```bash
pip install Pillow
python3 tools/make-logos.py   # trims, resizes to 2x, prints the 1x dimensions
```

Logos stay transparent. Outlook's dark mode inverts the message body background
but not images, so a transparent logo keeps its colour and sits on whatever
ground Outlook painted — it does not vanish. What it does lose is contrast:
Canareef's brown lands around the 3:1 threshold for graphics on dark
backgrounds and Palmscape's green falls below it, so both look softer there and
Palmscape looks washed out. That is a deliberate trade against putting a white
box behind every logo. The numbers, and the reversed-lockup fix, are in
`tools/make-logos.py`.

Put the printed dimensions in the brand's `logo.w` / `logo.h`. Column widths in
the signature derive from them, so a wider lockup shifts the text column instead
of overflowing the 600px table.

A brand may carry a `draft` string. While it does, the app shows a warning under
the property selector saying what is unfinished, so nobody installs a
half-configured signature. Delete the field when the property is ready.

Icons are pre-rendered PNGs, one folder per colour, because Outlook cannot
recolour an image: no SVG, no CSS masks, no filters, no icon fonts. Setting a
brand's `brandColour` points its icons at the matching folder, so they track the
font colour. Regenerate after changing a colour.

Available networks: facebook, instagram, youtube, linkedin, x, tiktok, whatsapp,
pinterest, tripadvisor. Add more in `NETWORKS` in `tools/make-icons.mjs`.

## Custom banners, and why there is no upload button

The Banner image section offers None, the property's own banner, or a custom
HTTPS URL. There is deliberately no upload button, and the reason is structural
rather than effort: uploading needs a host, and for a browser on this page to
learn where the file landed, the host's upload endpoint has to return
`Access-Control-Allow-Origin`. Image hosts generally do not — imgbs.com, for
example, accepts the POST and returns the URL in a response the browser is not
allowed to read, with a random hash in the filename so it cannot be guessed
either. So an in-page upload could send the file and never find out where it
went. Hosting the image first and pasting the direct link is the only version
that produces a working signature.

What the page does instead is verify. A pasted URL gets loaded as an `<img>`,
which is not subject to CORS, so the check is real: outputs stay locked until
the URL demonstrably resolves to an image, and a wrong aspect ratio warns without
blocking. This catches the mistake that matters — pasting a gallery or viewer
page instead of the image file, which looks correct in the preview and arrives as
a broken image for every recipient. Silence for ten seconds counts as failure, so
a host that stalls cannot leave the check hanging.

The in-app instructions under "I want to use my own banner image" carry the
staff-facing version of this.

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
