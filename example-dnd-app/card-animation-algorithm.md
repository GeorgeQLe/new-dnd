---

# Card Drag & Drop — Algorithm (Ghost-gap model, multi-list)

## 1. Data structures

```ts
type ListId = string

type Slide = "UP" | "DOWN"
type SlideMap = Map<number, Slide>      // cardIndex -> slide direction

type HoverTarget =
  | { type: "CARD"; listId: ListId; cardIndex: number; region: "TOP" | "BOTTOM" }
  | { type: "LIST_EMPTY"; listId: ListId }
  | { type: "ABOVE_LIST"; listId: ListId }
  | { type: "BELOW_LIST"; listId: ListId }

type Ghost =
  | { listId: ListId; p: number; newIndex: number } // p: gap index, newIndex: insertion index
  | null

type BoardState = {
  lists: { id: ListId; cards: Card[] }[]
  drag: {
    isDragging: boolean
    draggedCardId: string | null
    sourceListId: ListId | null
    sourceIndex: number | null          // d (index at drag start)
    ghost: Ghost
    slideOffsets: Record<ListId, SlideMap>
  }
}

// Configuration choice for cross-list source behavior:
type CrossListSourceMode = "PLACEHOLDER" | "COLLAPSE"
```

---

## 2. Pure calculation functions

### 2.1 Gap index `p` from hover

```ts
function calculateGapIndex(hover: HoverTarget, m: number): number {
  switch (hover.type) {
    case "LIST_EMPTY": return 0
    case "ABOVE_LIST": return 0
    case "BELOW_LIST": return m
    case "CARD":
      return hover.region === "TOP"
        ? hover.cardIndex
        : hover.cardIndex + 1
  }
}
```

### 2.2 Validity

Same-list: invalid iff `p == d` or `p == d + 1` (the two no-op gaps).

```ts
function isValidSameListDrop(d: number, p: number): boolean {
  return p !== d && p !== d + 1
}

function isValidCrossListDrop(p: number, m: number): boolean {
  return p >= 0 && p <= m
}
```

### 2.3 Convert `(d, p)` to insertion index `newIndex`

```ts
function calculateNewIndexSameList(d: number, p: number): number {
  // Remove-at d first, then insert.
  return (p <= d) ? p : (p - 1)
}

function calculateNewIndexCrossList(p: number): number {
  // Dragged card is not present in destination list.
  return p
}
```

### 2.4 Unified drop info

```ts
function calculateDropInfo(
  sourceListId: ListId,
  d: number,
  destListId: ListId,
  hover: HoverTarget,
  destCount: number
): { valid: boolean; ghost: Ghost } {

  const p = calculateGapIndex(hover, destCount)

  if (destListId === sourceListId) {
    if (!isValidSameListDrop(d, p)) return { valid: false, ghost: null }
    const newIndex = calculateNewIndexSameList(d, p)
    return { valid: true, ghost: { listId: destListId, p, newIndex } }
  } else {
    if (!isValidCrossListDrop(p, destCount)) return { valid: false, ghost: null }
    const newIndex = calculateNewIndexCrossList(p)
    return { valid: true, ghost: { listId: destListId, p, newIndex } }
  }
}
```

---

## 3. Slide calculation (per list)

### 3.1 Initialize slide maps (implicit “none”)

You do not need to store `'none'` for every card; treat absent as none.

```ts
function emptySlidesForAllLists(lists: {id: ListId; cards: Card[]}[]): Record<ListId, SlideMap> {
  const out: Record<ListId, SlideMap> = {}
  for (const l of lists) out[l.id] = new Map()
  return out
}
```

### 3.2 Slides for same-list reordering (destination == source)

Use `newIndex` framing (clean and matches final reorder):

```ts
function calculateSlidesSameList(d: number, newIndex: number): SlideMap {
  const slides = new Map<number, Slide>()

  if (newIndex < d) {
    // moving up: items [newIndex..d-1] shift DOWN
    for (let i = newIndex; i <= d - 1; i++) slides.set(i, "DOWN")
  } else {
    // moving down: items [d+1..newIndex] shift UP
    for (let i = d + 1; i <= newIndex; i++) slides.set(i, "UP")
  }

  return slides
}
```

### 3.3 Slides for cross-list movement

Target list: items at/after insertion point shift DOWN.

```ts
function calculateSlidesTargetCrossList(newIndex: number, destCount: number): SlideMap {
  const slides = new Map<number, Slide>()
  for (let i = newIndex; i <= destCount - 1; i++) slides.set(i, "DOWN")
  return slides
}
```

Source list for cross-list is a **config**:

```ts
function calculateSlidesSourceCrossList(mode: CrossListSourceMode, d: number, sourceCount: number): SlideMap {
  const slides = new Map<number, Slide>()

  if (mode === "PLACEHOLDER") {
    // no collapse: no slides
    return slides
  }

  // COLLAPSE: items after d shift UP
  for (let i = d + 1; i <= sourceCount - 1; i++) slides.set(i, "UP")
  return slides
}
```

### 3.4 Unified slide offsets

```ts
function calculateSlideOffsets(
  lists: {id: ListId; cards: Card[]}[],
  sourceListId: ListId,
  d: number,
  ghost: Ghost,
  crossListSourceMode: CrossListSourceMode
): Record<ListId, SlideMap> {

  const offsets = emptySlidesForAllLists(lists)
  if (ghost == null) return offsets

  const destListId = ghost.listId
  const destCount = lists.find(l => l.id === destListId)!.cards.length

  if (destListId === sourceListId) {
    offsets[sourceListId] = calculateSlidesSameList(d, ghost.newIndex)
    return offsets
  }

  // cross-list
  offsets[destListId] = calculateSlidesTargetCrossList(ghost.newIndex, destCount)

  const sourceCount = lists.find(l => l.id === sourceListId)!.cards.length
  offsets[sourceListId] = calculateSlidesSourceCrossList(crossListSourceMode, d, sourceCount)

  return offsets
}
```

---

## 4. Drag lifecycle handlers

### 4.1 Drag start

```ts
function onDragStart(state: BoardState, listId: ListId, index: number, cardId: string): BoardState {
  return {
    ...state,
    drag: {
      isDragging: true,
      draggedCardId: cardId,
      sourceListId: listId,
      sourceIndex: index,
      ghost: null,
      slideOffsets: emptySlidesForAllLists(state.lists)
    }
  }
}
```

### 4.2 Drag move (hover)

```ts
function onDragMove(
  state: BoardState,
  hover: HoverTarget | null,
  crossListSourceMode: CrossListSourceMode
): BoardState {

  const { isDragging, sourceListId, sourceIndex } = state.drag
  if (!isDragging || sourceListId == null || sourceIndex == null) return state

  if (hover == null) {
    return { ...state, drag: { ...state.drag, ghost: null, slideOffsets: emptySlidesForAllLists(state.lists) } }
  }

  const destListId = hover.listId
  const destCount = state.lists.find(l => l.id === destListId)!.cards.length

  const info = calculateDropInfo(sourceListId, sourceIndex, destListId, hover, destCount)

  if (!info.valid) {
    return { ...state, drag: { ...state.drag, ghost: null, slideOffsets: emptySlidesForAllLists(state.lists) } }
  }

  const slideOffsets = calculateSlideOffsets(state.lists, sourceListId, sourceIndex, info.ghost, crossListSourceMode)

  return {
    ...state,
    drag: {
      ...state.drag,
      ghost: info.ghost,
      slideOffsets
    }
  }
}
```

### 4.3 Drop / end

```ts
function onDrop(state: BoardState): BoardState {
  const { isDragging, draggedCardId, sourceListId, sourceIndex, ghost } = state.drag
  if (!isDragging || draggedCardId == null || sourceListId == null || sourceIndex == null || ghost == null) {
    return cleanupDrag(state)
  }

  const destListId = ghost.listId
  const toIndex = ghost.newIndex

  const lists = cloneLists(state.lists)

  if (destListId === sourceListId) {
    moveWithinList(lists, sourceListId, sourceIndex, toIndex)
  } else {
    moveAcrossLists(lists, sourceListId, destListId, draggedCardId, toIndex)
  }

  return cleanupDrag({ ...state, lists })
}

function cleanupDrag(state: BoardState): BoardState {
  return {
    ...state,
    drag: {
      isDragging: false,
      draggedCardId: null,
      sourceListId: null,
      sourceIndex: null,
      ghost: null,
      slideOffsets: {}
    }
  }
}
```

---

## 5. Rendering rules

* Ghost indicator is rendered at `(ghost.listId, ghost.p)` — i.e., **gap `p`** (visual).
* Slide transforms come from `slideOffsets[listId].get(cardIndex)`:

  * `"UP"` = translateY(-CARD_HEIGHT)
  * `"DOWN"` = translateY(+CARD_HEIGHT)
  * absent = translateY(0)
  * Dragged card:
  * either keep in flow with reduced opacity (placeholder model), or render as floating and hide original (collapse model). This is independent of the reorder math.

---

## 6. Minimal invariants

1. If `ghost != null`, then `ghost.p` and `ghost.newIndex` are non-null and in range.
2. Same-list validity: `ghost != null` implies `ghost.p ∉ {d, d+1}`.
3. `ghost.p` is used only for **visual placement**; `ghost.newIndex` is used for **data mutation**.

---

### Summary of the “final” position model

* Store both:
  * `p` = **gap index** (visual ghost location)
  * `newIndex` = **insertion index** (data operation)
* Same-list invalid gaps are exactly `p == d` and `p == d+1`.
* Slides can be derived from `newIndex` cleanly.
* Cross-list source behavior is a configurable UX choice (`PLACEHOLDER` vs `COLLAPSE`), not a math requirement.