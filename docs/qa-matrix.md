# QA matrix

Do not sign off on preview screenshots. Outlook mangles signatures at insertion
time and again at send time, so every row means: install the signature, send a
real message, then read it on the receiving end.

For each client, send to a Gmail account, an Outlook.com account and a property
mailbox. Record date and the commit SHA of the build tested.

## Checks per send

| # | Check |
|---|---|
| 1 | Images load for external recipients (not just internally) |
| 2 | Logo not distorted or resized |
| 3 | Rule under the property name visible |
| 4 | Links brown, not blue, and not underlined |
| 5 | No phantom gap under the banner |
| 6 | Banner not overflowing on a phone screen |
| 7 | Disclaimer legible |
| 8 | Survives a reply |
| 9 | Survives a forward |
| 10 | Nothing broken in dark mode |
| 11 | Under 8 KB when pasted into Outlook on the web |
| 12 | Social icons render in the brand colour, not black or missing |

## Results

| Client | Date | Build | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Classic Outlook, Windows | | | | | | | | | | | | | | | |
| New Outlook, Windows | | | | | | | | | | | | | | | |
| Outlook on the web, Chrome | | | | | | | | | | | | | | | |
| Outlook PWA | | | | | | | | | | | | | | | |
| Outlook for Mac | | | | | | | | | | | | | | | |
| Outlook iOS (plain text) | | | | | | | | | | | | | | | |
| Outlook Android (plain text) | | | | | | | | | | | | | | | |

## Known open items

- **Logos are real.** Built from the masters in the repo root by
  `tools/make-logos.py`, which trims the transparent margin, flattens onto solid
  white and saves JPEG at 2x. Re-run it if a master changes.
- **The banner is still a placeholder.** `assets/banner-canareef-v1.jpg` is a
  generated gradient. It needs an 850 x 150 export from the original panorama
  before QA on the banner row means anything, and the banner row is the heaviest
  and least battle-tested element in the layout.
- **The banner is not a true 2x asset.** 850 x 150 displayed at 600 x 106 is
  1.42x, so it will look slightly soft on retina screens where every other image
  is sharp. A 1200 x 212 export would fix it at roughly double the file size.
  Check row 2 of the matrix on a retina Mac before deciding it matters.
- **Palmscape Boutique Hotel is a draft.** Logo, brand green `#2a5e50`, its icon
  set and the address are all confirmed. Still outstanding: website, reservations
  address, disclaimer text and social handles. The social row is deliberately omitted until real handles
  exist. The app shows a warning banner while a property carries a `draft` note,
  so nobody installs it by accident.
- **Asset domain not final.** Asset URLs are baked into every installed
  signature. Until `ASSET_BASE` in `index.html` points at a permanent domain,
  every signature installed is one host change away from broken images.
- **Dark mode.** Brown on an inverted dark background is low contrast, and the
  9px disclaimer is the worst of it. The white-background logo mitigation works.
  Full dark-mode parity is a v2 item.
- **Signature size is 6.3 KB**, not the PRD's 5 KB target. See the note in
  `test.mjs` for why the target is not reachable with the mandated inline rules.
  It is inside the 7.5 KB warn line and the 8 KB hard limit.
