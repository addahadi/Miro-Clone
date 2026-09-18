# Miro Clone — Specification

> **Project goal (the north star):** Skill-forging. The point is *hand-writing the interesting code* after a year away — canvas math, state management, full-stack wiring — not shipping a polished product. Every decision below optimizes for "I wrote the hard parts myself," while keeping product scope lean enough to actually finish.

---

## 1. Guiding principles

1. **Own the hard parts.** The canvas engine (camera, hit-testing, tools, commands, undo) is written by hand in plain TypeScript. Frameworks handle only chrome.
2. **Single-player first, multiplayer-friendly.** Build for one user now, but shape state so real-time collab bolts on later without a rewrite.
3. **State is a serializable document.** A board is plain data (shapes + metadata) with no live object references baked in. This is what makes persistence swappable and multiplayer possible.
4. **One mutation chokepoint.** All state changes flow through a single `dispatch(command)`. Commands are serializable data, not closures.
5. **Thin vertical slices.** Always have a running thing. Build end-to-end increments, never big-bang integration.

---

## 2. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Canvas rendering | **Canvas 2D (immediate mode)** | Hand-write camera transform, render loop, hit-testing, z-ordering — the meaty learning. |
| App shell / UI | **React + TypeScript** | Trivial toolbars/panels/modals; focus hand-written effort on the engine. |
| Engine | **Framework-agnostic plain TypeScript module** | Zero React dependency. Portable, testable, multiplayer-ready. React just wraps a `<canvas>` and reflects engine state. |
| Language | **TypeScript everywhere** | Types catch rust; geometry code far safer. |
| Backend | **Node + Express + TypeScript** | Boring, transferable; shares domain types with frontend. |
| Database | **PostgreSQL**, board stored as **JSONB** document | Perfect fit for "board is a serializable document" + real SQL/relations for later. |
| Repo | **Monorepo with shared types** | `packages/shared` defines the domain model once, consumed by web + server. |
| Testing | **Vitest on pure engine logic** + light backend route tests. No E2E in v1. | Test the hard-to-eyeball math; skip slow/low-ROI layers. |

**Deliberately avoided:** heavy ORM (prefer raw SQL or a thin query builder like Kysely — rebuilds more real skill); WebGL; CRDT library in v1.

### Suggested monorepo layout
```
miro-clone/
  packages/
    shared/        # BoardDocument, Shape, Command types — single source of truth
  apps/
    web/           # React + engine (plain TS)
    server/        # Express + Postgres
```

---

## 3. v1 feature scope

### Core engine primitives (non-negotiable for v1)
- Infinite canvas: **pan & zoom**
- **Select tool:** click-select, drag-move, marquee/box select, multi-select
- **Resize & move** selected shapes via selection handles
- **Delete**, plus **copy / paste / duplicate**
- **Undo / redo** (command pattern)

### Shape tools (v1 — small, representative set)
- **Rectangle**
- **Ellipse** (nearly free once rectangle works)
- **Sticky note** (rectangle + text — the iconic Miro object)
- **Text** (uses a temporary DOM `<textarea>` overlay while editing)
- **Freehand pen** (point capture, smoothing, path storage)

### Explicitly deferred (NOT v1)
- Connectors / arrows (own sub-project: anchors, re-routing, arrowheads)
- Images, frames, comments, templates
- Grouping, alignment guides, snapping

---

## 4. Core architecture

### 4.1 Data model (shape sketch — refine in code)
```ts
// packages/shared
type ShapeId = string;

interface BaseShape {
  id: ShapeId;
  type: 'rect' | 'ellipse' | 'sticky' | 'text' | 'freehand';
  x: number; y: number;        // world coords (top-left / anchor)
  width: number; height: number;
  rotation?: number;
  z: number;                    // stacking order
  // style fields: fill, stroke, etc. (per-type extensions)
}
// per-type: TextShape adds `text`; FreehandShape adds `points: {x,y}[]`; etc.

interface BoardDocument {
  version: number;              // schema/optimistic-concurrency guard
  id: string;
  name: string;
  shapes: Record<ShapeId, Shape>;
  // ordering derived from shape.z
}
```

### 4.2 Coordinate system
- **World space** = the infinite canvas. Shapes store world coords.
- **Screen space** = pixels on the `<canvas>`.
- A **camera** `{ x, y, zoom }` defines the transform. Engine owns `worldToScreen()` / `screenToWorld()`. These are pure functions — **unit-tested first**.

### 4.3 State & mutations — Command pattern
- Board state is changed **only** by dispatching a serializable command through a single `dispatch(command)`.
- A command is plain data: `{ type: 'move', shapeIds, dx, dy }`, `{ type: 'create', shape }`, etc.
- Each command knows how to `apply()` and `invert()` (or produce its inverse).
- **Undo stack stores commands (or inverses), not snapshots.** Undo = apply inverse; redo = re-apply.
- Serializable commands become the **network protocol** in Phase 4 (multiplayer) with no rework.
- **Habit:** write the `invert()` test right after writing each command.

### 4.4 Persistence — `StorageAdapter` seam
```ts
interface StorageAdapter {
  load(boardId: string): Promise<BoardDocument>;
  save(doc: BoardDocument): Promise<void>;
  // list/create/rename/delete for the board dashboard
}
```
- **Phase 1:** `IndexedDBStorageAdapter` (finish the whole engine with no server).
- **Phase 2:** `HttpStorageAdapter` → Express API. Frontend doesn't care which.
- **Save strategy:** **debounced full-document autosave** (~1–2s idle → PUT whole `BoardDocument`). Show a "Saving… / Saved" indicator.
- **Concurrency:** `version` / `updated_at` column on the board row from day one to guard against stale overwrites later.
- Command-streaming to the server is **deferred to Phase 4**.

---

## 5. Backend (Phase 2+)

- **Multiple named boards, NO auth in v1.**
- `boards` table includes a **nullable `owner_id` from the start** so auth in Phase 3 needs no painful migration.
- Board document lives in a **JSONB column**; id/name/owner/version/timestamps as real columns.
- REST CRUD: list / create / open / rename / delete boards; load / save document.
- Light integration tests against a test DB.

---

## 6. Phased roadmap

### Phase 0 — Walking skeleton (FIRST milestone, keep it tiny)
Monorepo scaffold (`shared`/`web`/`server`), a `<canvas>` that renders, **pan + zoom working**, and **one hardcoded rectangle you can see and drag**. No backend, no persistence. Proves the camera transform + hit-testing loop. *Everything builds on this.*

### Phase 1 — Core engine, local only
Select/marquee/multi-select, move/resize with handles, all v1 shape tools (rect, ellipse, sticky, text, freehand), the command/dispatch system, undo/redo. Persist to **IndexedDB** via `StorageAdapter`. **Outcome: a fully usable single-player whiteboard, zero server.**

### Phase 2 — Backend + multiple boards
Express + Postgres. `StorageAdapter` swaps to HTTP. Board dashboard (list/create/rename/delete). Debounced autosave, version column. **Outcome: full-stack app.**

### Phase 3 — Auth
Signup/login (sessions or JWT), boards owned by users, protected routes. Self-contained skill chunk.

### Phase 4 — Real-time multiplayer (the reward)
WebSockets, presence/cursors, command-streaming replaces full-document PUT. Conflict handling (evolve toward CRDT if desired). This is where every earlier discipline pays off.

---

## 7. Testing plan (v1)

- **Unit (Vitest):** coordinate transforms, hit-testing math, command `apply`/`invert`, undo/redo stack, `BoardDocument` (de)serialization. These are pure functions and where subtle bugs hide.
- **Backend:** light integration tests on CRUD routes (Phase 2+).
- **Skip for v1:** rendering snapshot tests, Playwright/E2E.

---

## 8. Open items to decide in code (not blocking)
- Exact per-shape style fields (fill, stroke, font).
- Freehand smoothing algorithm (e.g. Catmull-Rom / perfect-freehand-style).
- Redraw strategy (full redraw per frame is fine for v1; dirty-rect optimization deferred).
- Local IndexedDB cache alongside the backend (offline resilience) — optional polish.
- Query layer: raw SQL vs Kysely.
