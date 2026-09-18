import type { Camera } from "@miro/shared";
import {
  useEffect,
  useRef,
} from "react";


type Rectangle = {
  x:number;
  y:number;
  width:number;
  height:number;
}

type DragMode = "none" | "pan" | "object"

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cameraRef = useRef<Camera>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const rectangleRef = useRef<Rectangle>({
    x:0,
    y:0,
    width:200,
    height:200
  })

  const dragMode = useRef<DragMode>("none");

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

  function isPointInsideRectangle(x:number,y:number){
    
    
    const rectangle = rectangleRef.current

    return (
      x >= rectangle.x &&
      x <= rectangle.x + rectangle.width &&
      y >= rectangle.y &&
      y <= rectangle.y + rectangle.height
    )

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
    const rectangle = rectangleRef.current;
    ctx.fillStyle = "black";
    ctx.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height
    );
    ctx.restore();
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (e.button !== 1 && e.button !== 0) return;

    e.preventDefault();


    const mouseWorld = screenToWorld(e.clientX,e.clientY)
    if (
    e.button === 0 &&
    isPointInsideRectangle(
      mouseWorld.x,
      mouseWorld.y
    )
  ) {
    dragMode.current = "object";
  } else {
    dragMode.current = "pan";
  }

    
    e.currentTarget.setPointerCapture(e.pointerId);

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handlePointerMove(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const mode = dragMode.current;

    if (mode === "none") return;

    const camera = cameraRef.current;

    const dx =
    e.clientX - lastPointer.current.x;

    const dy =
    e.clientY - lastPointer.current.y;

    if (mode === "pan") {
      camera.x += dx;
      camera.y += dy;
    }

    if (mode === "object") {
      const rectangle = rectangleRef.current;

      rectangle.x += dx / camera.zoom;
      rectangle.y += dy / camera.zoom;
    }

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY,
    };

    render();
  }   

  function handlePointerUp(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    dragMode.current = 'none';

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