/** 工作区列表可见区域和分区标题的屏幕边界。 */
export interface DropBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 分区标题到下一个标题之间的区域均可接收工作区，空字符串表示默认分区。 */
export function groupAt(point: { x: number; y: number }, bounds: DropBounds,
  headers: { id: string; top: number; bottom: number }[]): string | undefined {
  if (point.x < bounds.left || point.x >= bounds.right || point.y < bounds.top || point.y >= bounds.bottom) {
    return undefined;
  }
  return headers.filter(header => header.bottom > header.top && header.top <= point.y)
    .sort((a, b) => b.top - a.top)[0]?.id;
}
