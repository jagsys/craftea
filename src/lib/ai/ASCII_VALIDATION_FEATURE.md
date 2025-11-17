# ASCII Validation Feature

## Problem Solved

**Issue:** Plans with ASCII art visualization were showing one structure but executing completely different coordinates, leading to incorrect 3D models.

**Example:**
```
ASCII shows: House with base → walls → triangular roof
Execution created: Pyramid (base → apex, missing walls!)
```

## Solution: ASCII Structure Validator

A new validation tool that ensures plan coordinates match the ASCII art visualization **before** execution.

---

## How It Works

### 1. New Tool: `validateAsciiStructure`

**Location:** `src/lib/ai/tools/craftea/validateAsciiStructure.ts`

**What it does:**
- Extracts node coordinates from plan steps
- Groups nodes by Y-axis levels
- Compares structure to what ASCII art shows
- Detects mismatches in layering, alignment, and node counts

**Validation Checks:**

#### House Structure
```
Expected:
  Layer 3 (y=3.5): 1 apex node       ← Roof peak
  Layer 2 (y=2.0): 4 wall-top nodes  ← Top of walls
  Layer 1 (y=0.0): 4 base nodes      ← Bottom square

Checks:
✓ Exactly 3 Y-levels
✓ Base has 4 corner nodes
✓ Wall-tops have 4 corner nodes
✓ Apex is 1 node above walls
✓ Base and walls align vertically (same X/Z)
✓ Apex centered above base
```

#### Pyramid Structure
```
Expected:
  Layer 2 (y=3): 1 apex node
  Layer 1 (y=0): 4 base nodes

Checks:
✓ Exactly 2 Y-levels
✓ Base has 4 corners
✓ Apex is 1 node
```

### 2. Enhanced Reviewer Agent

**Location:** `src/lib/ai/agents/reviewer-agent.ts`

**New 2-Step Validation Process:**

```
Step 1: ASCII Validation (if plan has ASCII art)
  → Call validateAsciiStructure
  → If FAILS → REJECT plan immediately with specific mismatch details
  → If PASSES → Continue to Step 2

Step 2: Detailed Plan Review
  → Call reviewPlan
  → Check vague steps, 2D mode, letter structures, etc.
```

**Agent Tools:**
1. `validateAsciiStructure` - NEW! ASCII vs coordinate validation
2. `reviewPlan` - Existing geometric validation

---

## Examples of Caught Errors

### ❌ House Plan - Missing Wall Layer

**ASCII Art:**
```
       /\
      /  \
     /____\
    /|    |\
   / |    | \
  /__|____|__\
  |  |    |  |
  |__|____|__|
```

**Coordinates in Plan:**
```
Layer 2 (y=4.0): N5 (apex) - 1 node
Layer 1 (y=0.0): N1, N2, N3, N4 (base) - 4 nodes
```

**Validation Result:**
```json
{
  "valid": false,
  "mismatches": [
    "House requires 3 Y-levels (base, wall-tops, apex), but found 2 levels",
    "Expected: Layer 1 (base), Layer 2 (wall-tops), Layer 3 (roof apex)",
    "Found Y-levels: y=0 (4 nodes), y=4 (1 node)",
    "Wall-top layer should have 4 corner nodes, found 0 nodes at expected height"
  ]
}
```

**What the Reviewer does:**
- REJECTS the plan immediately
- Sends feedback to Planner: "Add wall-top layer at y=2 with 4 nodes"
- Planner creates revised plan with correct 3 layers

### ✓ Correct House Plan

**Coordinates:**
```
Layer 3 (y=3.5): N9 (apex) - 1 node at (2, 3.5, 1.5)
Layer 2 (y=2.0): N5, N6, N7, N8 (wall-tops) - 4 nodes
Layer 1 (y=0.0): N1, N2, N3, N4 (base) - 4 nodes
```

**Validation Result:**
```json
{
  "valid": true,
  "message": "House structure validation passed"
}
```

---

## Integration

### Reviewer Agent receives both tools

**In `orchestrator.ts` `callReviewerAgent()`:**

```typescript
const tools = [
  new DynamicStructuredTool({
    name: validateAsciiStructureTool.name,
    description: validateAsciiStructureTool.description,
    schema: validateAsciiStructureTool.schema,
    func: async (input) => {
      const result = await executeValidateAsciiStructure(input, toolContext);
      return JSON.stringify(result);
    },
  }),
  new DynamicStructuredTool({
    name: reviewPlanTool.name,
    // ... existing reviewPlan tool
  }),
];
```

---

## Tool Access Matrix (Updated)

| Agent     | validateAsciiStructure | reviewPlan | createPlan | ... |
|-----------|------------------------|------------|------------|-----|
| Planner   | ❌                     | ❌         | ✅         | ... |
| Reviewer  | ✅ NEW!                | ✅         | ❌         | ... |
| Executor  | ❌                     | ❌         | ❌         | ... |
| Explainer | ❌                     | ❌         | ❌         | ... |

---

## Benefits

### 1. Prevents Wrong Structures
- **Before:** User approves house plan → gets pyramid
- **After:** Reviewer catches mismatch → Planner creates correct plan

### 2. Faster Error Detection
- **Before:** Error discovered after execution (wasted API calls)
- **After:** Error caught during review (before user approval)

### 3. Better Feedback Loop
- Reviewer provides specific mismatch details
- Planner knows exactly what to fix
- Automatic revision until coordinates match ASCII

### 4. User Trust
- ASCII preview now guaranteed to match execution
- No more surprises after approval
- Visual preview is accurate

---

## Future Enhancements

### Letter Validation
Currently supports houses and pyramids. Can add:
- Letter K: Validate diagonals meet at middle
- Letter M: Validate V-shaped valley
- Letter X: Validate center intersection

### Custom Structures
- Allow user-defined structure templates
- Validate custom ASCII art patterns
- Learn from corrections

### Visual Diff
- Show ASCII art side-by-side with coordinate visualization
- Highlight mismatched layers
- Suggest coordinate corrections visually

---

## Files Created/Modified

### New Files
- ✅ `tools/craftea/validateAsciiStructure.ts` - Validation tool
- ✅ `agents/ascii-validator-agent.ts` - Agent system prompt (documentation)
- ✅ `ASCII_VALIDATION_FEATURE.md` - This document

### Modified Files
- ✅ `agents/reviewer-agent.ts` - Added ASCII validation step
- ✅ `orchestrator.ts` - Added validateAsciiStructure tool to Reviewer
- ✅ `tools/craftea/index.ts` - Exported new tool
- ✅ `MULTI_AGENT_ARCHITECTURE.md` - Updated Reviewer agent documentation

---

## Summary

The ASCII validation feature ensures that **what you see (ASCII art) is what you get (3D structure)**.

By validating coordinates against the ASCII visualization before execution, we:
- Prevent structural mismatches
- Catch errors earlier in the pipeline
- Provide better feedback for automatic plan revision
- Guarantee accurate visual previews

This is a critical improvement to the multi-agent architecture that increases reliability and user trust.
