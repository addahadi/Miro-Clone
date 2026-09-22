import type { Point, ToolId } from "@miro/shared";

/**
 * A pointer event after the ToolManager has converted it into world space.
 *
 * Tools work purely in world coordinates — they never call `screenToWorld`
 * themselves (that is the manager's job, per the P1-3 decision).
 */
export interface ToolPointerEvent {
    /** Pointer position in world coordinates. */
    world: Point;
    /** Pointer position in screen (CSS pixel) coordinates. */
    screen: Point;
    /** Movement since the previous pointer event, in world coordinates. */
    worldDelta: Point;
    /** Movement since the previous pointer event, in screen coordinates. */
    screenDelta: Point;
    /** Which mouse button: 0 = left, 1 = middle, 2 = right. */
    button: number;
    shiftKey: boolean;
}

/**
 * A tool owns the interaction logic for one canvas mode (select, draw a
 * rectangle, freehand, ...). The ToolManager routes pointer and key input to
 * whichever tool is active.
 *
 * Every handler is optional so a tool only implements what it needs.
 */
export interface Tool {
    readonly id: ToolId;

    /** Called when this tool becomes the active tool. */
    onActivate?(): void;

    /** Called when another tool is about to take over. */
    onDeactivate?(): void;

    onPointerDown?(e: ToolPointerEvent): void;
    onPointerMove?(e: ToolPointerEvent): void;
    onPointerUp?(e: ToolPointerEvent): void;

    /**
     * ESC or interruption: abort any in-progress interaction WITHOUT
     * committing a command. Must be safe to call even when idle.
     */
    onCancel?(): void;
}
