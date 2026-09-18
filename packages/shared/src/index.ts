// @miro/shared — the single source of truth for the domain model,
// consumed by both apps/web and apps/server.
//
// This is intentionally minimal. Flesh out the real domain types
// (Shape, BaseShape, BoardDocument, Camera) in ticket P0-3.

export const SHARED_VERSION = '0.0.0'

/** A point in 2D space. Placeholder primitive — expand in P0-3. */
export interface Point {
  x: number
  y: number
}

export type ShapeId = String

export interface BaseShape {
  id: ShapeId;
  type: 'rect' | 'ellipse' | 'sticky' | 'text' | 'freehand';
  x: number; y: number;        // world coords (top-left / anchor)
  width: number; height: number;
  rotation?: number;
  z: number;                    // stacking order
  // style fields: fill, stroke, etc. (per-type extensions)
}


export type Camera = {
  x:number,
  y:number,
  zoom:number
}