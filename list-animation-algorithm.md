# List Drag & Drop — Pseudocode Algorithm (Final)

Replacement-based ghost model for reordering lists via drag and drop.

---

## 1. Data Structures

```
lists = [L[0], L[1], ..., L[n-1]]   // logical order of lists
n = lists.length

d = null                             // index of list being dragged (null if not dragging)
ghostVisible = false                 // whether to render ghost
ghostSlot = null                     // where to render ghost: int (list index) | "LEFT_END" | "RIGHT_END"
p = null                             // drop position (gap index 0..n), distinct from ghostSlot

HoverTarget = {
    type: "LIST" | "LEFT_END" | "RIGHT_END"
    index: int | null                // only set when type == "LIST"
}

SlideDirection = "LEFT" | "RIGHT" | null
```

---

## 2. Pure Calculation Functions

Stateless and testable. Compute what *should* happen given inputs.

### 2.1 Determine Validity and Drop Position

```
function calculateDropInfo(d: int, hover: HoverTarget, n: int) -> { valid: bool, p: int | null }:
    /**
     * Given dragged index d and hover target, returns:
     * - valid: whether this is a valid drop target
     * - p: the drop position (gap index 0..n) if valid, null otherwise
     *
     * Drop position p is a "gap index" where:
     * - p = 0: before lists[0]
     * - p = k (1 <= k <= n-1): between lists[k-1] and lists[k]
     * - p = n: after lists[n-1]
     */
    
    if hover.type == "LIST":
        t = hover.index
        
        if t == d:
            return { valid: false, p: null }
        
        if t < d:
            return { valid: true, p: t }
        else:
            return { valid: true, p: t + 1 }
    
    if hover.type == "LEFT_END":
        if d == 0:
            return { valid: false, p: null }
        return { valid: true, p: 0 }
    
    if hover.type == "RIGHT_END":
        if d == n - 1:
            return { valid: false, p: null }
        return { valid: true, p: n }
    
    // Fallback for unexpected hover type
    return { valid: false, p: null }
```

### 2.2 Determine Which Lists Slide

```
function calculateSlides(d: int, hover: HoverTarget) -> Map<int, SlideDirection>:
    /**
     * Returns a map of listIndex -> slide direction (logical).
     * Ends have no slides.
     * The dragged list's slot (d) is included so it "animates like any other list".
     */
    
    slides = {}
    
    if hover.type != "LIST":
        return slides                // no sliding at ends
    
    t = hover.index
    
    if t == d:
        return slides                // invalid hover, no slides
    
    if t < d:
        // Moving dragged list left: lists t..d slide RIGHT
        for i from t to d:
            slides[i] = "RIGHT"
    else:
        // t > d: moving dragged list right: lists d..t slide LEFT
        for i from d to t:
            slides[i] = "LEFT"
    
    return slides
```

### 2.3 Determine Ghost Slot

```
function calculateGhostSlot(hover: HoverTarget) -> int | "LEFT_END" | "RIGHT_END" | null:
    /**
     * Returns where to render the ghost, distinct from drop position p.
     */
    
    if hover.type == "LIST":
        return hover.index           // ghost replaces hovered list's slot
    
    if hover.type == "LEFT_END":
        return "LEFT_END"
    
    if hover.type == "RIGHT_END":
        return "RIGHT_END"
    
    return null
```

### 2.4 Calculate New Index After Drop

```
function calculateNewIndex(d: int, p: int) -> int:
    /**
     * Converts gap-based drop position p to array index for insertion.
     */
    
    if p <= d:
        return p
    else:
        return p - 1
```

---

## 3. Drag Lifecycle Handlers

Mutate state and trigger rendering. Delegate logic to pure functions.

### 3.1 Drag Start

```
function onDragStart(draggedIndex: int):
    d = draggedIndex
    ghostVisible = false
    ghostSlot = null
    p = null
    
    resetAllAnimations()
    setListOpacity(d, "DIMMED")
```

### 3.2 Drag Move — Over a List

```
function onDragMoveOverList(t: int):
    if d == null:
        return
    
    hover = { type: "LIST", index: t }
    dropInfo = calculateDropInfo(d, hover, n)
    
    if not dropInfo.valid:
        clearGhostAndAnimations()
        return
    
    // Update state
    p = dropInfo.p
    ghostVisible = true
    ghostSlot = calculateGhostSlot(hover)
    
    // Apply animations
    slides = calculateSlides(d, hover)
    applySlideAnimations(slides)
```

### 3.3 Drag Move — To Left End

```
function onDragMoveToLeftEnd():
    if d == null:
        return
    
    hover = { type: "LEFT_END", index: null }
    dropInfo = calculateDropInfo(d, hover, n)
    
    if not dropInfo.valid:
        clearGhostAndAnimations()
        return
    
    p = dropInfo.p
    ghostVisible = true
    ghostSlot = "LEFT_END"
    
    // No sliding at ends
    resetAllAnimations()
```

### 3.4 Drag Move — To Right End

```
function onDragMoveToRightEnd():
    if d == null:
        return
    
    hover = { type: "RIGHT_END", index: null }
    dropInfo = calculateDropInfo(d, hover, n)
    
    if not dropInfo.valid:
        clearGhostAndAnimations()
        return
    
    p = dropInfo.p
    ghostVisible = true
    ghostSlot = "RIGHT_END"
    
    // No sliding at ends
    resetAllAnimations()
```

### 3.5 Drag End / Drop

```
function onDragEnd():
    if d == null:
        return
    
    if not ghostVisible or p == null:
        // Invalid drop or cancelled
        finalizeNoReorder()
        cleanupDragState()
        return
    
    // Calculate final position and apply reorder
    newIndex = calculateNewIndex(d, p)
    moveListFromIndexToIndex(d, newIndex)
    
    finalizeReorderAnimation(d, newIndex)
    cleanupDragState()
```

### 3.6 Drag Cancel

```
function onDragCancel():
    if d == null:
        return
    
    finalizeNoReorder()
    cleanupDragState()
```

---

## 4. Animation & Rendering Helpers

### 4.1 Apply Slide Animations

```
function applySlideAnimations(slides: Map<int, SlideDirection>):
    resetAllAnimations()
    
    for each (index, direction) in slides:
        if direction == "RIGHT":
            setListTransform(index, translateX(+LIST_WIDTH))
        else if direction == "LEFT":
            setListTransform(index, translateX(-LIST_WIDTH))
```

### 4.2 Reset and Clear

```
function resetAllAnimations():
    for i from 0 to n - 1:
        setListTransform(i, translateX(0))


function clearGhostAndAnimations():
    // Clears ghost and animations but does NOT touch opacity.
    // Dragged list should remain dimmed while drag is active.
    ghostVisible = false
    ghostSlot = null
    p = null
    resetAllAnimations()


function cleanupDragState():
    // Pure logical reset; visual cleanup happens in finalize* functions
    d = null
    ghostVisible = false
    ghostSlot = null
    p = null
```

### 4.3 Opacity Control

```
function setListOpacity(index: int, state: "DIMMED" | "NORMAL"):
    if state == "DIMMED":
        lists[index].opacity = 0.5
    else:
        lists[index].opacity = 1.0


function clearAllOpacity():
    for i from 0 to n - 1:
        setListOpacity(i, "NORMAL")
```

---

## 5. Finalization

```
function finalizeNoReorder():
    // Animate lists back to original positions and restore opacity
    resetAllAnimations()
    clearAllOpacity()


function finalizeReorderAnimation(oldIndex: int, newIndex: int):
    // Snap all lists to their new positions and restore opacity
    snapListsToNewLayout()
    clearAllOpacity()


function moveListFromIndexToIndex(fromIndex: int, toIndex: int):
    listToMove = lists[fromIndex]
    lists.removeAt(fromIndex)
    lists.insertAt(toIndex, listToMove)
```

---

## 6. Cursor Detection

```
function detectHoverTarget(cursorX: float, cursorY: float) -> HoverTarget | null:
    // Check left end
    if cursorX < lists[0].leftEdge:
        return { type: "LEFT_END", index: null }
    
    // Check right end
    if cursorX > lists[n - 1].rightEdge:
        return { type: "RIGHT_END", index: null }
    
    // Check each list
    for i from 0 to n - 1:
        if lists[i].containsPoint(cursorX, cursorY):
            return { type: "LIST", index: i }
    
    // Cursor in gap between lists — snap to nearest
    return snapToNearestTarget(cursorX)
```

### Unified Drag Move (Optional)

Single entry point that routes to specific handlers:

```
function onDragMove(cursorX: float, cursorY: float):
    hover = detectHoverTarget(cursorX, cursorY)
    
    if hover == null:
        clearGhostAndAnimations()
        return
    
    switch hover.type:
        case "LIST":
            onDragMoveOverList(hover.index)
        case "LEFT_END":
            onDragMoveToLeftEnd()
        case "RIGHT_END":
            onDragMoveToRightEnd()
```

---

## 7. Rendering Guide

How the UI layer should interpret state during a drag:

```
function render():
    // 1. Render lists in logical order with current opacity/transform
    for i from 0 to n - 1:
        renderList(lists[i], {
            opacity: lists[i].opacity,
            transform: getListTransform(i)
        })
    
    // 2. Render ghost if visible
    if ghostVisible:
        if ghostSlot is int:
            // Ghost replaces hovered list's visual slot
            renderGhostAtSlot(ghostSlot)
        else if ghostSlot == "LEFT_END":
            // Ghost at far left, before all lists
            renderGhostBeforeFirstList()
        else if ghostSlot == "RIGHT_END":
            // Ghost at far right, after all lists
            renderGhostAfterLastList()
```

---

## 8. Decision Table

Quick reference for all valid/invalid states, grouped by hover target:

```
LIST t
  • t == d:  INVALID (no ghost) — hovering dragged list itself
  • t < d:   VALID → ghost at t, p = t, slides t..d-1 RIGHT
  • t > d:   VALID → ghost at t, p = t+1, slides d+1..t LEFT

LEFT END
  • d == 0:  INVALID (no ghost) — already at left end
  • d != 0:  VALID → ghost at LEFT_END, p = 0, no slides

RIGHT END
  • d == n-1: INVALID (no ghost) — already at right end
  • d != n-1: VALID → ghost at RIGHT_END, p = n, no slides
```

---

## 9. Test Cases

For verifying pure calculation functions:

```
// ------------------------------------------------------
// calculateDropInfo tests
// ------------------------------------------------------

// Hovering same list (invalid)
assert calculateDropInfo(0, {type:"LIST", index:0}, 3) == {valid:false, p:null}
assert calculateDropInfo(1, {type:"LIST", index:1}, 3) == {valid:false, p:null}
assert calculateDropInfo(2, {type:"LIST", index:2}, 3) == {valid:false, p:null}

// Hovering list to the right (t > d)
assert calculateDropInfo(0, {type:"LIST", index:1}, 3) == {valid:true, p:2}
assert calculateDropInfo(0, {type:"LIST", index:2}, 3) == {valid:true, p:3}
assert calculateDropInfo(1, {type:"LIST", index:2}, 3) == {valid:true, p:3}

// Hovering list to the left (t < d)
assert calculateDropInfo(1, {type:"LIST", index:0}, 3) == {valid:true, p:0}
assert calculateDropInfo(2, {type:"LIST", index:0}, 3) == {valid:true, p:0}
assert calculateDropInfo(2, {type:"LIST", index:1}, 3) == {valid:true, p:1}

// Left end
assert calculateDropInfo(0, {type:"LEFT_END"}, 3) == {valid:false, p:null}  // already at left
assert calculateDropInfo(1, {type:"LEFT_END"}, 3) == {valid:true, p:0}
assert calculateDropInfo(2, {type:"LEFT_END"}, 3) == {valid:true, p:0}

// Right end
assert calculateDropInfo(0, {type:"RIGHT_END"}, 3) == {valid:true, p:3}
assert calculateDropInfo(1, {type:"RIGHT_END"}, 3) == {valid:true, p:3}
assert calculateDropInfo(2, {type:"RIGHT_END"}, 3) == {valid:false, p:null}  // already at right


// ------------------------------------------------------
// calculateSlides tests
// ------------------------------------------------------

// Dragging from left, hovering right (slides left)
assert calculateSlides(0, {type:"LIST", index:1}) == {1: "LEFT"}
assert calculateSlides(0, {type:"LIST", index:2}) == {1: "LEFT", 2: "LEFT"}
assert calculateSlides(1, {type:"LIST", index:2}) == {2: "LEFT"}

// Dragging from right, hovering left (slides right)
assert calculateSlides(2, {type:"LIST", index:0}) == {0: "RIGHT", 1: "RIGHT"}
assert calculateSlides(2, {type:"LIST", index:1}) == {1: "RIGHT"}
assert calculateSlides(1, {type:"LIST", index:0}) == {0: "RIGHT"}

// Invalid hover (same list) — no slides
assert calculateSlides(0, {type:"LIST", index:0}) == {}
assert calculateSlides(1, {type:"LIST", index:1}) == {}

// Ends — no slides
assert calculateSlides(1, {type:"LEFT_END"})  == {}
assert calculateSlides(1, {type:"RIGHT_END"}) == {}
assert calculateSlides(0, {type:"RIGHT_END"}) == {}
assert calculateSlides(2, {type:"LEFT_END"})  == {}


// ------------------------------------------------------
// calculateNewIndex tests
// ------------------------------------------------------

// p > d: inserting to the right
assert calculateNewIndex(0, 2) == 1
assert calculateNewIndex(0, 3) == 2
assert calculateNewIndex(1, 3) == 2

// p < d: inserting to the left
assert calculateNewIndex(2, 0) == 0
assert calculateNewIndex(2, 1) == 1
assert calculateNewIndex(1, 0) == 0

// p == d: edge case (shouldn't happen with valid drops, but formula handles it)
assert calculateNewIndex(1, 1) == 1


// ------------------------------------------------------
// calculateGhostSlot tests
// ------------------------------------------------------

assert calculateGhostSlot({type:"LIST", index:0})  == 0
assert calculateGhostSlot({type:"LIST", index:1})  == 1
assert calculateGhostSlot({type:"LIST", index:2})  == 2
assert calculateGhostSlot({type:"LEFT_END"})       == "LEFT_END"
assert calculateGhostSlot({type:"RIGHT_END"})      == "RIGHT_END"
```

---

## 10. Invariants

Properties that should always hold:

1. **Dragged list stays dimmed** — From `onDragStart()` until `finalize*()` is called, `lists[d].opacity == 0.5`

2. **Ghost and animations are coupled** — If `ghostVisible == true`, then `ghostSlot != null` and `p != null`

3. **No slides at ends** — When `ghostSlot` is `"LEFT_END"` or `"RIGHT_END"`, all list transforms are zero

4. **Valid hovers only** — `ghostVisible == true` only when the hover would result in a different final index for the dragged list

5. **State consistency** — After `cleanupDragState()`, all of `d`, `ghostVisible`, `ghostSlot`, and `p` are reset to initial values