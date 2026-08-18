export type ConnectorPoint = {
  x: number;
  y: number;
};

const MAX_NORMALIZED_OFFSET = 0.82;

export function normalizedPathPosition(index: number, total: number): number {
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(total) || total <= 0) return 0;
  if (total === 1 || index === total - 1) return 0;
  const phase = index * 1.22 - 0.2;
  return Number((Math.sin(phase) * MAX_NORMALIZED_OFFSET).toFixed(4));
}

export function connectorPath(points: ConnectorPoint[]): string {
  if (points.length < 2) return '';
  const finite = points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite) return '';

  return points.slice(1).reduce(
    (path, point, index) => {
      const previous = points[index];
      const midpointY = previous.y + (point.y - previous.y) / 2;
      return `${path} C ${previous.x.toFixed(2)} ${midpointY.toFixed(2)}, ${point.x.toFixed(2)} ${midpointY.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    },
    `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`,
  );
}
