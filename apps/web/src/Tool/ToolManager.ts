import type { Point, ToolId } from "@miro/shared";
import { screenToWorld } from "@miro/shared";

import type { Engine } from "../engine/engine";
import type { Tool } from "./tool";

/**
 * Owns the registry of tools and routes raw input to the active one.
 *
 * Responsibilities:
 *  - keep the tool registry (id -> instance);
 *  - convert screen-space pointer input into world space before handing it to
 *    a tool (so tools never touch the camera transform);
 *  - drive the activate/deactivate lifecycle when the active tool changes.
 *
 * The *active tool id* lives in the engine store (so React chrome can
 * subscribe to it); the ToolManager only holds the instances.
 */
export class ToolManager {
    private engine: Engine;
    private tools = new Map<ToolId, Tool>();

    /** Last pointer position in screen space, used to derive world deltas. */
    private lastScreen: Point | null = null;

    constructor(engine: Engine) {
        this.engine = engine;
    }

    /** Register a tool. Returns `this` so calls can be chained. */
    register(tool: Tool): this {
        this.tools.set(tool.id, tool);
        return this;
    }

    getActiveTool(): Tool | undefined {
        return this.tools.get(this.engine.getState().activeTool);
    }

    /**
     * Switch tools: cancel + deactivate the outgoing tool, record the new tool
     * in the store, then activate it. No-op if the tool is already active.
     */
    setActiveTool(id: ToolId): void {
        if (id === this.engine.getState().activeTool) {
            return;
        }

        if (!this.tools.has(id)) {
            throw new Error(`ToolManager: unknown tool "${id}"`);
        }

        const previous = this.getActiveTool();
        previous?.onCancel?.();
        previous?.onDeactivate?.();

        this.engine.dispatch({ type: "SET_TOOL", tool: id });

        this.getActiveTool()?.onActivate?.();
    }

    // --- Pointer routing -------------------------------------------------

    onPointerDown(screen: Point, button: number, shiftKey: boolean): void {
        this.lastScreen = screen;
        this.getActiveTool()?.onPointerDown?.(
            this.toEvent(screen, button, shiftKey),
        );
    }

    onPointerMove(screen: Point, button: number, shiftKey: boolean): void {
        this.getActiveTool()?.onPointerMove?.(
            this.toEvent(screen, button, shiftKey),
        );
        this.lastScreen = screen;
    }

    onPointerUp(screen: Point, button: number, shiftKey: boolean): void {
        this.getActiveTool()?.onPointerUp?.(
            this.toEvent(screen, button, shiftKey),
        );
        this.lastScreen = null;
    }

    /** ESC / focus loss: abort whatever the active tool is doing. */
    onCancel(): void {
        this.getActiveTool()?.onCancel?.();
        this.lastScreen = null;
    }

    private toEvent(
        screen: Point,
        button: number,
        shiftKey: boolean,
    ) {
        const camera = this.engine.getState().camera;
        const previousScreen = this.lastScreen ?? screen;

        const world = screenToWorld(screen, camera);
        const previousWorld = screenToWorld(previousScreen, camera);

        return {
            world,
            screen,
            worldDelta: {
                x: world.x - previousWorld.x,
                y: world.y - previousWorld.y,
            },
            screenDelta: {
                x: screen.x - previousScreen.x,
                y: screen.y - previousScreen.y,
            },
            button,
            shiftKey,
        };
    }
}
