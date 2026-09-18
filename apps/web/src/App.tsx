import {
  useEffect,
  useRef,
} from "react";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cameraRef = useRef<Camera>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const isPanning = useRef(false);

  const lastPointer = useRef({
    x: 0,
    y: 0,
  });

  function screenToWorld(
    screenX: number,
    screenY: number
  ) {
    const camera = cameraRef.current;

    return {
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom,
    };
  }


  function resize(){
    const canvas = canvasRef.current;

    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr

    render()

  }
  
  function render() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const camera = cameraRef.current;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.save();

    ctx.scale(dpr,dpr)
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // World
    ctx.fillStyle = "black";
    ctx.fillRect(500, 300, 200, 100);

    ctx.restore();
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    // Pan with middle button or left button.
    if (e.button !== 1 && e.button !== 0) return;

    // Stop middle-click autoscroll from hijacking the drag.
    e.preventDefault();

    isPanning.current = true;

    // Keep receiving move/up events even if the pointer
    // leaves the canvas mid-drag.
    e.currentTarget.setPointerCapture(e.pointerId);

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handlePointerMove(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (!isPanning.current) return;

    const dx =
      e.clientX - lastPointer.current.x;

    const dy =
      e.clientY - lastPointer.current.y;

    cameraRef.current.x += dx;
    cameraRef.current.y += dy;

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    }

    render();
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    isPanning.current = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  useEffect(() => {
    resize()

    window.addEventListener("resize" ,resize)

    return () => {
      window.removeEventListener("resize",resize)
    }
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      const camera = cameraRef.current;

      const mouseWorld = screenToWorld(
        e.clientX,
        e.clientY
      );

      const zoomFactor =
        e.deltaY < 0 ? 1.1 : 0.9;

      const newZoom = Math.min(
        Math.max(
          camera.zoom * zoomFactor,
          0.1
        ),
        5
      );

      camera.zoom = newZoom;

      camera.x =
        e.clientX -
        mouseWorld.x * camera.zoom;

      camera.y =
        e.clientY -
        mouseWorld.y * camera.zoom;

      render();
    }

    canvas.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
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

export default App