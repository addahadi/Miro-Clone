import { useEffect, useRef } from "react";

import { engine } from "./engine/engine";
import { ToolManager } from "./Tool/ToolManager";
import { PointerTool } from "./Tool/PointerTool";

// One tool manager for the app, wired to the engine singleton. Register the
// tools it ships with; shape-creation tools (rect, ellipse, ...) register here
// as they land in P1-8+.
const toolManager = new ToolManager(engine);
toolManager.register(new PointerTool(engine));

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function resize() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    render();
  }

  function render() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const state = engine.getState();
    const camera = state.camera;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Physical pixels -> CSS pixels.
    ctx.scale(dpr, dpr);

    // Camera transform.
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // World.
    for (const shape of Object.values(state.document.shapes)) {
      ctx.fillStyle = "black";
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    }


    const marquee = engine.getMarquee();

  if (marquee) {
    ctx.fillStyle = "rgba(0, 120, 255, 0.15)";
    ctx.strokeStyle = "rgb(0, 120, 255)";
    ctx.lineWidth = 1 / camera.zoom;

    ctx.fillRect(
      marquee.x,
      marquee.y,
      marquee.width,
      marquee.height,
    );

    ctx.strokeRect(
      marquee.x,
      marquee.y,
      marquee.width,
      marquee.height,
    );
  }

    ctx.restore();
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLCanvasElement>,
  ) {
    if (e.button !== 0 && e.button !== 1) {
      return;
    }

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    toolManager.onPointerDown(
      { x: e.clientX, y: e.clientY },
      e.button,
      e.shiftKey,
    );
  }

  function handlePointerMove(
    e: React.PointerEvent<HTMLCanvasElement>,
  ) {
    toolManager.onPointerMove(
      { x: e.clientX, y: e.clientY },
      e.button,
      e.shiftKey,
    );
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLCanvasElement>,
  ) {
    toolManager.onPointerUp(
      { x: e.clientX, y: e.clientY },
      e.button,
      e.shiftKey,
    );

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // Renderer subscribes to the engine: redraw whenever state changes.
  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      render();
    });

    return unsubscribe;
  }, []);

  // Full-viewport, HiDPI-crisp canvas.
  useEffect(() => {
    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ESC aborts whatever the active tool is doing, with no committed change.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        toolManager.onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Wheel zoom, toward the cursor.
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      const camera = engine.getState().camera;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = camera.zoom * zoomFactor;

      engine.dispatch({
        type: "ZOOM",
        zoom: newZoom,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Seed one rectangle so there is something to select/move on a fresh board.
  useEffect(() => {
    if (Object.keys(engine.getState().document.shapes).length > 0) {
      return;
    }

    engine.dispatch({
      type: "CREATE_SHAPE",
      shape: {
        id: crypto.randomUUID(),
        type: "rectangle",
        x: 100,
        y: 100,
        width: 200,
        height: 120,
        z: 1,
      },
    });

    engine.dispatch({
      type: "CREATE_SHAPE",
      shape: {
        id: crypto.randomUUID(),
        type: "rectangle",
        x: 150,
        y: 150,
        width: 200,
        height: 120,
        z: 1,
      },
    });
  }, []);


  return (
    <main className="w-screen h-screen">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </main>
  );
}

export default App;
