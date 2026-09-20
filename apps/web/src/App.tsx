import {
  useEffect,
  useRef,
} from "react";
import { engine } from "./engine/engine";



type DragMode =
  | "none"
  | "pan"
  | "object";

function App() {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);


  const dragMode =
    useRef<DragMode>("none");

  const lastPointer = useRef({
    x: 0,
    y: 0,
  });

  function screenToWorld(
    screenX: number,
    screenY: number
  ) {
    const camera = engine.getState().camera;

    return {
      x:
        (screenX - camera.x) /
        camera.zoom,

      y:
        (screenY - camera.y) /
        camera.zoom,
    };
  }

  function resize() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const dpr =
      window.devicePixelRatio || 1;

    canvas.width =
      window.innerWidth * dpr;

    canvas.height =
      window.innerHeight * dpr;

    render();
  }

  function isPointInsideRectangle(
    x: number,
    y: number
  ) {
    const state = engine.getState();

    const selectedShape =
      Object.values(
        state.document.shapes
      )[0];

    if (!selectedShape) {
      return false;
    }

    return (
      x >= selectedShape.x &&
      x <=
        selectedShape.x +
          selectedShape.width &&
      y >= selectedShape.y &&
      y <=
        selectedShape.y +
          selectedShape.height
    );
  }

  function render() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    const dpr =
      window.devicePixelRatio || 1;

    const state =
      engine.getState();

    const camera =
      state.camera;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.save();

    /*
     * Convert drawing coordinates from
     * physical canvas pixels to CSS pixels.
     */
    ctx.scale(dpr, dpr);

    /*
     * Camera transform.
     */
    ctx.translate(
      camera.x,
      camera.y
    );

    ctx.scale(
      camera.zoom,
      camera.zoom
    );

    /*
     * World
     */
    for (const shape of Object.values(
      state.document.shapes
    )) {
      ctx.fillStyle = "black";

      ctx.fillRect(
        shape.x,
        shape.y,
        shape.width,
        shape.height
      );
    }

    ctx.restore();
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (
      e.button !== 0 &&
      e.button !== 1
    ) {
      return;
    }

    e.preventDefault();

    const mouseWorld =
      screenToWorld(
        e.clientX,
        e.clientY
      );

    if (
      e.button === 0 &&
      isPointInsideRectangle(
        mouseWorld.x,
        mouseWorld.y
      )
    ) {
      dragMode.current =
        "object";

      engine.dispatch({
        type: "SELECT",
        ids: ["rectangle-1"],
      });
    } else {
      dragMode.current =
        "pan";
    }

    e.currentTarget.setPointerCapture(
      e.pointerId
    );

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handlePointerMove(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const mode =
      dragMode.current;

    if (mode === "none") {
      return;
    }

    const state =
      engine.getState();

    const camera =
      state.camera;

    const dx =
      e.clientX -
      lastPointer.current.x;

    const dy =
      e.clientY -
      lastPointer.current.y;

    if (mode === "pan") {
      engine.dispatch({
        type: "PAN",
        dx,
        dy,
      });
    }

    if (mode === "object") {
      const shape =
        state.document.shapes[
          "rectangle-1"
        ];

      if (shape) {
        /*
         * Pointer movement is in screen
         * coordinates; convert the delta
         * to world coordinates.
         */
        const worldDx =
          dx / camera.zoom;
        const worldDy =
          dy / camera.zoom;

        engine.dispatch({
          type: "MOVE_SHAPE",
          id: "rectangle-1",

          from: {
            x: shape.x,
            y: shape.y,
          },

          to: {
            x: shape.x + worldDx,
            y: shape.y + worldDy,
          },
        });
      }
    }

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    dragMode.current = "none";

    if (
      e.currentTarget.hasPointerCapture(
        e.pointerId
      )
    ) {
      e.currentTarget.releasePointerCapture(
        e.pointerId
      );
    }
  }

  useEffect(() => {
    /*
     * Renderer subscribes to engine.
     *
     * Every time the engine changes,
     * redraw the canvas.
     */
    const unsubscribe =
      engine.subscribe(() => {
        render();
      });

    return unsubscribe;
  }, []);

  useEffect(() => {
    resize();

    window.addEventListener(
      "resize",
      resize
    );

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, []);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    function handleWheel(
      e: WheelEvent
    ) {
      e.preventDefault();

      const camera =
        engine.getState().camera;

      const zoomFactor =
        e.deltaY < 0
          ? 1.1
          : 0.9;

      const newZoom =
        camera.zoom * zoomFactor;

      engine.dispatch({
        type: "ZOOM",

        zoom: newZoom,

        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    }

    canvas.addEventListener(
      "wheel",
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      canvas.removeEventListener(
        "wheel",
        handleWheel
      );
    };
  }, []);

  return (
    <main className="w-screen h-screen">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none"
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
      />
    </main>
  );
}

export default App;