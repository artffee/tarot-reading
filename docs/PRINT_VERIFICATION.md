# Printable Cat Priestess release verification

Verified locally on 2026-10-13 UTC using Playwright 1.62.1, Chromium
153.0.8010.0, pdf-lib 1.17.1, PyMuPDF 1.26.6, and Pillow 12.3.0.

## Scope

This release starts from `main` at
`aa500d33f0436f202e8e0dc9f72c225b8d64d3b2` and reuses the existing print
implementation from PR #1, `codex/temple-shop-products` at
`f197d9e1b7977771ac4971840d1445522a3a3ee0`.

The Temple Shop, launch lists, subscriber segmentation, export/broadcast
changes, and related privacy changes in PR #1 were reviewed for release scope
and excluded. PR #1 remains separate. The print gallery link and home footer
link expose the printing edition; the sitemap includes `/deck/print`; the
service-worker cache version is refreshed. Tests and this report are excluded
from production hosting.

## Completed checks

- All 35 artwork files are byte-identical to `main`: `05.webp` through
  `38.webp` and `back.webp`.
- The original Chromium verification suite was executed successfully before
  extending its calibration coverage.
- The updated suite passed all 12 paper/edge/side combinations: Letter/A4,
  long/short edge, and duplex/fronts/backs. Four first-sheet duplex PDFs passed
  the same page-size, artwork-count, and actual-PDF-placement checks.
- Each full duplex job has 12 pages and six physical sheets. Sheet 6 has four
  fronts and four correctly mirrored back positions, with two empty slots.
- Reverse manual-back order, preview navigation, the print action, failed-image
  blocking and retry, and the no-JavaScript print warning passed. Layouts at
  320, 390, and 768 px passed the horizontal-overflow check.
- The eight downloadable editions passed verification after PDF metadata was
  added. PDF viewer preferences request actual size and the named duplex edge;
  printer dialogs can override them.
- Independent PyMuPDF/Pillow inspection covered all 56 released pages and 320
  image placements. Every embedded image preserves the exact original decoded
  RGB pixels, source resolution, and aspect ratio. Image transforms are upright
  and unmirrored.
- All vector cut guides were measured: nominal 60 x 90 mm trims, 4 mm gutters,
  1.5 mm marks ending 0.5 mm outside the trim, and 0.18 mm stroke widths. The
  outermost marks stay at least 8.9 mm inside the paper edge.
- Every nominal 50 mm calibration line was measured within 0.15 mm in the PDF.
  Trim rectangles on opposite sides coincide after reflection across the
  selected duplex edge, within 0.15 mm. Nominal 2 mm artwork borders allow
  0.1 mm for Chromium's PDF-coordinate rounding.
- Print sheets contain no setup form, screen preview, or download links. Direct
  HTML links cover all eight downloads and work without JavaScript.
- Rasterized first and final front/back pages for all four editions were
  visually inspected, together with a detailed Letter front and the mobile
  print page. No clipping, missing artwork, extra pages, or overlapping guides
  were observed.

The full-resolution PDFs are approximately 81 MiB per full deck and 16 MiB per
calibration pair. No image downsampling or additional lossy compression is used.

## Reproduction

Install the pinned Node test dependencies with `npm ci --prefix tests`, install
Chromium with `cd tests && npx playwright install --with-deps chromium`, and
install Python's PyMuPDF and Pillow. Then, from the repository root:

```sh
npm run build:pdf --prefix tests
```

An existing browser binary may be supplied using `CHROMIUM_PATH`. The successful
local run used the runtime-owned Node dependencies and a packaged headless
Chromium binary because the managed browser download returned an invalid ZIP.

The build records current source and test-PDF SHA-256 hashes, refuses stale
inputs, adds print preferences, verifies the postprocessed PDFs again, and runs
the independent pixel/vector inspection. Intermediate PDFs, screenshots, and
hash reports are kept in ignored `tests/output/`. The branch-scoped GitHub
workflow repeats this build and commits only verified PDF files to the printing
release branch. It does not run on other branches or merge PR #1.

## Real paper checks still required

Software verification does not establish a physical printer's registration.
Before printing all six sheets on card stock:

1. Download the first-sheet calibration PDF for the intended paper and edge.
2. Print on plain paper at 100% / actual size, portrait, one page per sheet,
   with duplex enabled and the named edge. Disable fit-to-page, booklet,
   multiple pages per sheet, extra margins, and printer-side reverse ordering.
3. Measure the 50 mm line with a ruler. Verify a cut rectangle measures
   60 x 90 mm.
4. Hold the sheet to the light. Check that front/back corner guides coincide
   and the backs have the intended orientation when turned on the selected
   edge. Cut a sample before committing to the full deck.
5. For manual duplex, establish face-up/face-down feeding and front/back sheet
   order with the first sheet; these vary by printer.
6. Confirm the printer accepts the chosen stock and that feeding, ink drying,
   color, and front/back offset are acceptable. These have not been physically
   tested here.
