import { Subtopic, AREAS, DIMENSIONS } from "./types";
import poolData from "@/data/subtopics_pool.json";

let pool: Subtopic[] = (poolData as Subtopic[]).map((s) => ({
  ...s,
  status: s.status ?? "active",
}));

export function getPool(): Subtopic[] {
  return pool;
}

export function addSubtopic(subtopic: Subtopic): void {
  pool = [...pool, { ...subtopic, status: "active" }];
}

export function removeSubtopic(subtopicId: string): void {
  pool = pool.filter((s) => s.subtopic !== subtopicId);
}

export function getAreas(): readonly string[] {
  return AREAS;
}

export function getDimensions(): readonly string[] {
  return DIMENSIONS;
}

export function getPoolByArea(area: string): Subtopic[] {
  return pool.filter((s) => s.area === area);
}

export function getPoolByDimension(dimension: string): Subtopic[] {
  return pool.filter((s) => s.dimension === dimension);
}

export function getAreaDimensionMatrix(): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const area of AREAS) {
    matrix[area] = {};
    for (const dim of DIMENSIONS) {
      matrix[area][dim] = 0;
    }
  }
  for (const s of pool) {
    if (matrix[s.area] && s.dimension in matrix[s.area]) {
      matrix[s.area][s.dimension]++;
    }
  }
  return matrix;
}
