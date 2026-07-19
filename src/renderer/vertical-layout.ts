export type VerticalBand = "body" | "tie" | "ornament" | "velocity" | "hairpin" | "slur" | "ending" | "navigation";

export interface VerticalItem {
  id: string;
  band: VerticalBand;
  x1: number;
  x2: number;
  height: number;
  gap?: number;
  horizontalGap?: number;
  preferredBottom?: number;
  sourceOrder?: number;
  dependsOn?: string[];
  fixed?: boolean;
}

export interface VerticalPlacement {
  id: string;
  band: VerticalBand;
  x1: number;
  x2: number;
  bottom: number;
  top: number;
  anchor: number;
  lane: number;
}

export interface VerticalCollision {
  lowerId: string;
  upperId: string;
}

export interface VerticalLinePlan {
  aboveHeight: number;
  placements: Map<string, VerticalPlacement>;
  collisions: VerticalCollision[];
}

const BAND_ORDER: Record<VerticalBand, number> = {
  body: 0,
  tie: 1,
  ornament: 2,
  velocity: 3,
  hairpin: 4,
  slur: 5,
  ending: 6,
  navigation: 7,
};

function normalized(item: VerticalItem): VerticalItem {
  return {
    ...item,
    x1: Math.min(item.x1, item.x2),
    x2: Math.max(item.x1, item.x2),
    height: Math.max(0, item.height),
  };
}

function horizontalOverlap(left: VerticalItem | VerticalPlacement, right: VerticalItem | VerticalPlacement, gap = 0): boolean {
  return left.x1 < right.x2 + gap && right.x1 < left.x2 + gap;
}

function verticalOverlap(left: VerticalPlacement, right: VerticalPlacement): boolean {
  return left.bottom < right.top && right.bottom < left.top;
}

function stableItems(items: VerticalItem[]): VerticalItem[] {
  return items.map(normalized).sort((left, right) => {
    return (
      Number(Boolean(right.fixed)) - Number(Boolean(left.fixed)) ||
      BAND_ORDER[left.band] - BAND_ORDER[right.band] ||
      (left.sourceOrder ?? Number.MAX_SAFE_INTEGER) - (right.sourceOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function planVerticalLine(input: VerticalItem[]): VerticalLinePlan {
  const items = stableItems(input);
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) {
    throw new Error("Vertical item ids must be unique within one visual line");
  }
  for (const item of items) {
    for (const dependency of item.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new Error(`Vertical item '${item.id}' depends on missing item '${dependency}'`);
      }
    }
  }

  const placements = new Map<string, VerticalPlacement>();
  const pending = [...items];
  while (pending.length > 0) {
    const index = pending.findIndex((item) => (item.dependsOn ?? []).every((dependency) => placements.has(dependency)));
    if (index < 0) {
      throw new Error("Vertical item dependencies must not contain a cycle");
    }
    const item = pending.splice(index, 1)[0]!;
    let bottom = Math.max(0, item.preferredBottom ?? 0);
    let lane = 0;
    if (!item.fixed) {
      for (const [placedId, placed] of placements) {
        const placedItem = byId.get(placedId)!;
        const horizontalGap = Math.max(item.horizontalGap ?? 0, placedItem.horizontalGap ?? 0);
        if (!horizontalOverlap(item, placed, horizontalGap)) {
          continue;
        }
        const gap = Math.max(item.gap ?? 0, placedItem.gap ?? 0);
        bottom = Math.max(bottom, placed.top + gap);
        if (item.band === placed.band) {
          lane = Math.max(lane, placed.lane + 1);
        }
      }
    }
    placements.set(item.id, {
      id: item.id,
      band: item.band,
      x1: item.x1,
      x2: item.x2,
      bottom,
      top: bottom + item.height,
      anchor: bottom,
      lane,
    });
  }

  const collisions: VerticalCollision[] = [];
  const values = [...placements.values()];
  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
      const left = values[leftIndex]!;
      const right = values[rightIndex]!;
      const leftItem = byId.get(left.id)!;
      const rightItem = byId.get(right.id)!;
      if (leftItem.fixed && rightItem.fixed) {
        continue;
      }
      const horizontalGap = Math.max(leftItem.horizontalGap ?? 0, rightItem.horizontalGap ?? 0);
      if (horizontalOverlap(left, right, horizontalGap) && verticalOverlap(left, right)) {
        collisions.push({ lowerId: left.bottom <= right.bottom ? left.id : right.id, upperId: left.bottom <= right.bottom ? right.id : left.id });
      }
    }
  }

  return {
    aboveHeight: Math.max(0, ...values.map((placement) => placement.top)),
    placements,
    collisions,
  };
}
