export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rowText = a.length >= b.length ? a : b;
  const columnText = a.length >= b.length ? b : a;
  let previousPrevious = new Uint32Array(columnText.length + 1);
  let previous = new Uint32Array(columnText.length + 1);
  let current = new Uint32Array(columnText.length + 1);
  for (let column = 0; column <= columnText.length; column += 1) previous[column] = column;

  for (let row = 1; row <= rowText.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= columnText.length; column += 1) {
      const substitutionCost = rowText[row - 1] === columnText[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );

      if (
        row > 1 &&
        column > 1 &&
        rowText[row - 1] === columnText[column - 2] &&
        rowText[row - 2] === columnText[column - 1]
      ) {
        current[column] = Math.min(current[column], previousPrevious[column - 2] + 1);
      }
    }
    [previousPrevious, previous, current] = [previous, current, previousPrevious];
  }

  return previous[columnText.length];
}

export function typoThreshold(length: number): number {
  if (length < 5) return 0;
  if (length < 10) return 1;
  return 2;
}
