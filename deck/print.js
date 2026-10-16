/* No build step or external services. All artwork is used as-is. */
(() => {
  'use strict';
  const requiredDeck = document.body.dataset.deck;
  if (requiredDeck && window.PrintDeck?.id !== requiredDeck) {
    const status = document.getElementById('asset-status');
    status.classList.add('error');
    status.textContent = 'This collection could not load. Reload the page before printing.';
    return;
  }
  // A collection supplies its own ordered artwork; the original oracle stays the default.
  const deck = window.PrintDeck || {
    id: 'ivosart-oracle', name: 'The Cat Priestess', back: '/cards/back.webp',
    cards: Array.from({ length: 34 }, (_, index) => {
      const id = String(index + 5).padStart(2, '0');
      return { id, name: `Card ${id}`, image: `/cards/${id}.webp`, label: id };
    })
  };
  const cardIds = deck.cards.map(card => card.id);
  const cards = new Map(deck.cards.map(card => [card.id, card]));
  const sheetCount = Math.ceil(cardIds.length / 6);
  const sources = [...deck.cards.map(card => card.image), deck.back];
  const byId = id => document.getElementById(id);
  const form = byId('print-options');
  const output = byId('print-sheets');
  const preview = byId('preview-canvas');
  const picker = byId('preview-page');
  const printButton = byId('print-button');
  const status = byId('asset-status');
  let pages = [];
  let generation = 0;

  function svg(className, viewBox, pathData) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    element.setAttribute('class', className);
    element.setAttribute('viewBox', viewBox);
    element.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(element.namespaceURI, 'path');
    path.setAttribute('d', pathData);
    element.append(path);
    return element;
  }

  function makeSheet(ids, number, side, flip, paper) {
    const sheet = document.createElement('article');
    sheet.className = 'sheet print-sheet';
    sheet.dataset.sheet = number;
    sheet.dataset.side = side;
    const label = `Sheet ${number} of ${sheetCount} · ${side === 'front' ? 'FRONT' : 'BACK'} · Cards ${cards.get(ids[0]).label}–${cards.get(ids[ids.length - 1]).label}`;
    sheet.dataset.label = label;
    const top = document.createElement('div');
    top.className = 'sheet-top';
    top.textContent = `↑ TOP · ${side.toUpperCase()} · ${flip.toUpperCase()}-EDGE FLIP`;
    sheet.append(top);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    // Always reserve all six slots. Mirror the positions, never the artwork.
    const slots = Array(6).fill(null);
    ids.forEach((id, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const slot = side === 'front' ? index : flip === 'long' ? row * 3 + (2 - column) : (1 - row) * 3 + column;
      slots[slot] = id;
    });
    slots.forEach(id => {
      const card = document.createElement('div');
      card.className = id ? 'card' : 'card empty';
      card.dataset.card = id || '';
      if (id) {
        const image = document.createElement('img');
        image.src = side === 'front' ? cards.get(id).image : deck.back;
        image.alt = side === 'front' ? cards.get(id).name : `Back of ${cards.get(id).name}`;
        image.loading = 'eager';
        card.append(image, svg('cut-guides', '0 0 64 94',
          'M0 2H1.5 M2 0V1.5 M62.5 2H64 M62 0V1.5 M0 92H1.5 M2 92.5V94 M62.5 92H64 M62 92.5V94'));
      }
      grid.append(card);
    });
    sheet.append(grid);
    const footer = document.createElement('div');
    footer.className = 'sheet-footer';
    footer.append(document.createTextNode(`${deck.name} · ${label} · ${paper === 'a4' ? 'A4' : 'US Letter'}`));
    footer.append(document.createElement('br'), document.createTextNode('100% / actual size · Cut size 60 × 90 mm · Calibration line: 50 mm'));
    footer.append(svg('calibration', '0 0 50 3', 'M0 0V3 M0 1.5H50 M50 0V3'));
    sheet.append(footer);
    return sheet;
  }

  function scalePreview() {
    if (!preview.firstElementChild) return;
    const sheet = preview.firstElementChild;
    const scale = byId('preview-stage').clientWidth / sheet.offsetWidth;
    preview.style.transform = `scale(${scale})`;
    byId('preview-stage').style.height = `${sheet.offsetHeight * scale}px`;
  }

  function showPreview() {
    const index = Number(picker.value);
    preview.replaceChildren(pages[index].cloneNode(true));
    byId('previous').disabled = index === 0;
    byId('next').disabled = index === pages.length - 1;
    scalePreview();
  }

  async function verifyImages(currentGeneration) {
    const results = await Promise.all(sources.map(async src => {
      const image = new Image();
      image.src = src;
      try {
        await image.decode();
        return null;
      } catch {
        return src;
      }
    }));
    // Wait for the actual print elements, too, including repeated back images.
    const rendered = await Promise.all([...output.querySelectorAll('img')].map(image => image.decode().then(() => null, () => image.getAttribute('src'))));
    if (currentGeneration !== generation) return;
    const failures = [...new Set([...results, ...rendered].filter(Boolean))];
    const ready = failures.length === 0;
    document.body.dataset.ready = String(ready);
    printButton.disabled = !ready;
    status.classList.toggle('error', !ready);
    status.textContent = ready ? `All ${sources.length} artwork files loaded. Ready to print.` : `Unable to load: ${failures.join(', ')}. Printing is paused; retry when the files are available.`;
    byId('retry').hidden = ready;
  }

  function render() {
    generation += 1;
    document.body.dataset.ready = 'false';
    printButton.disabled = true;
    status.classList.remove('error');
    status.textContent = `Checking all ${sources.length} artwork files…`;
    byId('retry').hidden = true;
    const paper = byId('paper').value;
    const sides = byId('sides').value;
    const flip = byId('flip').value;
    const test = byId('test-sheet').checked;
    document.body.dataset.paper = paper;
    byId('paper-rule').textContent = `@page { size: ${paper === 'a4' ? 'A4' : 'Letter'} portrait; margin: 0; }`;
    byId('back-order-field').hidden = sides !== 'backs';
    byId('duplex-help').textContent = sides === 'duplex'
      ? `Enable two-sided printing and flip on the ${flip} edge. Sheets alternate front, back, front, back.`
      : `Use one-sided printing for this pass. ${sides === 'backs' ? 'Match back sheet numbers with the front sheets already printed.' : 'Front sheets print in ascending card order.'} Reinsert the paper for a ${flip}-edge turn if printing a second pass.`;

    pages = [];
    for (let index = 0; index < (test ? 1 : sheetCount); index += 1) {
      const ids = cardIds.slice(index * 6, index * 6 + 6);
      if (sides !== 'backs') pages.push(makeSheet(ids, index + 1, 'front', flip, paper));
      if (sides !== 'fronts') pages.push(makeSheet(ids, index + 1, 'back', flip, paper));
    }
    if (sides === 'backs' && byId('back-order').value === 'reverse') pages.reverse();
    output.replaceChildren(...pages);
    picker.replaceChildren(...pages.map((page, index) => new Option(`${index + 1}. ${page.dataset.label}`, String(index))));
    picker.value = '0';
    const physicalSheets = test ? 1 : sheetCount;
    byId('job-summary').textContent = `${test ? '6 test cards' : `${cardIds.length} cards`} · ${pages.length} printed pages · ${physicalSheets} ${sides === 'duplex' ? 'double-sided sheets' : 'sheets in this pass'} · ${paper === 'a4' ? 'A4' : 'US Letter'}`;
    showPreview();
    verifyImages(generation);
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', render);
  picker.addEventListener('change', showPreview);
  byId('previous').addEventListener('click', () => { picker.selectedIndex -= 1; showPreview(); });
  byId('next').addEventListener('click', () => { picker.selectedIndex += 1; showPreview(); });
  byId('retry').addEventListener('click', render);
  printButton.addEventListener('click', () => {
    if (document.body.dataset.ready === 'true') window.print();
  });
  window.addEventListener('beforeprint', () => {
    // Native Ctrl/Cmd+P must not silently print partially loaded artwork.
    if ([...output.querySelectorAll('img')].some(image => !image.complete || !image.naturalWidth)) {
      document.body.dataset.ready = 'false';
      printButton.disabled = true;
    }
  });
  new ResizeObserver(scalePreview).observe(byId('preview-stage'));
  byId('back-order').options[0].textContent = `Sheet 1 → ${sheetCount}`;
  byId('back-order').options[1].textContent = `Sheet ${sheetCount} → 1`;
  render();
})();
