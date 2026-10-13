/* Publish only PDFs produced by a successful verification of the current source. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PDFDocument, PrintScaling, Duplex } = require('pdf-lib');
const { checkPdf, expectedPages } = require('./verify-print.cjs');
const root = path.resolve(__dirname, '..');
const input = path.join(__dirname, 'output');
const destination = path.join(root, 'deck/downloads');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const verified = JSON.parse(await fs.readFile(path.join(input, 'verification.json'), 'utf8'));
  for (const entry of verified.sourceFiles) {
    assert.equal(hash(await fs.readFile(path.join(root, entry.file))), entry.sha256, `${entry.file} changed since verification; run build:pdf again`);
  }
  const pending = [];
  for (const paper of ['letter', 'a4']) for (const flip of ['long', 'short']) for (const test of [false, true]) {
    const original = `${paper}-${flip}-${test ? 'test' : 'duplex'}.pdf`;
    const bytes = await fs.readFile(path.join(input, original));
    assert.equal(hash(bytes), verified.pdfs.find(entry => entry.file === original)?.sha256, `${original} is not the verified output`);
    const pdf = await PDFDocument.load(bytes);
    pdf.setTitle(`The Cat Priestess - ${paper === 'letter' ? 'US Letter' : 'A4'} - ${flip}-edge duplex${test ? ' - First-sheet calibration' : ' - Full 34-card deck'}`);
    pdf.setAuthor('IVOSART');
    pdf.setSubject('Print portrait at 100% / actual size, one page per sheet. Match the named duplex edge. Measure the 50 mm calibration line before printing card stock.');
    pdf.setKeywords(['The Cat Priestess', 'IVOSART', 'tarot', 'printable cards', '60 x 90 mm', `${flip}-edge duplex`]);
    const preferences = pdf.catalog.getOrCreateViewerPreferences();
    preferences.setPrintScaling(PrintScaling.None);
    preferences.setDuplex(flip === 'long' ? Duplex.DuplexFlipLongEdge : Duplex.DuplexFlipShortEdge);
    const result = await pdf.save();
    await checkPdf(result, paper, expectedPages(flip, 'duplex', test));
    const final = await PDFDocument.load(result);
    assert.equal(final.catalog.getOrCreateViewerPreferences().getPrintScaling(), PrintScaling.None);
    assert.equal(final.catalog.getOrCreateViewerPreferences().getDuplex(), flip === 'long' ? Duplex.DuplexFlipLongEdge : Duplex.DuplexFlipShortEdge);
    pending.push({ file: `cat-priestess-${paper}-${flip}-edge${test ? '-calibration' : ''}.pdf`, bytes: result });
  }
  await fs.mkdir(destination, { recursive: true });
  for (const entry of pending) await fs.writeFile(path.join(destination, entry.file), entry.bytes);
  console.log(`PASS: published ${pending.length} verified PDFs with actual-size and duplex preferences to deck/downloads/`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
