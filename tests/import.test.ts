import assert from 'node:assert/strict';
import test from 'node:test';

import { parseQuickImport } from '../src/lib/domain/import/parser.ts';

test('rychlý import načte rourku, tabulátor i středník', () => {
  const source = [
    '# němčina na test',
    'der Hund | pes | die Hunde | zvířata, A1',
    'lernen\tučit se\t\tslovesa, a1',
    'schön;hezký;;vlastnosti',
  ].join('\n');

  const result = parseQuickImport(source);

  assert.equal(result.notes.length, 3);
  assert.equal(result.issues.length, 0);
  assert.equal(result.ignoredLines, 1);
  assert.equal(result.notes[0].german, 'Hund');
  assert.equal(result.notes[0].normalizedGerman, 'der:hund');
  assert.equal(result.notes[0].czech, 'pes');
  assert.equal(result.notes[0].kind, 'noun');
  assert.equal(result.notes[0].article, 'der');
  assert.equal(result.notes[0].plural, 'die Hunde');
  assert.deepEqual(result.notes[0].tags, ['zvířata', 'a1']);
  assert.equal(result.notes[0].source, 'import');
  assert.equal(result.notes[1].kind, 'verb');
});

test('explicitní TSV a pipe oddělovač má přednost před čárkami ve významu', () => {
  const result = parseQuickImport(
    ['lernen\tučit se, studovat, naučit se', 'heftig | prudký, silný, bouřlivý'].join('\n'),
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.notes.length, 2);
  assert.equal(result.notes[0].german, 'lernen');
  assert.equal(result.notes[0].czech, 'učit se, studovat, naučit se');
  assert.equal(result.notes[1].german, 'heftig');
  assert.equal(result.notes[1].czech, 'prudký, silný, bouřlivý');
});

test('duplicitní výraz v jednom importu se přeskočí', () => {
  const result = parseQuickImport('das Haus | dům\ndas Haus | barák');

  assert.equal(result.notes.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].severity, 'warning');
  assert.match(result.issues[0].message, /Duplicitní/u);
});

test('neúplný řádek vrátí chybu bez částečné karty', () => {
  const result = parseQuickImport('der Tisch');

  assert.equal(result.notes.length, 0);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].severity, 'error');
});

test('množné číslo bez členu vyvolá upozornění a neuloží se', () => {
  const result = parseQuickImport('morgen | zítra | die Morgen');

  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].kind, 'other');
  assert.equal(result.notes[0].plural, undefined);
  assert.equal(result.issues[0].severity, 'warning');
});

test('volitelný druh a CEFR odstraní nejednoznačnost importu', () => {
  const result = parseQuickImport('offen | otevřený | | vlastnosti | adjective | A2');

  assert.equal(result.issues.length, 0);
  assert.equal(result.notes[0].kind, 'adjective');
  assert.equal(result.notes[0].cefr, 'A2');
});

test('starý čtyřsloupcový formát neoznačí přídavné jméno na -en za sloveso', () => {
  const result = parseQuickImport('offen | otevřený | | vlastnosti');

  assert.equal(result.notes[0].kind, 'other');
});

test('anglický infinitiv zachová automatickou detekci německého slovesa', () => {
  const result = parseQuickImport('lernen | to learn | | school');

  assert.equal(result.issues.length, 0);
  assert.equal(result.notes[0].kind, 'verb');
  assert.equal(result.notes[0].czech, 'to learn');
});

test('neznámý druh nebo CEFR vytvoří čitelnou chybu', () => {
  const badKind = parseQuickImport('offen | otevřený | | | kouzlo | A2');
  const badLevel = parseQuickImport('offen | otevřený | | | adjective | A9');

  assert.equal(badKind.notes.length, 0);
  assert.match(badKind.issues[0].message, /Neznámý druh/u);
  assert.equal(badLevel.notes.length, 0);
  assert.match(badLevel.issues[0].message, /CEFR/u);
});

test('CSV parser respektuje quoted oddělovače, escaped quotes a multiline pole', () => {
  const result = parseQuickImport(
    [
      '"das Gleis","nástupiště, kolej","die Gleise","cestování, vlak","noun","A2"',
      '"sagen";"říct ""jasně""\na pokračovat";;"komunikace";"verb";"B1"',
    ].join('\r\n'),
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.notes.length, 2);
  assert.equal(result.notes[0].czech, 'nástupiště, kolej');
  assert.deepEqual(result.notes[0].tags, ['cestování', 'vlak']);
  assert.equal(result.notes[1].czech, 'říct "jasně"\na pokračovat');
  assert.equal(result.notes[1].sourceLine, 2);
});

test('CSV parser přijme BOM a CRLF a odmítne neuzavřené uvozovky', () => {
  const valid = parseQuickImport('\uFEFF"der Hund";"pes"\r\n"lernen";"učit se"\r\n');
  const malformed = parseQuickImport('"der Hund;pes');

  assert.equal(valid.notes.length, 2);
  assert.equal(valid.issues.length, 0);
  assert.equal(malformed.notes.length, 0);
  assert.match(malformed.issues[0].message, /uvozovky/u);
});

test('import uplatní limity velikosti a počtu řádků před drahým zpracováním', () => {
  const tooLarge = parseQuickImport('x'.repeat(2 * 1024 * 1024 + 1));
  const tooMany = parseQuickImport(Array.from({ length: 100_001 }, () => 'a,b').join('\n'));

  assert.match(tooLarge.issues[0].message, /2 MB/u);
  assert.match(tooMany.issues[0].message, /100 000/u);
  assert.equal(tooMany.notes.length, 0);
});
