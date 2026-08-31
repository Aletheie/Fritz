export function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function stableShuffle<T>(values: readonly T[], seed: string, avoidIdentity = true): T[] {
  const result = [...values];
  let state = stableHash(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  if (avoidIdentity && result.length > 1 && result.every((item, index) => item === values[index])) {
    result.push(result.shift()!);
  }
  return result;
}

function siftDownMaxHeap<T>(
  heap: T[],
  start: number,
  compare: (left: T, right: T) => number,
): void {
  let parent = start;
  while (true) {
    const left = parent * 2 + 1;
    if (left >= heap.length) return;
    const right = left + 1;
    let largest = left;
    if (right < heap.length && compare(heap[right], heap[left]) > 0) largest = right;
    if (compare(heap[largest], heap[parent]) <= 0) return;
    [heap[parent], heap[largest]] = [heap[largest], heap[parent]];
    parent = largest;
  }
}

export function takeLowest<T>(
  values: readonly T[],
  limit: number,
  compare: (left: T, right: T) => number,
): T[] {
  const size = Math.min(values.length, Math.max(0, Math.trunc(limit)));
  if (size === 0) return [];
  if (size === values.length) return values.toSorted(compare);

  const heap = values.slice(0, size);
  let parent = Math.floor(heap.length / 2) - 1;
  while (parent >= 0) {
    siftDownMaxHeap(heap, parent, compare);
    parent -= 1;
  }

  let index = size;
  while (index < values.length) {
    const candidate = values[index];
    if (compare(candidate, heap[0]) < 0) {
      heap[0] = candidate;
      siftDownMaxHeap(heap, 0, compare);
    }
    index += 1;
  }
  return heap.toSorted(compare);
}
