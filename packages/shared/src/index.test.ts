import { describe, it, expect } from 'vitest'
import {
  SHARED_VERSION,
  screenToWorld,
  worldToScreen,
  type Camera,
} from './index'

describe('@miro/shared', () => {
  it('is wired up', () => {
    expect(SHARED_VERSION).toBe('0.0.0')
  })
})

describe('coordinate transforms', () => {
  it('pure translation (zoom = 1) offsets by the camera', () => {
    const camera: Camera = { x: 50, y: -30, zoom: 1 }

    // world -> screen adds the camera offset.
    expect(worldToScreen({ x: 10, y: 10 }, camera)).toEqual({
      x: 60,
      y: -20,
    })

    // screen -> world subtracts it back.
    expect(screenToWorld({ x: 60, y: -20 }, camera)).toEqual({
      x: 10,
      y: 10,
    })
  })

  it('pure zoom (origin fixed) scales by the zoom factor', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 2 }

    expect(worldToScreen({ x: 10, y: 5 }, camera)).toEqual({ x: 20, y: 10 })
    expect(screenToWorld({ x: 20, y: 10 }, camera)).toEqual({ x: 10, y: 5 })
  })

  it('round-trips for random points and cameras', () => {
    const EPSILON = 1e-9
    const rand = (min: number, max: number) => min + Math.random() * (max - min)

    for (let i = 0; i < 200; i++) {
      const camera: Camera = {
        x: rand(-1000, 1000),
        y: rand(-1000, 1000),
        zoom: rand(0.1, 8),
      }

      const point = { x: rand(-5000, 5000), y: rand(-5000, 5000) }
      const restored = screenToWorld(worldToScreen(point, camera), camera)

      expect(Math.abs(restored.x - point.x)).toBeLessThan(EPSILON)
      expect(Math.abs(restored.y - point.y)).toBeLessThan(EPSILON)
    }
  })
})
