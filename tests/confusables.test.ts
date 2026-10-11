import assert from 'node:assert/strict';
import test from 'node:test';

import { confusionRank, confusionTip } from '../src/lib/domain/vocabulary/confusables.ts';

test('kurátorované páry mají nejvyšší prioritu, pak pravopisní sousedé', () => {
  assert.equal(confusionRank({ german: 'bekommen' }, { german: 'werden' }), 0);
  assert.equal(confusionRank({ german: 'sich setzen' }, { german: 'sitzen' }), 0);
  assert.equal(confusionRank({ german: 'die Küche' }, { german: 'der Kuchen' }), 0);
  assert.equal(confusionRank({ german: 'das Haus' }, { german: 'die Maus' }), 1);
  assert.equal(confusionRank({ german: 'Tisch' }, { german: 'Fenster' }), undefined);
  assert.equal(confusionRank({ german: 'Uhr' }, { german: 'Ohr' }), undefined, 'too short');
  assert.equal(confusionRank({ german: 'Haus' }, { german: 'das Haus' }), undefined);
});

test('tip vysvětlí rozdíl v jazyce rozhraní', () => {
  assert.match(confusionTip({ german: 'legen' }, 'cs') ?? '', /položit/u);
  assert.match(confusionTip({ german: 'werden' }, 'en') ?? '', /become/u);
  assert.equal(confusionTip({ german: 'Tisch' }, 'cs'), undefined);
});
