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

/**
 * Convert a point from world space to screen (CSS pixel) space.
 *
 * The transform is `screen = world * zoom + cameraOffset`. This is the
 * ONLY place the forward transform math lives — never hand-roll it inline.
 */
export function worldToScreen(pt: Point, camera: Camera): Point {
  return {
    x: pt.x * camera.zoom + camera.x,
    y: pt.y * camera.zoom + camera.y,
  };
}

/**
 * Convert a point from screen (CSS pixel) space to world space.
 *
 * Inverse of {@link worldToScreen}: `world = (screen - cameraOffset) / zoom`.
 */
export function screenToWorld(pt: Point, camera: Camera): Point {
  return {
    x: (pt.x - camera.x) / camera.zoom,
    y: (pt.y - camera.y) / camera.zoom,
  };
}

export type ShapeId = string;

/** The set of interaction tools the user can switch between. */
export type ToolId =
  | "select"
  | "rectangle"
  | "circle"
  | "text";

export type RectangleShape = BaseShape & {
  type : "rectangle"
}

export type CircleShape = BaseShape & {
  type : "circle"
}

export type TextShape = BaseShape & {
  type : "text"
  text : string
}

export type Shape = RectangleShape | CircleShape | TextShape

export type BaseShape = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type Selection = {
  ids: ShapeId[];
};

export type EngineState = {
  document: BoardDocument;
  camera: Camera;
  selection: Selection;
  /** The currently active interaction tool. Ephemeral UI state (never undoable). */
  activeTool: ToolId;
};

export interface BoardDocument {
  version: number;
  id: string;
  name: string;
  shapes: Record<ShapeId, Shape>;
  // ordering derived from shape.z
}


export type Marquee = {
  x:number
  y:number
  width : number
  height : number
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
    
      type: "MOVE_SHAPES";
      moves: {
          id: ShapeId;
          from: Point;
          to: Point;
      }[];

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
    }
  | {
      type: "SET_TOOL";
      tool: ToolId;
    };