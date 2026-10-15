# The Cat Priestess — Tarot & Oracle

A dark, luxe online tarot reading site with an AI oracle named **Bastet**.
Live at **https://www.thecatpriestess.com**

She does not predict — she reflects.

## Features
- **Free readings** — Daily Draw, Past · Present · Path, and a five-card Inner Journey.
- **Original 34-card oracle** (art by IVOSART), the default collection, with a gallery at `/deck` and a page for every card.
- **Nocturne Cathedral Tarot** — 78 original AI-assisted Gothic illustrations, a reversible matching back, upright/reversed interpretations, and a searchable gallery at `/decks/gothic`. Choose either collection in the reader; both support all three spreads. Browse collections at `/decks`.
- **Printable deck** at `/deck/print` with Letter/A4 PDFs, both duplex edges, and first-sheet calibration downloads.
- **"Bastet Speaks"** written interpretations, plus a live **AI chat oracle** (Google Gemini via a Vercel serverless function, with Groq / Anthropic / OpenAI fallbacks).
- **Installable PWA** with offline support (service worker).
- **SEO** — structured data (JSON-LD), sitemap, robots, FAQ; Google Analytics.
- **Ko-fi donations** and a **Contact / Book a Reading** page.

## Stack
- Static **HTML / CSS / JS** — no framework, no build step.
- **Vercel** hosting + one serverless function (`/api/bastet`).
- Card art optimized to **WebP**.

## Project layout
```
index.html            # home: hero, reading tool, FAQ, Bastet chat
about.html            # /about — the myth, the deck, the maker
contact.html          # /contact — booking + message form
deck/                 # /deck gallery + 34 per-card pages
decks/               # collection index and extensible deck registry
decks/gothic/        # 78-card content, static gallery and card descriptions
cards/gothic/        # 78 original Gothic fronts and matching reversible back
scripts/             # deterministic static gallery/data build and art manifest
docs/NOCTURNE.md     # deck architecture, provenance, access, verification
deck/print.*          # printable deck setup, preview, and physical layout
deck/downloads/       # 8 verified full-deck / first-sheet PDFs
tests/                # deck integration / preservation / deployment checks and print tools
api/bastet.js         # AI oracle endpoint (reads GEMINI_API_KEY etc.)
cards/                # card art (WebP) + card back
icons/                # PWA icons
sw.js                 # service worker (offline)
manifest.webmanifest  # PWA manifest
sitemap.xml, robots.txt
vercel.json           # clean URLs + headers
```

## Develop & deploy
- It's a static site with root-relative assets. Serve the repository over HTTP from its root; opening `index.html` with `file://` is not supported.
- Deploy: `vercel --prod`
- **Bastet AI** requires an API key set as a Vercel environment variable
  (`GEMINI_API_KEY`, or `GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`).
  Without one, Bastet falls back to graceful in-character canned replies.

## Printing the deck

Open **Print the Deck** from the gallery, or visit `/deck/print` on Vercel.
For local use, serve the repository with `python3 -m http.server 8000` and open
`http://localhost:8000/deck/print.html`. The print page uses root-relative artwork
URLs and needs an HTTP server; opening this page with `file://` is not supported.

- Select **US Letter** (215.9 × 279.4 mm) or **A4** (210 × 297 mm). Both use
  portrait orientation and the same **60 × 90 mm** cut size.
- There are **six cards per sheet** (three columns, two rows), in filename order
  `05.webp` through `38.webp`. Six physical sheets make the 34-card deck.
- The default **fronts + backs** job has **12 pages**: front 1, back 1, front 2,
  back 2, …, front 6, back 6. Enable automatic duplex and select the same flip
  edge in the page controls and the printer dialog (default: **long edge**).
- For manual duplex, print **fronts only**, reinsert the stack, then **backs only**.
  Each pass has six pages. Match the printed sheet numbers; use reversed back
  order (6 → 1) only if your printer feeds the last front sheet first. Feed face
  and stack orientation depend on the printer. Test with plain paper first.
- **First sheet only** produces a one-sheet alignment test: two pages for
  duplex, or one page for either single-side pass. It always uses sheet 1.
- Print at **100% / actual size**, portrait, one page per sheet, no browser
  headers/footers and no extra margins. Do not choose fit-to-page, booklet,
  multiple pages per sheet, or printer-side reverse order. Match the paper size
  in the printer dialog. You can also use **Save as PDF** at these settings.
- Measure the **50 mm** calibration line. Hold a test sheet to the light to
  check front/back registration before printing the full deck on suitable stock.
  Browser/PDF tests cannot guarantee a physical printer's registration accuracy.

### Artwork and cutting

The original 35 WebP files are loaded directly; none are resized, rewritten, or
cropped in the repository. Each is rendered with `object-fit: contain` inside a
56 × 86 mm area, giving at least a **2 mm white border** inside the cut line.
Fronts are 1000 × 1500/1502 px; the back is 1024 × 1450 px, so the back has more
white space above and below. This is deliberate: the complete artwork stays
visible and every cut card has the same dimensions. This is a home-print layout
with white borders, not a full-bleed commercial press file.

Cards have **4 mm gutters**. Black corner marks sit outside the card, with a
0.5 mm gap before each mark. The outermost marks are at least **9 mm** from the
paper edge on either supported paper size. Cut between the opposing marks;
sheet labels, the top arrow, and the calibration line lie in the discarded area.
The artwork and guides print even with background graphics disabled.

### Sheet order and duplex alignment

| Sheet | Front filenames, row-major | Duplex PDF pages |
| --- | --- | --- |
| 1 | 05–10 | 1 front, 2 back |
| 2 | 11–16 | 3 front, 4 back |
| 3 | 17–22 | 5 front, 6 back |
| 4 | 23–28 | 7 front, 8 back |
| 5 | 29–34 | 9 front, 10 back |
| 6 | 35–38, two empty positions | 11 front, 12 back |

The back artwork itself is never mirrored. **Long-edge** mode reverses the
columns; **short-edge** mode reverses the rows. All six positions are retained,
including the two empty positions on the last sheet. For example:

| Sheet 6 side | Top row | Bottom row |
| --- | --- | --- |
| Front | 35, 36, 37 | 38, empty, empty |
| Back, long-edge | back for 37, 36, 35 | empty, empty, back for 38 |
| Back, short-edge | back for 38, empty, empty | back for 35, 36, 37 |

The screen preview, controls, and instructions are separate from the print
output and hidden by `@media print`. Each print sheet has an explicit physical
size and page break, with no trailing break after the last sheet. All 35 artwork
files must decode successfully before printing is enabled. Native Ctrl/Cmd+P
while loading, on a failed image, or without JavaScript prints an explanatory
warning instead of an incomplete deck. This page requires a successful network
load; it does not promise offline printing.

### Print regression checks

Use Node.js 20 or later. Test dependencies live under `tests/` and do not change
the static site's production stack:

```sh
npm ci --prefix tests
cd tests
npx playwright install chromium
npm test
```

The test starts and stops its own local server. To use an existing Chromium
binary, set `CHROMIUM_PATH=/absolute/path/to/chromium` when running `npm test`.
Generated test PDFs and screenshots stay in the ignored `tests/output/` directory.

Checks cover all 35 original image URLs and exact file bytes; Letter/A4 PDF page
sizes; all front/back/duplex modes and both flip edges; card counts on each PDF
page (including the final partial sheet); no trailing blank or split pages;
reverse back order; first-sheet tests for both flip edges; cut sizes, margins and contained artwork;
actual artwork dimensions and slot positions inside the PDFs (to catch browser
shrink-to-fit, not just CSS layout errors);
hidden screen UI in print; mobile widths; preview navigation and print action;
missing-image blocking/retry; and the no-JavaScript print guard. Review the
generated PDFs in a PDF viewer and print the one-sheet test before a full run.

### Downloadable editions

The print page also links directly to eight PDFs under `deck/downloads/`, so a
visitor can download an edition without JavaScript. Each paper size has a full
12-page deck and a two-page first-sheet calibration PDF for **each** duplex edge.
The files carry actual-size (`PrintScaling: None`) and matching duplex viewer
preferences; printer dialogs may override these, so still set 100% and the
named edge explicitly.

| Paper / edge | Full deck | First-sheet calibration |
| --- | --- | --- |
| US Letter / long | `cat-priestess-letter-long-edge.pdf` | `cat-priestess-letter-long-edge-calibration.pdf` |
| US Letter / short | `cat-priestess-letter-short-edge.pdf` | `cat-priestess-letter-short-edge-calibration.pdf` |
| A4 / long | `cat-priestess-a4-long-edge.pdf` | `cat-priestess-a4-long-edge-calibration.pdf` |
| A4 / short | `cat-priestess-a4-short-edge.pdf` | `cat-priestess-a4-short-edge-calibration.pdf` |

To rebuild the download editions, install the test dependencies and Chromium
as above. Python 3 with PyMuPDF and Pillow is also required for independent
artwork and vector-geometry inspection (`python3 -m pip install pymupdf pillow`).
From the repository root run:

```sh
npm run build:pdf --prefix tests
```

The build runs the Chromium suite first, records source/output SHA-256 hashes,
and refuses to publish stale outputs. Metadata processing is followed by another
PDF geometry check. The Python pass independently checks all 56 released pages:
320 artwork placements have the exact decoded RGB pixels of their original WebP
files; images are upright and unmirrored; every cut guide is measured; every
50 mm calibration line is measured; mirrored trim rectangles coincide for both
edges; and all eight direct download links exist. See
`docs/PRINT_VERIFICATION.md` for the release evidence and the physical checks
still required. Development checks and reports are excluded from Vercel via
`.vercelignore`.

## Credit
Deck artwork and site by **IVOSART** — an independent artist working between Sofia and Florida.

## Gothic collection and checks

The IVOSART oracle and its eight printable PDFs remain separate from Nocturne Cathedral Tarot. The Gothic collection adds no replacements to the original card art or print assets. Artwork completion, dimensions and SHA-256 hashes are recorded in `docs/gothic-artwork.json`; all 78 fronts and the back are finished illustrations.

Edit `decks/gothic/content.json`, then run `python3 scripts/build-gothic.py --ready` to regenerate the committed static pages, card registration and sitemap. See [the Nocturne guide](docs/NOCTURNE.md) for adding future collections and the visual-testing limitation.

With Python 3, Pillow and Node available, run:

```sh
npm ci --prefix tests
npm run --prefix tests test:decks
```

After publishing, `python3 tests/verify-production.py` makes read-only requests to the public website and verifies the served pages, artwork, original cards, and printable downloads against the local files. It does not send chat requests or submit forms.
