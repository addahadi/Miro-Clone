# Miro Clone — Tickets (Phase 0 & 1)

> Scope: the **engine only** — walking skeleton + core single-player whiteboard (local, IndexedDB). Backend, auth, and multiplayer tickets come later.
> Ordered so each ticket leaves you with something you can run and see. Do them roughly top-to-bottom.
> Testing convention: tickets marked 🧪 have pure-logic that should get Vitest tests **in the same ticket**.

Legend: **Deps** = must be done first. **AC** = acceptance criteria (what must be true). **Decisions** = choices already made so you don't have to re-litigate them. **Done when** = the crisp check that the ticket is finished.

---

## Conventions (apply to every ticket)

These are the project-wide rules the individual tickets assume. If a ticket seems ambiguous, the answer is probably here.

- **Source of truth for types:** `packages/shared`. It stays **framework-free** (zero React/DOM imports). `web` and (later) `server` both import from it.
- **Two coordinate spaces:**
  - **World space** — the infinite canvas. **All shape coordinates are world coords.**
  - **Screen space** — pixels on the `<canvas>`. Only pointer events and rendering touch screen space.
  - Convert **only** via the pure `worldToScreen` / `screenToWorld` from P0-4. Never hand-roll the transform inline.
- **Command naming:** `SCREAMING_SNAKE_CASE` string literal `type` (`CREATE_SHAPE`, `MOVE_SHAPE`, …), matching the existing `Command` union. Payload fields are plain data (serializable — no functions, no class instances, no DOM nodes).
- **Immutability:** state is never mutated in place. The reducer returns a **new** `EngineState` (spread copies). This is what makes undo/redo and future multiplayer safe.
- **Single chokepoint:** every document change flows through `engine.dispatch(command)`. Components never touch `engine.state` directly — they read via `getState()` and write via `dispatch()`.
- **IDs:** shape ids are strings, generated with `crypto.randomUUID()`. Never reuse an id; paste/duplicate always mints new ones.
- **Undoable vs. ephemeral:** only commands that mutate the `BoardDocument` are undoable (see P1-2 table). Camera (`PAN`/`ZOOM`) and selection (`SELECT`) are ephemeral view/UI state and never touch the undo stack.
- **`Shape` base fields** (per SPEC §4.1 — add these as you go): `id`, `type` (`'rect' | 'ellipse' | 'sticky' | 'text' | 'freehand'`), `x`, `y`, `width`, `height`, `z` (stacking order), optional `rotation`, plus per-type style/content fields.
- **Testing bar:** pure logic (transforms, hit-tests, command invert, serialization) is unit-tested. UI wiring is verified by running the app. 🧪 marks tickets where the tests ship **in the same ticket**.

---

## Phase 0 — Walking skeleton
*Outcome: a `<canvas>` you can pan/zoom, with one hardcoded rectangle you can drag.*

### P0-1 — Monorepo scaffold
**What & why:** Give every later ticket a home and a shared type package, so `web` and `server` can both depend on one source of truth.
- **Deps:** none
- **AC:**
  - npm (or pnpm) workspaces with `packages/shared`, `apps/web`, `apps/server` (server may be an empty stub).
  - Root TS project references / path alias so `web` imports from `shared` (e.g. `import { Shape } from "@miro/shared"`).
  - `apps/web` runs a React + TS Vite dev server showing a placeholder page.
  - Vitest runs from the repo root (`npm run test`) with one trivial passing test.
  - `npm run typecheck` (`tsc -b`) passes across all workspaces.
- **Decisions:** Package scope is `@miro/*`. `shared` builds to `dist` and is consumed as a workspace dependency.
- **Notes:** Keep `shared` framework-free. Don't add Express deps yet.
- **Done when:** `npm run dev`, `npm run test`, and `npm run typecheck` all succeed from a clean clone.

### P0-2 — Full-viewport canvas + render loop
**What & why:** Establish the seam — React owns the `<canvas>` DOM element; the engine owns the pixels. React state must **never** drive per-frame drawing.
- **Deps:** P0-1
- **AC:**
  - A React component renders a `<canvas>` filling the viewport and resizing on `window` resize.
  - `devicePixelRatio` handled: backing store sized to `innerWidth*dpr × innerHeight*dpr`, context scaled by `dpr` so drawing stays in CSS pixels and is crisp on HiDPI.
  - Drawing happens in a plain-TS `render()` in the engine module, **not** in a React render.
- **Decisions:** **Render on change, not per frame.** Instead of a permanent `requestAnimationFrame` loop, the renderer subscribes to the engine and redraws when state changes (plus once on mount/resize). This matches P1-1's "a change triggers a redraw" and avoids burning frames while idle. (If a future ticket needs continuous animation, add a scoped RAF loop then.)
- **Notes:** The canvas element is controlled by React via a `ref`; everything drawn inside it is the engine's job.
- **Done when:** Resizing the window keeps the canvas full-bleed and crisp, and drawing is driven by engine state, not React re-renders.

### P0-3 — Shared domain types v0 🧪
**What & why:** Nail down the data model everything else references.
- **Deps:** P0-1
- **AC:**
  - `packages/shared` exports `Camera`, `ShapeId`, `BaseShape`, the `Shape` union, `BoardDocument`, and `EngineState` per SPEC §4.1.
  - `Shape` includes `type` and `z` from the start (needed for rendering-by-type in P1-9+ and z-order in P1-4/P1-14).
  - Types compile and import cleanly from `web`.
- **Decisions:** `Shape` is a discriminated union on `type`. `BoardDocument.shapes` is `Record<ShapeId, Shape>` (keyed map, not array) — ordering is derived from `z`, not array position. `EngineState = { document: BoardDocument; camera: Camera; selection: { ids: ShapeId[] } }`.
- **Tests:** Type-level only is fine (a compile check). No runtime test required.
- **Done when:** `tsc -b` passes and `web` can import and use every exported type.

### P0-4 — Camera model + coordinate transforms 🧪
**What & why:** The single most important primitive — everything spatial depends on correct transforms.
- **Deps:** P0-3
- **AC:**
  - Pure functions in `shared`: `worldToScreen(pt, camera)` and `screenToWorld(pt, camera)` for `Camera { x, y, zoom }`.
  - Transform definition: `screen = world * zoom + cameraOffset`; inverse `world = (screen - cameraOffset) / zoom`.
  - Round-trip property: `screenToWorld(worldToScreen(p, cam), cam) ≈ p` for random points and cameras.
- **Tests (highest value in the project):**
  - Pure translation (`zoom = 1`, non-zero `x/y`).
  - Pure zoom (origin fixed, `zoom ≠ 1`).
  - Round-trip on randomized points/cameras (use an epsilon for float compare).
- **Done when:** All three test groups pass and the functions are the only place the transform math lives.

### P0-5 — Render a hardcoded rectangle via the camera
**What & why:** Prove the transform end-to-end by drawing something the camera actually moves.
- **Deps:** P0-2, P0-4
- **AC:**
  - One hardcoded rect (world coords) is seeded into the document and drawn each render using the camera transform.
  - Changing the camera in code visibly translates/scales the rect correctly.
- **Decisions:** Seed the rect by dispatching a `CREATE_SHAPE` at startup (don't special-case it) so it flows through the same path as user-created shapes later.
- **Done when:** Editing `camera.x/y/zoom` in code moves/scales the on-screen rect exactly as the math predicts.

### P0-6 — Pan & zoom
**What & why:** Make the infinite canvas navigable.
- **Deps:** P0-5
- **AC:**
  - Pan by dragging empty canvas (and/or space+drag); the rect stays put in **world** space while the view moves.
  - Zoom via mouse wheel, **toward the cursor** (the world point under the cursor stays under the cursor), derived from `screenToWorld` at the cursor.
  - Zoom clamped to a sensible range.
- **Decisions:** Zoom clamp is **0.1× – 8×**. Wheel zoom factor is 1.1 per notch (in) / 0.9 (out). Middle-mouse **or** left-drag-on-empty pans.
- **Done when:** You can pan and zoom-to-cursor smoothly, the rect tracks world space, and zoom never exceeds the clamp.

### P0-7 — Hit-testing + drag the rectangle 🧪
**What & why:** First direct manipulation; introduces the pure hit-test used by selection later.
- **Deps:** P0-6
- **AC:**
  - Pure `hitTest(worldPoint, shape)` returns whether the point is inside the shape (rect: bounding-box test).
  - Clicking the rect and dragging moves it in world space; correct at any zoom/pan (convert the screen delta to world by dividing by `zoom`).
- **Tests:** `hitTest` inside, outside, and exactly on each edge/corner.
- **✅ Phase 0 done:** draggable rectangle on an infinite pan/zoom canvas.

---

## Phase 1 — Core engine (local, IndexedDB)
*Outcome: a fully usable single-player whiteboard with no server.*

### P1-1 — Engine state store + single dispatch chokepoint
**What & why:** Centralize all state behind one mutation path so rendering, undo, and later multiplayer all have a single seam.
- **Deps:** P0-7
- **AC:**
  - An engine store holds `EngineState` = current `BoardDocument` (shapes keyed by id) + `camera` + `selection`.
  - **All** state changes go through one `dispatch(command)`; nothing mutates the document directly. The reducer returns a new immutable state.
  - `getState()` returns the current (immutable) snapshot; `subscribe(listener)` notifies on every change and returns an unsubscribe fn.
  - Renderer subscribes and redraws on change.
  - React can subscribe to **derived** UI state (selection, later active tool) via the same subscription without driving per-frame canvas rendering (e.g. `useSyncExternalStore` selecting `state.selection`).
- **Decisions:** `dispatch` is the only writer. `getState()` returns fresh object references on change (immutable updates) so `useSyncExternalStore` works. Add a `default: return state;` (or `assertNever(command)`) to the reducer so an unhandled command type is a compile error rather than a silent `undefined` state.
- **Done when:** A dispatched command updates state, subscribers fire once, the canvas redraws, and no code path mutates `document` in place.

### P1-2 — Command pattern + undo/redo 🧪
**What & why:** Turn state changes into serializable, reversible data — the backbone of undo/redo (and, later, the multiplayer protocol).
- **Deps:** P1-1
- **AC:**
  - `Command` is serializable data (`{ type, ...payload }`). Each **document** command can produce an inverse (an `invert(doc)` method, an inverse-command factory, or enough payload — like `MOVE_SHAPE`'s `from`/`to` — to reverse it).
  - Undo and redo stacks store **commands/inverses, not snapshots**.
  - `dispatch` pushes **invertible (document-mutating) commands only** onto the undo stack and clears the redo stack; view/UI commands bypass the stack.
  - `undo()` applies the inverse and moves the command to the redo stack; `redo()` re-applies it.
- **Tests:** for each invertible command type, `apply` then `invert` returns the document to its exact prior state (deep-equal). Also: `dispatch` of a `PAN`/`ZOOM`/`SELECT` leaves the undo stack untouched.
- **Habit:** every future command ticket adds its own `invert` round-trip test here.

- **Which commands are invertible?** The rule: a command is invertible **iff it mutates the persistent `BoardDocument`**. Camera and selection are ephemeral view/UI state — they must **not** go on the undo stack (nobody expects Ctrl+Z to un-pan or reselect).

  | Command | Mutates document? | Invertible / on undo stack? | Inverse |
  |---|---|---|---|
  | `CREATE_SHAPE` | ✅ shapes | ✅ **yes** | delete the created shape |
  | `MOVE_SHAPE` | ✅ shapes | ✅ **yes** | move back (`from`/`to` swapped) |
  | *(future)* `RESIZE_SHAPE` | ✅ shapes | ✅ **yes** | restore prior bounds |
  | *(future)* `DELETE_SHAPE` | ✅ shapes | ✅ **yes** | re-create the shape (store its full data) |
  | *(future)* `SET_Z` / z-order | ✅ shapes | ✅ **yes** | restore prior `z` |
  | *(future)* `EDIT_TEXT` | ✅ shapes | ✅ **yes** | restore prior text |
  | `PAN` | ❌ camera only | ❌ **no** | — (view state) |
  | `ZOOM` | ❌ camera only | ❌ **no** | — (view state) |
  | `SELECT` | ❌ selection only | ❌ **no** | — (UI state) |

  Implementation implication: `dispatch` (or the command definition itself) needs a way to know a command's category — e.g. an `invert` method that only document commands implement, an `undoable: boolean` flag, or splitting into `dispatchCommand` (document, undoable) vs. `setView`/`setSelection` (ephemeral). **Decision:** use an explicit **`undoable` predicate keyed by command `type`** (a `Set` of document command types), so the routing lives in one place and camera/selection commands are impossible to accidentally record.
- **Done when:** undo/redo work for create and move, view/selection commands never appear on the stack, and every invert round-trip test is green.

### P1-3 — Tool / interaction system
**What & why:** Route pointer input to a swappable "active tool" so each tool owns its own interaction logic.
- **Deps:** P1-1
- **AC:**
  - A tool manager tracks the active tool; pointer `down`/`move`/`up` (and key events) route to it.
  - Each tool implements a small interface: `onPointerDown`, `onPointerMove`, `onPointerUp`, `onActivate`/`onDeactivate` (enter/exit), `onCancel` (ESC).
  - Ships with at least a `select` tool and a base class/interface for shape-creation tools.
  - Switching tools cleanly deactivates the old and activates the new; **ESC cancels an in-progress interaction** (e.g. an unfinished drag) without committing a command.
- **Decisions:** Active tool lives in the engine store (so React toolbar can subscribe to it). Tools receive events already converted to **world coords** by the manager, so individual tools never call `screenToWorld` themselves.
- **Done when:** You can register tools, switch between them, pointer events reach the active tool in world space, and ESC aborts an in-progress interaction with no state change.

### P1-4 — Select tool: single selection 🧪
**What & why:** First real selection; establishes topmost-hit resolution used everywhere.
- **Deps:** P1-2, P1-3
- **AC:**
  - Click selects the **topmost** shape under the cursor (highest `z`); clicking empty space deselects.
  - Selection lives in the store (`selection.ids`) and is set via a `SELECT` command.
  - A pure helper resolves the topmost hit given a world point and the shape set.
- **Tests:** given overlapping shapes at different `z`, the click resolves to the highest-`z` shape whose `hitTest` passes; a click on empty space returns none.
- **Done when:** Clicking picks the top shape at any zoom/pan, empty-click clears selection, and the resolution test passes.

### P1-5 — Multi-select (shift-click + marquee)
**What & why:** Let users act on groups.
- **Deps:** P1-4
- **AC:**
  - Shift-click toggles a shape in/out of the selection.
  - Dragging on empty canvas draws a marquee rectangle (rendered live); on release, matching shapes are selected.
- **Decisions:** Marquee uses **intersection** semantics — any shape whose bounding box intersects the marquee is selected (simpler and more forgiving than containment). Document this in-app if it ever confuses. Marquee itself is ephemeral UI state (not a command); only the resulting `SELECT` is dispatched.
- **Done when:** Shift-click adds/removes correctly and a marquee drag selects every intersecting shape on release.

### P1-6 — Move selection (as a command) 🧪
**What & why:** Move one or many shapes as a single undoable step.
- **Deps:** P1-4, P1-2
- **AC:**
  - Dragging a selected shape (or set) moves **all** selected shapes together.
  - Live drag is smooth (visual position updates during the drag), but **only one `move` command is committed on release** — undo reverts the whole drag in one step, not per-pixel.
- **Decisions:** During the drag, apply movement as ephemeral/live updates (or a single coalesced command replaced each move); on pointer-up, commit exactly one `MOVE_SHAPE`-style command carrying `from`/`to` per shape (or a batch). Do **not** push every intermediate move onto the undo stack.
- **Tests:** `move` invert round-trip (multi-shape): apply then invert restores every shape's original position.
- **Done when:** A drag of a multi-selection moves all shapes, one undo reverts the entire drag, and the invert test passes.

### P1-7 — Selection UI + resize handles (as a command) 🧪
**What & why:** Direct-manipulation resize with visible handles.
- **Deps:** P1-6
- **AC:**
  - Selected shapes render a bounding box with **8 resize handles** (4 corners + 4 edges).
  - Dragging a handle resizes the shape(s); commits a single `RESIZE_SHAPE` command on release (undoable as one step).
  - Handles are **screen-space-sized** — constant on-screen pixel size regardless of zoom (compute their world size as `handlePx / zoom`).
- **Decisions:** For a multi-selection, resize operates on the combined bounding box (scale children proportionally). Minimum size clamp so shapes can't invert/collapse to zero.
- **Tests:** `resize` invert round-trip restores prior bounds.
- **Done when:** Handles stay a fixed on-screen size, dragging resizes correctly at any zoom, and the invert test passes.

### P1-8 — Rectangle tool (create command) 🧪
**What & why:** First shape-creation tool; establishes the create/delete command pair.
- **Deps:** P1-3, P1-2
- **AC:**
  - With the rect tool active, click-drag creates a rectangle sized to the drag; commits a `CREATE_SHAPE` command (undoable).
  - New shapes get a fresh `crypto.randomUUID()` id and a `z` above all current shapes.
- **Decisions:** After creating a shape, the tool **switches back to `select`** and selects the new shape (so you can immediately move/resize it). A click without a drag creates nothing (require a minimum drag distance).
- **Tests:** `create` invert (delete removes exactly the created shape) and `delete` invert (re-creates identical shape).
- **Done when:** Drag-create works, the new shape is selected under the select tool, and both invert tests pass.

### P1-9 — Ellipse tool
**What & why:** Second shape; proves the create flow generalizes and introduces non-rectangular hit-testing.
- **Deps:** P1-8
- **AC:**
  - Ellipse creation reuses the rect create flow (define by bounding box).
  - Correct **rendering** (ellipse, not rect) and correct **hit-test** (point-in-ellipse, not bounding box).
- **Decisions:** Point-in-ellipse test: `((px-cx)/rx)² + ((py-cy)/ry)² ≤ 1`. Shared create logic parameterized by shape `type`.
- **Done when:** Ellipses render as ellipses and only register hits inside the actual ellipse, not its bounding corners.

### P1-10 — Sticky note tool
**What & why:** A styled, text-bearing shape with sensible defaults.
- **Deps:** P1-8
- **AC:**
  - Sticky = filled rounded rect with a default size and color, holding text.
  - Created via **click** (default size at the cursor) **or** click-drag (custom size).
  - Text editing is handled in P1-11.
- **Decisions:** Default sticky size ~200×200 world units, default fill a pale yellow. Text defaults to empty until edited.
- **Done when:** Both click and click-drag create a sticky with the default styling, undoable via the create command.

### P1-11 — Text tool + DOM overlay editing
**What & why:** Real text editing using a DOM `<textarea>` overlaid on the canvas.
- **Deps:** P1-8 (and P1-10 for sticky text)
- **AC:**
  - Text tool creates a text shape; double-click a text/sticky shape enters edit mode.
  - Editing uses a temporary DOM `<textarea>` positioned and scaled over the shape (via `worldToScreen` + `zoom`); on blur or ESC, the text commits via an `EDIT_TEXT` command.
  - Sticky notes reuse this same editing path.
  - When not editing, text renders to the canvas (basic word-wrapping acceptable for v1).
- **Decisions:** ESC **commits** current text (not discard) for v1 to keep the model simple — document it. The `<textarea>` is absolutely positioned in a React overlay layer above the canvas, kept in sync with camera on pan/zoom while open.
- **Done when:** You can create/edit text and stickies, the overlay tracks the shape under pan/zoom, committed text survives to the canvas, and edits are undoable.

### P1-12 — Freehand pen tool
**What & why:** Captures freeform strokes as a point array.
- **Deps:** P1-3, P1-2
- **AC:**
  - Pointer-down-drag captures points in **world space**; the stroke renders live during the drag.
  - On release, commits a `CREATE_SHAPE` (freehand) command storing the `points: {x,y}[]` array.
- **Decisions:** Ship a raw polyline first (connect points with line segments). Smoothing (Catmull-Rom / perfect-freehand) is optional polish, not required. Freehand `hitTest` = distance-to-polyline within a small threshold.
- **Done when:** Drawing produces a stroke that persists as one undoable freehand shape.

### P1-13 — Delete + copy / paste / duplicate
**What & why:** Standard editing verbs, all as undoable commands.
- **Deps:** P1-4, P1-2
- **AC:**
  - Delete/Backspace removes the current selection (undoable).
  - Copy/paste (Ctrl/Cmd+C / V) and duplicate (Ctrl/Cmd+D) via an **in-memory** clipboard; pasted/duplicated shapes get **new ids** and a slight positional offset.
  - Every one of these is a command on the undo stack.
- **Decisions:** Clipboard is an in-memory array of cloned shape data (no system clipboard for v1). Paste offset ~10–20 world units down-right; pasted shapes become the new selection.
- **Done when:** Delete, copy/paste, and duplicate all work, produce new ids on paste, and are individually undoable.

### P1-14 — Z-order controls
**What & why:** Let users control stacking.
- **Deps:** P1-4
- **AC:**
  - Bring forward / send backward / bring to front / send to back, each via a command that adjusts `z`.
  - Rendering **and** hit-testing respect `z` everywhere.
- **Decisions:** `z` is a number; "to front" = max(z)+1, "to back" = min(z)−1; forward/backward swap with the adjacent neighbor. Small ticket — fine to skip if time-boxed.
- **Done when:** Reordering visibly changes both draw order and which shape a click selects.

### P1-15 — StorageAdapter + IndexedDB persistence 🧪
**What & why:** Persist the board locally behind a swappable interface (HTTP later, no frontend change).
- **Deps:** P1-1
- **AC:**
  - `StorageAdapter` interface per SPEC §4.4: `load(boardId)`, `save(doc)`, plus board `list`/`create`/`rename`/`delete` (stubs are fine for now).
  - `IndexedDBStorageAdapter` implements it; on startup the app loads a board, creating one if none exists.
- **Decisions:** IndexedDB via a tiny wrapper (or `idb`); one object store keyed by `boardId` holding the serialized `BoardDocument`. Serialization is plain `JSON.stringify`/`parse` — no class instances in the document (enforced by the "commands/shapes are plain data" convention).
- **Tests:** serialization round-trip — `BoardDocument → JSON → BoardDocument` is deep-equal to the original (🧪).
- **Done when:** Reloading the page restores the board from IndexedDB and the round-trip test passes.

### P1-16 — Debounced autosave + save indicator
**What & why:** Save automatically without hammering storage, and show status.
- **Deps:** P1-15
- **AC:**
  - Any **committed** command schedules a debounced (~1–2s idle) save of the full `BoardDocument` via the adapter.
  - `version` increments on each save (concurrency guard for Phase 2).
  - A visible "Saving… / Saved" indicator reflects current status.
- **Decisions:** Debounce ~1.5s. Only document-committing dispatches trigger a save (pan/zoom/selection don't). Indicator states: `idle/Saved`, `Saving…`, `error`.
- **Done when:** Edits auto-save after you pause, `version` climbs, and the indicator tracks the real save state.

### P1-17 — Toolbar + keyboard shortcuts (React chrome)
**What & why:** The React UI layer that drives tools and commands.
- **Deps:** P1-3, P1-8..P1-12
- **AC:**
  - Toolbar to switch tools (select, rect, ellipse, sticky, text, pen) with active-state styling (reads active tool from the store).
  - Undo/redo buttons + shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).
  - Delete and duplicate shortcuts wired.
  - Zoom controls (buttons + reset-to-100%) optional.
- **Decisions:** Shortcuts are ignored while a text `<textarea>` is focused (so typing "v" doesn't switch tools mid-edit). Toolbar subscribes to store state; it doesn't own tool state.
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
