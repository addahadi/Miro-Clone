# Miro Clone — Tickets (Phase 0 & 1)

> Scope: the **engine only** — walking skeleton + core single-player whiteboard (local, IndexedDB). Backend, auth, and multiplayer tickets come later.
> Ordered so each ticket leaves you with something you can run and see. Do them roughly top-to-bottom.
> Testing convention: tickets marked 🧪 have pure-logic that should get Vitest tests **in the same ticket**.

Legend: **Deps** = must be done first. AC = acceptance criteria.

---

## Phase 0 — Walking skeleton
*Outcome: a `<canvas>` you can pan/zoom, with one hardcoded rectangle you can drag.*

### P0-1 — Monorepo scaffold
Set up the workspace so everything else has a home.
- **Deps:** none
- **AC:**
  - Monorepo (pnpm or npm workspaces) with `packages/shared`, `apps/web`, `apps/server` (server can be an empty stub for now).
  - Root TS config with path aliases so `web` imports from `shared`.
  - `apps/web` runs a React + TS dev server (Vite) showing a placeholder page.
  - Vitest configured and runnable at the root (`test` script) with one trivial passing test.
- **Notes:** Keep `shared` framework-free. Don't add Express deps yet.

### P0-2 — Full-viewport canvas + render loop
- **Deps:** P0-1
- **AC:**
  - A React component renders a `<canvas>` filling the viewport, resizing on window resize.
  - `devicePixelRatio` handled (crisp on HiDPI): backing store scaled, context scaled.
  - A render loop (`requestAnimationFrame`) clears and redraws each frame; FPS stable.
  - Engine draws to the canvas via a plain-TS module, **not** React state per frame.
- **Notes:** This is the seam — React owns the `<canvas>` element; the engine owns the pixels.

### P0-3 — Shared domain types v0 🧪
- **Deps:** P0-1
- **AC:**
  - `packages/shared` exports `Shape` (union), `BaseShape`, `BoardDocument`, `Camera` per SPEC §4.1.
  - Types compile and are importable from `web`.
  - (Test optional here — mostly type-level.)

### P0-4 — Camera model + coordinate transforms 🧪
- **Deps:** P0-3
- **AC:**
  - Pure functions `worldToScreen(pt, camera)` and `screenToWorld(pt, camera)` given `Camera {x, y, zoom}`.
  - Round-trip property: `screenToWorld(worldToScreen(p)) ≈ p` for random points/cameras.
  - Unit tests cover translation, zoom, and round-trip. **These are the highest-value tests in the project.**

### P0-5 — Render a hardcoded rectangle via the camera
- **Deps:** P0-2, P0-4
- **AC:**
  - One hardcoded rect (world coords) draws on the canvas using `worldToScreen`.
  - Changing the camera in code visibly moves/scales the rect correctly.

### P0-6 — Pan & zoom
- **Deps:** P0-5
- **AC:**
  - Pan by dragging empty canvas (and/or space+drag); rect stays put in world space.
  - Zoom via mouse wheel, **zoomed toward the cursor position** (not canvas origin).
  - Sensible zoom clamp (e.g. 0.1×–8×).
- **Notes:** Zoom-to-cursor is the classic subtle bit — derive it from `screenToWorld` at the cursor.

### P0-7 — Hit-testing + drag the rectangle 🧪
- **Deps:** P0-6
- **AC:**
  - Pure `hitTest(worldPoint, shape)` returns whether the point is inside the rect.
  - Clicking the rect and dragging moves it (in world space); works correctly at any zoom/pan.
  - Unit tests for `hitTest` (inside, outside, edges).
- **✅ Phase 0 done:** draggable rectangle on an infinite pan/zoom canvas.

---

## Phase 1 — Core engine (local, IndexedDB)
*Outcome: a fully usable single-player whiteboard with no server.*

### P1-1 — Engine state store + single dispatch chokepoint
- **Deps:** P0-7
- **AC:**
  - An engine store holds the current `BoardDocument` (shapes keyed by id) + `camera` + selection.
  - **All** state changes go through one `dispatch(command)` method. Nothing mutates the document directly.
  - Renderer reads from the store; a change triggers a redraw.
  - React can subscribe to derived UI state (selection, active tool) without driving per-frame rendering.

### P1-2 — Command pattern + undo/redo 🧪
- **Deps:** P1-1
- **AC:**
  - `Command` is serializable data (`{ type, ...payload }`). Each command has `apply(doc)` and `invert(doc)` (or produces an inverse).
  - Undo and redo stacks store commands/inverses (**not snapshots**).
  - `dispatch` pushes to undo stack and clears redo; `undo()` / `redo()` work.
  - Tests: for each command type, `apply` then `invert` returns the document to its prior state.
- **Habit:** every future command ticket adds its own `invert` round-trip test here.

### P1-3 — Tool / interaction system
- **Deps:** P1-1
- **AC:**
  - A tool manager with an active tool; pointer events (down/move/up) route to the active tool.
  - Tools: at minimum `select` and a base for shape-creation tools.
  - Switching tools is clean (enter/exit); ESC cancels an in-progress interaction.

### P1-4 — Select tool: single selection 🧪
- **Deps:** P1-2, P1-3
- **AC:**
  - Click selects the **topmost** shape under the cursor (respects z-order); click empty deselects.
  - Selection state lives in the store.
  - Test the topmost-hit resolution given overlapping shapes.

### P1-5 — Multi-select (shift-click + marquee)
- **Deps:** P1-4
- **AC:**
  - Shift-click adds/removes a shape from selection.
  - Drag on empty canvas draws a marquee; shapes intersecting (or contained — pick one, document it) get selected on release.

### P1-6 — Move selection (as a command) 🧪
- **Deps:** P1-4, P1-2
- **AC:**
  - Dragging a selected shape (or set) moves all selected shapes; commits a single `move` command on release (undoable as one step).
  - Live drag is smooth; only the final delta is committed to the undo stack.
  - `move` invert test.

### P1-7 — Selection UI + resize handles (as a command) 🧪
- **Deps:** P1-6
- **AC:**
  - Selected shapes render a bounding box with 8 resize handles.
  - Dragging a handle resizes; commits a single `resize` command (undoable).
  - Handles are screen-space-sized (constant on-screen size regardless of zoom).
  - `resize` invert test.

### P1-8 — Rectangle tool (create command) 🧪
- **Deps:** P1-3, P1-2
- **AC:**
  - Selecting the rect tool + click-drag creates a rectangle; commits a `create` command (undoable).
  - After creation, tool returns to select (or stays — pick a behavior, document it).
  - `create`/`delete` invert tests.

### P1-9 — Ellipse tool
- **Deps:** P1-8
- **AC:**
  - Ellipse creation reuses the rect create flow (bounding box).
  - Correct **rendering** (ellipse) and correct **hit-test** (point-in-ellipse, not bounding box).

### P1-10 — Sticky note tool
- **Deps:** P1-8
- **AC:**
  - Sticky = filled rounded rect with default size + color, holding text.
  - Created via click (default size) or click-drag.
  - (Text editing handled in P1-11.)

### P1-11 — Text tool + DOM overlay editing
- **Deps:** P1-8 (and P1-10 for sticky text)
- **AC:**
  - Text tool creates a text shape; double-click enters edit mode.
  - Editing uses a temporary DOM `<textarea>` positioned/scaled over the shape; on blur/ESC, text commits via a command.
  - Sticky notes reuse this editing path.
  - Text renders to canvas when not editing (basic wrapping acceptable for v1).

### P1-12 — Freehand pen tool
- **Deps:** P1-3, P1-2
- **AC:**
  - Pointer-down-drag captures points (in world space); renders the stroke live.
  - On release, commits a `create` freehand command storing the point array.
  - Optional: smoothing (Catmull-Rom / perfect-freehand-style). Fine to ship raw polyline first.

### P1-13 — Delete + copy / paste / duplicate
- **Deps:** P1-4, P1-2
- **AC:**
  - Delete/Backspace removes selection (undoable).
  - Copy/paste and duplicate (Ctrl/Cmd+C/V, Ctrl/Cmd+D) via an in-memory clipboard; pasted shapes get new ids and a slight offset.
  - All are commands (undoable).

### P1-14 — Z-order controls
- **Deps:** P1-4
- **AC:**
  - Bring forward / send backward (and to front/back) via commands, adjusting `z`.
  - Render + hit-test respect z-order everywhere. (Small ticket; skip if time-boxed.)

### P1-15 — StorageAdapter + IndexedDB persistence 🧪
- **Deps:** P1-1
- **AC:**
  - `StorageAdapter` interface per SPEC §4.4 (`load`, `save`, plus board list/create/rename/delete stubs).
  - `IndexedDBStorageAdapter` implements it; app loads a board on start, creates one if none.
  - Serialization round-trip test: `BoardDocument → JSON → BoardDocument` is identical (🧪).

### P1-16 — Debounced autosave + save indicator
- **Deps:** P1-15
- **AC:**
  - Any committed command schedules a debounced (~1–2s idle) save of the full `BoardDocument` via the adapter.
  - `version` increments on save.
  - A visible "Saving… / Saved" indicator reflects status.

### P1-17 — Toolbar + keyboard shortcuts (React chrome)
- **Deps:** P1-3, P1-8..P1-12
- **AC:**
  - Toolbar to switch tools (select, rect, ellipse, sticky, text, pen) with active-state styling.
  - Undo/redo buttons + shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).
  - Delete, duplicate shortcuts wired.
  - Zoom controls (buttons + reset-to-100%) optional.
- **✅ Phase 1 done:** a usable single-player whiteboard, persisting locally, with undo/redo and all v1 tools.

---

## Deferred (do NOT start yet — later phases)
- Backend (Express + Postgres), `HttpStorageAdapter`, board dashboard → **Phase 2**
- Auth → **Phase 3**
- Connectors/arrows, images, grouping, snapping, real-time multiplayer → **Phase 3/4**

## Suggested first stopping points
- **First real "win":** after **P0-7** (draggable rect on pan/zoom canvas).
- **First "it's actually a whiteboard":** after **P1-8** (create rectangles + select/move/resize/undo).
- **First "I could use this":** after **P1-16** (persists across refresh).
