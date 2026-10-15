# Nocturne Cathedral Tarot

An original 78-card Gothic Tarot for The Cat Priestess: 22 Major Arcana and four 14-card suits (Wands, Cups, Swords, Pentacles). The shared reversible back uses mirrored cats and a celestial rose window. The visual vocabulary is moonlit Gothic architecture, silver and antique gold ornament, expressive figures, and symbolic animals. Art is original AI-assisted illustration created for this collection, without external artist references or copied illustration assets.

The original 34-card IVOSART oracle remains the default reading collection. Its artwork, card content, 34 individual routes, Bastet API, printing interface, and eight downloadable PDFs are preserved. `/decks` introduces both collections; `/decks/gothic` has a dedicated searchable/filterable gallery and 78 static card pages. The original `/deck` and `/deck/print.html` routes keep their identity.

## Data and extension

`decks/registry.js` validates and freezes deck specifications and draws without replacement. `index.html` registers the unchanged original data; `decks/gothic/cards.js` registers the new theme before the reader initializes. The selection drives artwork, matching back, card URLs, meaning text, interpretation composition, and share output for all three spreads. Unknown/unready deck parameters fall back to the original. The daily homepage feature deliberately remains the original oracle.

To add a theme, load another registration before the reader script. Supply a unique id, name, gallery route, back image, and card array. Each card needs a name, upright/reversed meanings and an affirmation array; supply its unique id, image, alt text, optional number, suit, keywords, and reflection question. The reader uses a generic illustrated face and card-based interpretation for additional collections. Numeric card IDs are local to their deck; the Fool's zero is preserved.

`decks/gothic/content.json` is the editorial source. Run `python3 scripts/build-gothic.py --ready` to regenerate the public registration, static galleries, descriptions, and sitemap after all 79 images exist. A build without `--ready` creates a development checkpoint and disables drawing the unfinished theme. `python3 scripts/gothic-artwork-manifest.py` decodes the publication images and updates their dimensions, hashes, and finished/pending status. `docs/gothic-artwork.json` is the publication manifest. Generation source files and alternates are private intermediates and are not shipped with the site.

## Reading and access

Native spread buttons, a labelled deck selector, a keyboard-operated reversal switch, and keyboard-operable card reveal/open actions support the reading flow. Unrevealed meanings stay hidden from assistive technology. Focus moves to the reading title and returns to the selector on New Reading. Questions are escaped before entering generated interpretation markup. Missing Gothic images receive an explicit unavailable label rather than a decorative illustration presented as finished art.

The gallery and every card interpretation are static HTML. JavaScript enhances suit/search filters and announces counts. Small-screen breakpoints use two gallery columns, a single-column detail layout and wrapping navigation; controls have 44px minimum targets. Reduced-motion preferences suppress animation. CSS fonts have local serif fallbacks. No new tracking or API is added.

The service worker cache version changes to avoid stale application code. Its core includes both deck registrations and the new gallery styles/scripts/back. Original faces are warmed as before. Gothic faces are cached as encountered; a completely offline installation is not promised to have all 78 Gothic faces.

## Verification

Python 3 with Pillow is required for image decoding. Install pinned Node dependencies with `npm ci --prefix tests`, then run `npm run --prefix tests test:decks`. The suite checks 78 identities and interpretations, 22/56 suit structure, image decoding, unique image hashes, static routes, sitemap entries, preservation hashes for original assets and source data, and 2,000 five-card draws. JSDOM integration covers both collections × one/three/five cards, reversals, selection changes, keyboard reveal, sharing including rotated Gothic art, question escaping, mocked Bastet chat requests, and gallery search/filter states. `test:deck-source` exercises integration before the remaining art is ready; it does not certify finished assets.

Native browser visual testing was unavailable in the managed build environment. Responsive CSS and DOM behavior are checked, but this is not a substitute for a visual review on physical devices. Existing print/browser tests remain intact; no browser binary is installed as part of these changes.

After deployment, run `python3 tests/verify-production.py` for a read-only HTTP/content-hash check of new routes and artwork plus the preserved original cards and eight PDFs. This checks served bytes, not browser rendering.
