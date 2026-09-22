import type { Point, Shape, ShapeId } from "@miro/shared";

import type { Engine } from "../engine/engine";
import type { Tool, ToolPointerEvent } from "./tool";

type Interaction =
    | { kind: "idle" }
    | { kind: "pan" }
    | {
          kind: "move";
          /** Original world positions, so ESC can restore them exactly. */
          origins: Map<ShapeId, Point>;
      };

/**
 * The default tool: click to select the topmost shape, drag a shape to move
 * it, drag empty space to pan.
 *
 * Note: single-selection, live-committed moves and empty-drag panning are the
 * P1-3 baseline (migrated from the old inline App logic). Marquee/shift
 * multi-select (P1-5) and coalescing a drag into one undoable MOVE (P1-6)
 * build on top of this later.
 */
export class SelectTool implements Tool {
    readonly id = "select" as const;

    private engine: Engine;
    private interaction: Interaction = { kind: "idle" };

    constructor(engine: Engine) {
        this.engine = engine;
    }

    onDeactivate(): void {
        // Leaving the tool mid-drag should not strand an interaction.
        this.interaction = { kind: "idle" };
    }

    onPointerDown(e: ToolPointerEvent): void {
        // Only the left and middle buttons drive interactions.
        if (e.button !== 0 && e.button !== 1) {
            return;
        }

        const hit = e.button === 0 ? this.topmostAt(e.world) : undefined;

        if (hit) {
            const selected = this.engine.getState().selection.ids;

            // Clicking an already-selected shape keeps the whole selection
            // (so you can drag a group); clicking a new shape selects it.
            const ids = selected.includes(hit.id) ? selected : [hit.id];

            if (ids !== selected) {
                this.engine.dispatch({ type: "SELECT", ids });
            }

            this.interaction = {
                kind: "move",
                origins: this.snapshotPositions(ids),
            };
        } else {
            if (e.button === 0) {
                this.engine.dispatch({ type: "SELECT", ids: [] });
            }
            this.interaction = { kind: "pan" };
        }
    }

    onPointerMove(e: ToolPointerEvent): void {
        const interaction = this.interaction;

        if (interaction.kind === "pan") {
            this.engine.dispatch({
                type: "PAN",
                dx: e.screenDelta.x,
                dy: e.screenDelta.y,
            });
            return;
        }

        if (interaction.kind === "move") {
            for (const id of interaction.origins.keys()) {
                const shape = this.engine.getState().document.shapes[id];
                if (!shape) continue;

                this.engine.dispatch({
                    type: "MOVE_SHAPE",
                    id,
                    from: { x: shape.x, y: shape.y },
                    to: {
                        x: shape.x + e.worldDelta.x,
                        y: shape.y + e.worldDelta.y,
                    },
                });
            }
        }
    }

    onPointerUp(): void {
        this.interaction = { kind: "idle" };
    }

    onCancel(): void {
        // Abort an in-progress move by snapping shapes back to where they
        // started — no net change to the document.
        if (this.interaction.kind === "move") {
            for (const [id, origin] of this.interaction.origins) {
                const shape = this.engine.getState().document.shapes[id];
                if (!shape) continue;

                this.engine.dispatch({
                    type: "MOVE_SHAPE",
                    id,
                    from: { x: shape.x, y: shape.y },
                    to: { x: origin.x, y: origin.y },
                });
            }
        }

        this.interaction = { kind: "idle" };
    }

    /** Original positions of the given shapes, for cancel/restore. */
    private snapshotPositions(ids: ShapeId[]): Map<ShapeId, Point> {
        const shapes = this.engine.getState().document.shapes;
        const origins = new Map<ShapeId, Point>();

        for (const id of ids) {
            const shape = shapes[id];
            if (shape) {
                origins.set(id, { x: shape.x, y: shape.y });
            }
        }

        return origins;
    }

    /**
     * Topmost shape (highest `z`) whose bounding box contains `point`, or
     * undefined if the point is over empty canvas.
     */
    private topmostAt(point: Point): Shape | undefined {
        const shapes = Object.values(
            this.engine.getState().document.shapes,
        );

        let best: Shape | undefined;

        for (const shape of shapes) {
            if (!this.containsPoint(shape, point)) continue;
            if (!best || shape.z > best.z) {
                best = shape;
            }
        }

        return best;
    }

    private containsPoint(shape: Shape, point: Point): boolean {
        return (
            point.x >= shape.x &&
            point.x <= shape.x + shape.width &&
            point.y >= shape.y &&
            point.y <= shape.y + shape.height
        );
    }
}
