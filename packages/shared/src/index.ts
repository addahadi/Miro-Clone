export const SHARED_VERSION = "0.0.0";

/** A point in 2D space. */
export interface Point {
  x: number;
  y: number;
}

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type ShapeId = string;

export type Shape = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Selection = {
  ids: ShapeId[];
};

export type EngineState = {
  document: BoardDocument;
  camera: Camera;
  selection: Selection;
};

export interface BoardDocument {
  version: number;
  id: string;
  name: string;
  shapes: Record<ShapeId, Shape>;
  // ordering derived from shape.z
}

export type Command =
  | {
      type: "CREATE_SHAPE";
      shape: Shape;
    }
  | {
      type: "MOVE_SHAPE";
      id: string;
      /** Shape's world position before the move (for invert). */
      from: { x: number; y: number };
      /** Shape's world position after the move. */
      to: { x: number; y: number };
    }
  | {
      type:"DELETE_SHAPE",
      shapeId:ShapeId,
      shape:Shape
    }
  | {
      type: "PAN";
      dx: number;
      dy: number;
    }
  | {
      type: "ZOOM";
      zoom: number;
      mouseX: number;
      mouseY: number;
    }
  | {
      type: "SELECT";
      ids: ShapeId[];
    };