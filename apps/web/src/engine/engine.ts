import type { Command, EngineState, Marquee } from "@miro/shared";

export class Engine {
    private state: EngineState;

    private listeners = new Set<() => void>();

    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    private marquee: Marquee | null= null

    private undoableTypes = new Set([
        "CREATE_SHAPE",
        "DELETE_SHAPE",
        "MOVE_SHAPE",
    ]);

    constructor(initialState: EngineState) {
        this.state = initialState;
    }


    getMarquee(){
        return this.marquee
    }
    getState() {
        return this.state;
    }

    dispatch(command: Command) {
        this.state = this.apply(this.state, command);

        // Only document-mutating commands enter undo history.
        if (this.isUndoable(command)) {
            this.undoStack.push(command);

            // A new command invalidates the old redo history.
            this.redoStack = [];
        }

        this.notify();
    }

    setMarquee(marquee: Marquee): void {
        this.marquee = marquee;
        this.notify();
    }

    clearMarquee(): void {
        this.marquee = null;
        this.notify();
    }


    undo() {
        const command = this.undoStack.pop();

        if (!command) {
            return;
        }

        const inverse = this.invert(command);

        if (!inverse) {
            return;
        }

        // Apply directly instead of calling dispatch().
        // Otherwise the inverse would enter the undo stack.
        this.state = this.apply(this.state, inverse);

        // Store the original command so redo can re-apply it.
        this.redoStack.push(command);

        this.notify();
    }

    redo() {
        const command = this.redoStack.pop();

        if (!command) {
            return;
        }

        // Re-apply the original command.
        this.state = this.apply(this.state, command);

        this.undoStack.push(command);

        this.notify();
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private isUndoable(command: Command): boolean {
        return this.undoableTypes.has(command.type);
    }

    private invert(command: Command): Command | null {
        switch (command.type) {
            case "CREATE_SHAPE":
                return {
                    type: "DELETE_SHAPE",
                    shapeId: command.shape.id,
                    shape: command.shape,
                };

            case "DELETE_SHAPE":
                return {
                    type: "CREATE_SHAPE",
                    shape: command.shape,
                };

            case "MOVE_SHAPE":
                return {
                    type: "MOVE_SHAPE",
                    id: command.id,
                    from: command.to,
                    to: command.from,
                };

            default:
                return null;
        }
    }

    private apply(
        state: EngineState,
        command: Command,
    ): EngineState {
        switch (command.type) {
            case "CREATE_SHAPE":
                return {
                    ...state,

                    document: {
                        ...state.document,

                        shapes: {
                            ...state.document.shapes,
                            [command.shape.id]: command.shape,
                        },
                    },
                };

            case "DELETE_SHAPE": {
                const {
                    [command.shapeId]: deletedShape,
                    ...remainingShapes
                } = state.document.shapes;

                return {
                    ...state,

                    document: {
                        ...state.document,
                        shapes: remainingShapes,
                    },
                };
            }

            case "MOVE_SHAPE":
                return {
                    ...state,

                    document: {
                        ...state.document,

                        shapes: {
                            ...state.document.shapes,

                            [command.id]: {
                                ...state.document.shapes[command.id],

                                x: command.to.x,
                                y: command.to.y,
                            },
                        },
                    },
                };

            case "PAN":
                return {
                    ...state,

                    camera: {
                        ...state.camera,
                        x: state.camera.x + command.dx,
                        y: state.camera.y + command.dy,
                    },
                };

            case "ZOOM": {
                const oldZoom = state.camera.zoom;
                const newZoom = command.zoom;

                // World point under the cursor before zooming.
                const worldX =
                    (command.mouseX - state.camera.x) / oldZoom;

                const worldY =
                    (command.mouseY - state.camera.y) / oldZoom;

                return {
                    ...state,

                    camera: {
                        ...state.camera,

                        zoom: newZoom,

                        // Keep the same world point under the cursor.
                        x: command.mouseX - worldX * newZoom,
                        y: command.mouseY - worldY * newZoom,
                    },
                };
            }

            case "SELECT":
                return {
                    ...state,

                    selection: {
                        ids: command.ids,
                    },
                };

            case "SET_TOOL":
                return {
                    ...state,
                    activeTool: command.tool,
                };
        }
    }
}

export const engine = new Engine({
    document: {
        version: 1.0,
        id: "001",
        name: "myboard",
        shapes: {},
    },

    camera: {
        x: 0,
        y: 0,
        zoom: 1,
    },

    selection: {
        ids: [],
    },

    activeTool: "select",
});