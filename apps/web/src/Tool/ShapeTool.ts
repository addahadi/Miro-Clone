import type { Point, Shape, ToolId } from "@miro/shared";

import type { Engine } from "../engine/engine";
import type { ToolManager } from "./ToolManager";
import type { Tool, ToolPointerEvent } from "./tool";

export interface ShapeBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Base class for tools that create a shape by dragging out a bounding box
 * (rectangle, ellipse, sticky, ...). It owns the shared drag / commit / cancel
 * lifecycle; a subclass only describes its own shape via {@link createShape}.
 *
 * The concrete subclasses arrive with P1-8+ (rectangle, ellipse, ...). This
 * base ships now so the tool system has a real shape-creation seam.
 */
export abstract class ShapeTool implements Tool {
    abstract readonly id: ToolId;

    protected engine: Engine;
    protected manager: ToolManager;

    /**
     * Minimum drag size (world units) before a drag counts as a create — a
     * bare click makes nothing (P1-8 decision).
     */
    protected minDragDistance = 2;

    private start: Point | null = null;
    private current: Point | null = null;

    constructor(engine: Engine, manager: ToolManager) {
        this.engine = engine;
        this.manager = manager;
    }

    onDeactivate(): void {
        this.reset();
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.button !== 0) return;
        this.start = e.world;
        this.current = e.world;
    }

    onPointerMove(e: ToolPointerEvent): void {
        if (!this.start) return;
        // Track geometry for a live preview; drawing it is a P1-8 concern.
        this.current = e.world;
    }

    onPointerUp(e: ToolPointerEvent): void {
        if (!this.start) return;

        const bounds = this.boundsFrom(this.start, e.world);
        this.reset();

        // A click (or tiny drag) creates nothing.
        if (Math.max(bounds.width, bounds.height) < this.minDragDistance) {
            return;
        }

        const shape = this.createShape(bounds);
        this.engine.dispatch({ type: "CREATE_SHAPE", shape });

        // Hand back to select with the new shape selected (P1-8 decision).
        this.manager.setActiveTool("select");
        this.engine.dispatch({ type: "SELECT", ids: [shape.id] });
    }

    onCancel(): void {
        this.reset();
    }

    /** In-progress drag bounds, or null when idle (for a live preview later). */
    getPreviewBounds(): ShapeBounds | null {
        if (!this.start || !this.current) return null;
        return this.boundsFrom(this.start, this.current);
    }

    /** Turn a finished drag into a concrete shape. */
    protected abstract createShape(bounds: ShapeBounds): Shape;

    /** Next `z` above every existing shape, so new shapes land on top. */
    protected nextZ(): number {
        const shapes = Object.values(this.engine.getState().document.shapes);
        return shapes.reduce((max, s) => Math.max(max, s.z), 0) + 1;
    }

    private boundsFrom(a: Point, b: Point): ShapeBounds {
        return {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.abs(a.x - b.x),
            height: Math.abs(a.y - b.y),
        };
    }

    private reset(): void {
        this.start = null;
        this.current = null;
    }
}
