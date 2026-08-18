import assert from 'node:assert/strict';
import test from 'node:test';

import { connectorPath, normalizedPathPosition } from '../src/lib/components/home/path-geometry.ts';

test('path node positions stay bounded and deterministic', () => {
  assert.equal(normalizedPathPosition(0, 1), 0);
  assert.equal(normalizedPathPosition(3, 4), 0);
  assert.ok(Math.abs(normalizedPathPosition(2, 8)) <= 0.82);
  assert.equal(normalizedPathPosition(2, 8), normalizedPathPosition(2, 8));
});

test('connector path returns a cubic SVG path only for finite points', () => {
  assert.equal(
    connectorPath([
      { x: 10, y: 20 },
      { x: 30, y: 60 },
    ]),
    'M 10.00 20.00 C 10.00 40.00, 30.00 40.00, 30.00 60.00',
  );
  assert.equal(connectorPath([{ x: 10, y: 20 }]), '');
  assert.equal(connectorPath([{ x: Number.NaN, y: 20 }, { x: 30, y: 60 }]), '');
});
