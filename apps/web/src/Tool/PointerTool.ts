import type { Marquee, Point, Shape, ShapeId } from "@miro/shared";

import type { Engine } from "../engine/engine";
import type { Tool, ToolPointerEvent } from "./tool";

type Interaction =
    | { kind: "idle" }
    | { kind: "pan" }
    | {
          kind: "marquee";
          start: Point;
      }
    | {
          kind: "move";
          origins: Map<ShapeId, Point>;
      };

export class PointerTool implements Tool {
    readonly id = "select" as const;

    private engine: Engine;
    private interaction: Interaction = { kind: "idle" };
    private SelectTool: boolean = true;

    constructor(engine: Engine) {
        this.engine = engine;
    }

    onDeactivate(): void {
        if (this.interaction.kind === "move") {
            this.engine.RestorePositions(this.interaction.origins);
        }

        this.interaction = { kind: "idle" };
        this.engine.clearMarquee();
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.button !== 0 && e.button !== 1) {
            return;
        }

        const hit =
            e.button === 0
                ? this.topmostAt(e.world)
                : undefined;

        if (hit) {
            const selected = this.engine.getState().selection.ids;

            if (e.shiftKey) {
                const ids = selected.includes(hit.id)
                    ? selected.filter(id => id !== hit.id)
                    : [...selected, hit.id];

                this.engine.dispatch({
                    type: "SELECT",
                    ids,
                });

                this.interaction = {
                    kind: "idle",
                };

                return;
            }

            const ids = selected.includes(hit.id)
                ? selected
                : [hit.id];

            if (ids !== selected) {
                this.engine.dispatch({
                    type: "SELECT",
                    ids,
                });
            }

            this.interaction = {
                kind: "move",
                origins: this.snapshotPositions(ids),
            };

            return;
        }

        if (e.button === 0) {
            if (this.SelectTool) {
                this.engine.dispatch({
                    type: "SELECT",
                    ids: [],
                });

                this.interaction = {
                    kind: "marquee",
                    start: e.world,
                };

                this.engine.setMarquee({
                    x: e.world.x,
                    y: e.world.y,
                    width: 0,
                    height: 0,
                });
            } else {
                this.interaction = {
                    kind: "pan",
                };
            }

            return;
        }

        this.interaction = {
            kind: "pan",
        };
    }

    private intersect(marquee: Marquee): void {
        const state = this.engine.getState();
        const shapes = Object.values(state.document.shapes);

        const ids: ShapeId[] = [];

        for (const shape of shapes) {
            if (this.intersects(shape, marquee)) {
                ids.push(shape.id);
            }
        }

        this.engine.dispatch({
            type: "SELECT",
            ids,
        });
    }

    private intersects(
        shape: Shape,
        marquee: Marquee,
    ): boolean {
        return (
            shape.x < marquee.x + marquee.width &&
            shape.x + shape.width > marquee.x &&
            shape.y < marquee.y + marquee.height &&
            shape.y + shape.height > marquee.y
        );
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

        if (interaction.kind === "marquee") {
            const rect = this.makeRect(
                interaction.start,
                e.world,
            );

            this.engine.setMarquee(rect);
            this.intersect(rect);

            return;
        }

        if (interaction.kind === "move") {
            this.engine.MoveShape(
                interaction.origins.keys(),
                e,
            );
        }
    }

    onPointerUp(): void {
        if (this.interaction.kind === "move") {
            const moves = [];

            for (const [id, origin] of this.interaction.origins) {
                const shape =
                    this.engine.getState().document.shapes[id];

                if (!shape) {
                    continue;
                }

                if (
                    shape.x === origin.x &&
                    shape.y === origin.y
                ) {
                    continue;
                }

                moves.push({
                    id,
                    from: origin,
                    to: {
                        x: shape.x,
                        y: shape.y,
                    },
                });
            }

            if (moves.length > 0) {
                this.engine.dispatch({
                    type: "MOVE_SHAPES",
                    moves,
                });
            }

            this.interaction = {
                kind: "idle",
            };

            return;
        }

        this.engine.clearMarquee();

        this.interaction = {
            kind: "idle",
        };
    }

    onCancel(): void {
        if (this.interaction.kind === "move") {
            this.engine.RestorePositions(
                this.interaction.origins,
            );
        }

        this.engine.clearMarquee();

        this.interaction = {
            kind: "idle",
        };
    }

    private snapshotPositions(
        ids: ShapeId[],
    ): Map<ShapeId, Point> {
        const shapes =
            this.engine.getState().document.shapes;

        const origins = new Map<ShapeId, Point>();

        for (const id of ids) {
            const shape = shapes[id];

            if (shape) {
                origins.set(id, {
                    x: shape.x,
                    y: shape.y,
                });
            }
        }

        return origins;
    }

    private topmostAt(
        point: Point,
    ): Shape | undefined {
        const shapes = Object.values(
            this.engine.getState().document.shapes,
        );

        let best: Shape | undefined;

        for (const shape of shapes) {
            if (!this.containsPoint(shape, point)) {
                continue;
            }

            if (!best || shape.z > best.z) {
                best = shape;
            }
        }

        return best;
    }

    private makeRect(
        start: Point,
        current: Point,
    ): Marquee {
        return {
            x: Math.min(start.x, current.x),
            y: Math.min(start.y, current.y),
            width: Math.abs(current.x - start.x),
            height: Math.abs(current.y - start.y),
        };
    }

    private containsPoint(
        shape: Shape,
        point: Point,
    ): boolean {
        return (
            point.x >= shape.x &&
            point.x <= shape.x + shape.width &&
            point.y >= shape.y &&
            point.y <= shape.y + shape.height
        );
    }
}