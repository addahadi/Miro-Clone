
// Placeholder page for the P0-1 scaffold.

import { useEffect, useRef, useState } from "react"


type Camera = {
  x: number;
  y: number;
  zoom:number;
}


export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera>({
    x:0,
    y:0,
    zoom:1
  })

  const rectangle = {
    x:0,
    y:0,
    width:200,
    height:100
  }
  
  const isPanning = useRef(false);

  const lastPointer = useRef({
    x: 0,
    y: 0,
  });


  const Render = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const camera = cameraRef.current;


    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.save()

    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);


    ctx.fillStyle = "black"
    ctx.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height
    );

    ctx.restore();
  }

  const handlePointDown = (e:React.PointerEvent<HTMLCanvasElement>) => {
    
    if(e.button !== 1) return

    isPanning.current = true

    lastPointer.current = {
      x: e.clientX,
      y: e.clientY
    }

  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if(!isPanning.current == false) return

    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;

    cameraRef.current.x += dx
    cameraRef.current.y += dy


    lastPointer.current = {
    x: e.clientX,
    y: e.clientY,
    };

    Render();

  }

  function handlePointerUp() {
    isPanning.current = false;
  }
  
  useEffect(()=>{
    Render()
  },[])
  
  
  return (
    <main className="h-screen w-screen">
      <canvas 
        ref={canvasRef} className="fixed inset-0"
        onPointerDown={handlePointDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      ></canvas>
    </main>
  )
}
