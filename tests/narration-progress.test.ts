import assert from 'node:assert/strict';
import test from 'node:test';
import {
  narrationChunks,
  narrationWords,
  wordAtCharacter,
  wordAtTime,
} from '../src/lib/narration-progress.ts';

test('spoken words retain exact accented text offsets and highlight within the active audio chunk', () => {
  const text = 'La niebla.\n\n¿Dónde está Sira?';
  const words = narrationWords(text);
  assert.deepEqual(
    words.map((w) => w.text),
    ['La', 'niebla.', '¿Dónde', 'está', 'Sira?'],
  );
  assert.equal(words[2].start, 12);
  assert.equal(wordAtCharacter(text, 19), 3);
  assert.equal(wordAtTime(text, 0, 10), 0);
  assert.equal(wordAtTime(text, 9.999, 10), 4);
  assert.equal(wordAtTime(text, 4, 0), -1);
});
test('clock progress is repeatable at pause/resume and a new chunk preserves global word index', () => {
  assert.equal(wordAtTime('Uno dos tres cuatro', 2, 8), 1);
  assert.equal(wordAtTime('Uno dos tres cuatro', 2, 8), 1);
  assert.equal(wordAtTime('Uno dos tres cuatro', 4, 8), 2);
  const text = 'La campana suena. '.repeat(160),
    chunks = narrationChunks(text);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[1].firstWord, narrationWords(chunks[0].text).length);
  assert.equal(chunks.map((c) => c.text).join(' '), text.trim());
});
