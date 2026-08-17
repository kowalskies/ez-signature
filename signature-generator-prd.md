# PRD: Multi-Brand Email Signature Generator

**Owner:** Ameed · **Version:** 1.0 (planning) · **Date:** 17 August 2026
**Deliverable:** A static webapp where a staff member types Name, Position, Email and Mobile, picks their property, and gets a signature that installs correctly in every Outlook they might use.

---

## 1. Why this needs a spec, not just a form

The form is the easy half. The hard half is that "Outlook" is four different rendering engines with four different signature stores, and one of them cannot show images at all. Everything below is shaped by that.

### Research findings

| Platform | Signature store | Rendering engine | Images in signature |
|---|---|---|---|
| Classic Outlook for Windows | `.htm` file in `%APPDATA%\Microsoft\Signatures`, now synced to the mailbox via roaming signatures | Microsoft Word | Yes |
| New Outlook for Windows (Monarch) | Server side, in the mailbox | Web based, stricter HTML/CSS support than classic | Yes |
| Outlook on the web / PWA (same codebase) | Server side, in the mailbox | Browser | Yes |
| Outlook for Mac | Local, roams on Microsoft 365 accounts | WebKit | Yes |
| Outlook mobile, iOS and Android | Separate per-device setting, does not sync | Plain text | **No** |

Four findings that drive the whole design:

1. **Outlook mobile does not support HTML signatures.** Microsoft's own support answers are consistent on this: the iOS and Android apps use a plain-text signature field and images are dropped or flattened. iOS will sometimes retain pasted rich text, but it breaks on app updates and is not a supported path. So a plain-text variant is a **first-class output of this tool**, not a fallback.
2. **Roaming signatures cover less than people assume.** Signatures roam between classic Outlook for Windows and OWA for Microsoft 365 and Outlook.com mailboxes only. IMAP or POP mailboxes do not roam, and classic Outlook and new Outlook store signatures separately, so a user on both may need to install twice. The app must therefore ship per-platform install steps, not one instruction.
3. **There is an 8 KB ceiling.** Outlook on the web rejects signatures over roughly 8,000 characters of HTML with a "text you typed is too long" error. Gmail's limit is 10,000. So 8 KB is our hard budget and the generated markup has to stay lean.
4. **Base64 images are out.** They inflate the HTML past that 8 KB budget, are ignored or blocked in several Outlook paths, and get flagged by filters. Microsoft's recommendation is public HTTPS image URLs. Every image in this signature is hosted and versioned.

### Consequences, stated plainly

- Table-based layout, inline CSS only. No flexbox, no grid, no CSS classes, no `<style>` block, no background images, no SVG, no web fonts. Word's engine ignores all of it.
- Every `<img>` carries explicit `width` and `height` attributes plus `alt` text and `border="0"`, and is served at 2x for retina.
- Signature width capped at **600px**, the safe maximum for email. The current signature's banner is roughly 1,060px wide, which is why it looks cropped or oversized in some clients.
- Assets are immutable and versioned (`banner-canareef-v1.png`). Classic Outlook copies images into its own store at insertion time, so overwriting a live asset does nothing for existing installs and risks breaking new ones.

---

## 2. Product scope

### v1 builds

- Single-page app, no login, no backend, no database.
- Property selector: Canareef Resort Maldives, and Property B (config-driven, so adding a third is a JSON file and two images).
- Four required fields: Name, Position, Email, Mobile.
- Two optional fields: Direct line (T:), and a per-property toggle for whether to show the reservations email alongside the personal one.
- Live preview that renders the actual signature markup, not an approximation.
- Four outputs, described in section 5.
- Per-platform install instructions with a copy button, shown as accordions so nobody reads five sets they do not need.
- Character-budget indicator that warns when generated HTML approaches 8 KB.

### v1 explicitly does not build

- User accounts, saved signatures, or an admin panel.
- Photo or headshot upload.
- Analytics, click tracking, or banner rotation.
- Automated deployment to mailboxes via PowerShell or Graph. Section 9 notes when that becomes the better answer.
- Gmail, Apple Mail or Thunderbird install guides. The generated HTML works in them, but the docs stay Outlook-only for v1.
- Multi-language UI.

---

## 3. User flow

1. Land on the page. Property selector defaults to Canareef.
2. Fill four fields. Preview updates on every keystroke, debounced.
3. Validation runs inline (section 8). No submit button, no form element.
4. Choose an install path: "I use Outlook on Windows", "on Mac", "in a browser or the PWA", "on my phone".
5. The chosen path reveals its steps and the right copy button for that path.
6. Copy, paste, done. Total time under 90 seconds for a first-time user.

Microcopy stays verb-first and specific: "Copy signature for Outlook", "Download the .htm file", "Copy the mobile version". Not "Submit" or "Generate".

---

## 4. Signature structure

Matching the existing Canareef layout, rebuilt to spec. Outer wrapper 600px, nested tables only.

```
Table A (600px, cellpadding=0, cellspacing=0, border=0, border-collapse:collapse)
├── Row 1
│   ├── Cell: logo, 110px wide, vertical-align: middle
│   │     └── img 90 x 62 (asset 180 x 124)
│   ├── Cell: 20px spacer, font-size 1px, &nbsp;
│   └── Cell: identity + contact block (470px)
│         ├── Name          14px bold
│         ├── Position      11px regular
│         ├── Property      11px regular
│         ├── Rule row      1px high td, bgcolor, font-size 0, line-height 0
│         ├── E: mailto link
│         ├── T: direct line  ·  M: mobile
│         ├── Website link
│         ├── Address line
│         └── Social row: 4 icons, 20 x 20 (assets 40 x 40), 8px gutter cells
├── Row 2 (colspan 3)
│   └── Banner img 600 x 105 (asset 1200 x 210), display:block
└── Row 3 (colspan 3)
      └── Disclaimer, 9px, line-height 12px
```

### Rules the generator must enforce

- `mso-line-height-rule: exactly` on every text cell, and explicit `line-height` in px. Word ignores unitless and percentage line heights.
- Font stack: `'Bahnschrift', 'DIN Alternate', Arial, Helvetica, sans-serif`. Bahnschrift is a Windows-only system font, so Mac, iOS and Android users see Arial. Progressive rather than uniform, which is the right trade here. **Flagged as a decision for you, since it means the signature is not pixel-identical across platforms.**
- Every link gets an explicit inline `color` and `text-decoration` on both the `<a>` and a nested `<span>`. Without the span, Outlook desktop and OWA re-style `mailto:` and `tel:` links to default blue and underline them.
- Phone numbers wrap in `tel:` links with the number in E.164 (`tel:+9606896677`) and the display text formatted for reading.
- The rule under the property name is a 1px `<td>` with `bgcolor`, not a `border-bottom`. Word drops thin borders unpredictably.
- Banner `<img>` gets `style="display:block"` to kill the phantom gap under images in Outlook, plus `width="600" height="105"`.
- No `<div>` for layout, no `margin` on `<td>`, padding only.
- Wrapped in a single outer table with `width="600"` as an attribute **and** in the style, because the two engines read different ones. `max-width` alone is not enough; Word ignores it.
- `white-space: nowrap` on the name, position, property and each contact line, so a narrow reading pane cannot wrap "Junior Reservations Executive" onto two lines and break the vertical rhythm.
- Two escaping helpers, used everywhere: one for text nodes, one for attribute values. Staff type ampersands and apostrophes into position titles, and an unescaped `&` in a `tel:` or `mailto:` breaks the link silently.
- Optional rows are omitted, not left empty. If there is no direct line, the row does not render and the `colspan` on the banner and disclaimer rows recomputes.
- Total output target: under 5 KB, hard fail warning at 7.5 KB.

### Brand rules applied

- The signature is official documentation, so **Canareef Brown `#876432`** only. No Canareef Blue anywhere, including link colours. This is a deliberate change from the current signature, where the email and website links render in default browser blue.
- Logo brown-on-light, minimum size respected, proportions locked by the fixed width/height attributes.
- Dark mode: Outlook on Windows and iOS can invert light backgrounds. Brown on inverted dark is low contrast. Mitigation for v1 is a logo asset with a solid white background rather than transparency, plus explicit `color` on every text node so nothing is left to the client's default. Full dark-mode parity is a v2 item.

### Property B

Everything above comes from a config object. Adding a property means one file and two images, no code changes:

```ts
{
  id: 'property-b',
  name: 'Property Name',
  brandColour: '#RRGGBB',
  linkColour: '#RRGGBB',
  fontStack: "...",
  logo:   { url: '.../logo-v1.png', w: 90, h: 62, alt: '' },
  banner: { url: '.../banner-v1.png', w: 600, h: 105, alt: '' },
  website: { label: 'www.example.com', href: 'https://...' },
  reservationsEmail: 'reservations@...',
  switchboard: '+960 ...',
  address: '...',
  socials: [{ network: 'facebook', href: '...', icon: '.../fb-v1.png' }],
  disclaimer: '...'
}
```

---

## 5. Outputs

Four artefacts from the same data, because the four platforms need different things.

1. **Copy signature (rich).** Primary button. Writes both `text/html` and `text/plain` flavours to the clipboard via the async Clipboard API with `ClipboardItem`. This must copy a **rendered, off-screen DOM node**, not the HTML as a string, or Outlook pastes visible code. Fallback for older Safari and Firefox: select the hidden rendered node with a `Range` and call `document.execCommand('copy')`, then a plain-language failure message if even that throws. The `text/plain` flavour is the purpose-built mobile string from output 4, not the preview's `innerText`, which would drag the whole disclaimer into the plain-text paste. Target: classic Outlook, new Outlook, OWA, PWA, Outlook for Mac.
2. **Download `.htm`.** A complete document with `<meta charset="utf-8">`, for dropping into `%APPDATA%\Microsoft\Signatures` on classic Windows Outlook. Filename from the user's name, for example `Canareef - Jayani Kaushalya.htm`. No `_files` folder needed, since images are hosted.
3. **Copy HTML source.** For you and for IT: pasting into Exchange transport rules, `Set-MailboxMessageConfiguration -SignatureHtml`, or a third-party tool later.
4. **Copy mobile version (plain text).** For Outlook iOS and Android. Structure:

```
Jayani Kaushalya
Junior Reservations Executive
Canareef Resort Maldives
M: +94 778106532 | T: +960 689 6677
reservations@canareef.com | www.canareef.com
```

No pipes-as-decoration beyond that, no ASCII art, no attempt to fake the rule. The app should say in one line why the phone version looks different, so nobody files it as a bug.

---

## 6. Install instructions the app must carry

Short, accurate, per platform. These are content, and getting them wrong generates more support messages than a layout bug would.

- **Classic Outlook for Windows.** File > Options > Mail > Signatures > New, paste, save. Note that if roaming signatures is on, it appears in OWA after a restart. Note that pasting embeds the images into Outlook's local copy, so a later asset change does not reach existing installs.
- **New Outlook for Windows.** Settings > Accounts > Signatures. Note that it does **not** inherit from classic Outlook, since the two store signatures separately.
- **Outlook on the web and the PWA.** Settings > Mail > Compose and reply > signature. Note the 8 KB limit and what the error looks like if a user pastes something else in as well.
- **Outlook for Mac.** Outlook > Settings > Signatures.
- **Outlook mobile.** Profile > Settings > Signature. Use the plain-text output. State plainly that logos and banners are not possible here, and that the mobile signature does not sync from desktop.

---

## 7. Asset hosting

- Static assets on Cloudflare (R2 behind the Pages domain, or `/public` in the repo if size stays small), served over HTTPS, publicly readable with no authentication. SharePoint and OneDrive links break for external recipients, which is a common cause of missing logos.
- Versioned, immutable filenames. Never overwrite.
- PNG for the logo and social icons, JPEG for the banner photo. Under 50 KB per file, banner under 120 KB.
- 2x assets, 1x dimensions in the attributes.
- Long cache headers, since filenames change on update.
- Banner crop needs a fresh export at 1200 x 210 from the original panorama rather than a downscale of the current 1,060px version.

---

## 8. Validation

| Field | Rule | On failure |
|---|---|---|
| Name | Required, 2 to 40 characters, letters, spaces, hyphens, apostrophes | "Add your full name as it should appear to guests." |
| Position | Required, 2 to 45 characters | "That title is longer than the signature can hold on one line." |
| Email | Required, valid format, warns if the domain does not match the property's domain | "That does not look like a @canareef.com address. Use it anyway?" |
| Mobile | Required, digits, spaces, `+`, parentheses; normalised to E.164 for the `tel:` link | "Include the country code, for example +960 or +94." |
| Direct line | Optional, same rules | as above |

Empty state: the preview shows the property's signature with placeholder names in a lighter tone, so people see what they are building before they type. Copy buttons stay disabled until the four required fields validate.

---

## 9. Stack

Matching your settled defaults, and the constraints genuinely fit them:

- **React + Vite + TypeScript**, Tailwind for the app UI only. Never for the signature markup, which is hand-built inline-styled HTML from a template function.
- **shadcn/ui** for form controls, accordions, buttons.
- **No state library.** Four fields and a property selector is `useState`.
- **Cloudflare Pages**, free tier.
- **No backend.** Nothing is stored, nothing is sent, so there is nothing to secure.

One option worth naming and rejecting: a **single self-contained HTML file** with vanilla JS would also do this job, deploys anywhere, and never needs a build step. Rejected because two brands with per-property configs, a live preview, install accordions and clipboard fallbacks is enough surface that you will want components, and because Claude Code maintains a Vite repo more reliably than a 1,200-line HTML file. If the tool stays at two properties and stops changing, the single file would have been the cheaper answer.

### Structure

```
src/
  brands/                 canareef.ts, property-b.ts, types.ts, index.ts
  signature/
    buildHtml.ts          data + brand -> signature HTML string
    buildPlainText.ts     data + brand -> plain text
    buildHtmFile.ts       wraps buildHtml in a full document
    tokens.ts             sizes, weights, line heights
  components/
    SignatureForm.tsx
    Preview.tsx           renders via a sandboxed iframe, so app CSS cannot leak in
    OutputButtons.tsx
    InstallGuide.tsx
  lib/
    clipboard.ts          ClipboardItem + execCommand fallback
    validate.ts
    phone.ts              E.164 normalisation
public/assets/            versioned images
docs/qa-matrix.md
```

`Preview.tsx` rendering inside an iframe matters. If the preview lives in the app DOM, Tailwind's preflight styles bleed into it and you end up trusting a preview that does not match what the clipboard carries.

That creates one wrinkle worth planning for: the `execCommand` clipboard fallback cannot easily select a range inside an iframe's document. So `buildHtml()` is the single source of truth and its output goes to **two** places: the preview iframe, and a hidden off-screen mirror node in the parent document that the clipboard reads from. Both always render the same string, so they cannot drift.

Preview also gets a **light / dark background toggle**, since it costs almost nothing and dark mode is where signatures quietly fall apart.

### Build order

1. Brand config types plus the Canareef config, with real asset URLs.
2. `buildHtml.ts` and `buildPlainText.ts` as pure functions, unit tested against snapshots.
3. Iframe preview.
4. Form and validation.
5. Clipboard with fallback, and the three other outputs.
6. Install guides.
7. Property B config.
8. Real-send QA pass, section 10.
9. Deploy, then one round of fixes from actual staff use.

Steps 1 to 3 before any styling. If the markup is wrong, a nice-looking form is worthless.

---

## 10. QA: this is where the project succeeds or fails

Do not ship on preview screenshots. Signatures have to be **installed and sent**, then read on the receiving end, because Outlook mangles things at insertion time and again at send time.

For each property, install the signature and send a test to a Gmail account, an Outlook.com account and a Canareef mailbox, from:

1. Classic Outlook for Windows
2. New Outlook for Windows
3. Outlook on the web, Chrome
4. Outlook PWA
5. Outlook for Mac
6. Outlook iOS, plain text
7. Outlook Android, plain text

Check each time: images load for external recipients · logo not distorted · rule visible · links the right colour and not underlined blue · no gap under the banner · banner not overflowing on a phone · disclaimer legible · signature survives a reply and a forward · nothing broken in dark mode · under 8 KB when pasted into OWA.

Record results in `docs/qa-matrix.md` with dates and build numbers. When Microsoft ships a rendering regression, and they do, that file tells you whether it is your markup or theirs.

---

## 11. v2 parking lot

- Full dark-mode handling.
- Optional promo banner slot with a start and end date, so the banner can carry a campaign.
- Headshot support.
- Third and fourth properties.
- Per-department presets, so Reservations gets the reservations email and Sales does not.
- PowerShell or Graph export for bulk deployment. This becomes the better path the moment staff turnover means installing 30 signatures rather than 5.
- QR code for the property location or a WhatsApp click-to-chat link.

---

## 12. Assumptions to confirm

1. **Property B is unnamed.** The config schema absorbs it, but I need brand colour, logo, banner, address, website, socials and disclaimer text before it renders.
2. **Link colour moves to brown.** The current signature uses default blue for the email and website. I have specced brown, since a signature counts as official documentation. Say if you want to keep blue.
3. **Bahnschrift only renders on Windows.** Mac and mobile fall back to Arial. The alternative is Arial everywhere for consistency.
4. **Mailboxes are Microsoft 365.** If any property runs IMAP through another provider, roaming signatures do not apply and every device needs a manual install.
5. **The tool is internal but public-URL.** No login, just an unlisted Pages URL shared with staff. Add Cloudflare Access if that is not acceptable.
6. **Banner needs a re-export** at 1200 x 210 from the original file.

---

## 13. Reference implementation: clarkemedia/email-signature-generator

MIT licensed, 167 stars, single 36 KB `index.html`, no build step, live at signatures.clarkemedia.ie. Closest working prior art to this project, so I read the source rather than just the README.

### Take these

1. **The clipboard approach is confirmed.** They do exactly what section 5 specifies: `ClipboardItem` with `text/html` and `text/plain` blobs, then a `Range` selection on a hidden off-screen div plus `execCommand('copy')`, then a human-readable failure message. A shipped tool with real users doing it this way is decent evidence the risk in my pressure-test list is manageable.
2. **Escaping helpers, split by context.** `esc()` for text via a detached element's `textContent`, `escAttr()` for attribute values. Plus `sanitizePhone()` stripping everything but digits and `+` for the `tel:` href, and `addProto` / `stripProto` so a website displays without `https://` but links with it. All four go straight into `lib/`.
3. **Conditional rendering with a recomputed colspan.** Blank field means the row does not exist, and the footer rows' `colspan` is derived from how many columns actually rendered. Cleaner than my original fixed three-column assumption.
4. **`white-space: nowrap` on identity and contact lines.** Small detail, prevents the most common ugly wrap.
5. **The 1px rule as a nested full-width table** with `height="1"`, `bgcolor`, `font-size: 0`, `line-height: 0` and a `&nbsp;`. Independent arrival at the same solution as section 4, which is reassuring. They also run a **vertical** 1px divider between the logo and the text column, which is a better looking option than a horizontal rule for our layout. Worth a side-by-side before deciding.
6. **Their logo field hint says use JPEG with a white or solid background, because transparent PNGs and WebPs can disappear against dark backgrounds.** Independent confirmation of the dark-mode mitigation in section 4, and it settles the format question: no WebP, and the logo asset gets a solid background rather than transparency.
7. **Light and dark preview toggle, and a reset-to-defaults button.** Both cheap, both now in scope.
8. **Their existence validates the single-file option I rejected.** 36 KB of vanilla JS, deployable to GitHub Pages, Docker or any static host. Section 9's rejection stands on the multi-brand and multi-output requirements, not on the approach being wrong.

### Do not copy these

1. **`<p>` tags with `margin` for the identity lines.** The riskiest part of their markup. Word applies its own paragraph spacing and handles margins on `<p>` inconsistently, so this is a likely source of the mysterious extra gaps people report. Our identity lines stay table rows with padding.
2. **Unitless `line-height: 1.5` everywhere.** Word ignores unitless line heights. We use px plus `mso-line-height-rule: exactly`.
3. **`max-width: 600px` with no `width` attribute.** Word ignores `max-width` entirely, so the table renders as wide as its content wants. Their **open issue #2, "logo images are rendered at excessive size in generated signatures", is this class of bug**, and their **open issue #3 is "fonts and their size"**, which is the unitless line-height and font substitution problem. Both are precisely what sections 4 and 10 exist to prevent, and both are a warning that a preview looking right proves nothing.
4. **Base64 logo upload.** They accept a `FileReader` data URL, warn in the hint that it is preview-only, and have base64 encoding on the contributing wishlist. Our research says no: it blows the 8 KB ceiling and is blocked in several Outlook paths. Hosted assets only, and staff never upload an image at all in our tool.
5. **A colour picker and font selector.** Correct for a general-purpose tool, wrong for ours. Brand comes from config; staff cannot change the brown or the font stack. That is a feature.
6. **No `.htm` download and no plain-text mobile output.** The two things our brief specifically demands, absent from the closest comparable tool. That is the gap worth building.
7. **No size budget indicator.** Nothing warns a user before OWA rejects the paste.
8. **No banner image row.** Ours has one, and it is the heaviest, most fragile element in the layout. No prior art to borrow here, so it needs the most test attention.

### One practical option

MIT licence means their `index.html` can be forked as a **throwaway markup harness**: strip the UI, hardcode the Canareef data, install and send it from all seven clients in section 10 in an afternoon. That would validate the table structure before a single line of the real app gets written. Cheaper than discovering a Word rendering problem at step 8.

---

## What I would pressure-test

1. **The clipboard path is less risky than I first thought, but still test it early.** Section 13 shows a live tool doing it exactly as specced, which downgrades this from the biggest risk to a solved pattern. It is still the piece most likely to behave differently on a hotel laptop running an old Edge build, so keep it at step 5 rather than last. If it fails there, the `.htm` download plus "paste into the signature editor" becomes the primary path.
2. **Mobile will be read as a broken feature.** Staff will compare their phone signature to their desktop one and report a bug. The tool needs to say why in plain language at the point of copying, and you may still get asked to "just make it work". It cannot be made to work; that is Microsoft's limitation.
3. **The banner has no prior art.** No comparable open-source generator ships a full-width photographic banner row, so nothing has been battle-tested for us. It is the heaviest asset, the one most likely to be blocked or resized, and the reason the 600px cap matters. Test it first, not last.
4. **The 600px cap changes the look.** The current signature is nearly 1,060px wide, so a correct rebuild will look smaller and tighter than what people are used to. Worth showing a before-and-after to whoever signs off, before rollout rather than after.
