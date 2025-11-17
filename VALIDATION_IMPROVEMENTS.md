# Validation Improvements - Circuit Breaker Implementation

## Problem Summary

The church creation attempt resulted in an infinite validation loop where the AI:
1. Created a plan with all nodes at y=0 (incorrect - duplicates floor and wall-top nodes)
2. Validation rejected the plan with generic error message
3. AI created the EXACT SAME plan again
4. This repeated 25+ times until hitting LangGraph recursion limit
5. User received error: "GraphRecursionError: Recursion limit of 25 reached"

## Root Causes Identified

1. **Vague Error Messages**: Validation said "Wall-top layer should have 4 corner nodes" but didn't explain HOW to fix it
2. **No Learning Mechanism**: AI couldn't learn from repeated validation failures
3. **Missing Circuit Breaker**: No mechanism to detect and stop infinite loops
4. **Duplicate Node Confusion**: AI created N1-N4 at y=0 AND N5-N8 at y=0 (same coordinates)

## Improvements Implemented

### 1. Enhanced Error Messages with Concrete Examples

**Before:**
```
"Base layer should have 4 corner nodes, found 8 nodes at y=0"
```

**After:**
```
Base layer should have 4 corner nodes, found 8 nodes at y=0

Too many nodes at base level (y=0). You may have duplicate nodes or wall-top nodes at wrong Y-level.
Base nodes found: N1, N2, N3, N4, N5, N6, N7, N8
Make sure wall-top nodes (N5-N8) are at a HIGHER Y value like y=3, not y=0
```

### 2. Specific Coordinate Fix Suggestions

**New Feature:**
When all nodes are at same Y-level, validation now provides exact coordinates:

```
CRITICAL: You created all nodes at the same Y-level (y=0). Houses need 3 DIFFERENT heights:
  1. Base floor at y=0 (4 corner nodes)
  2. Wall-tops at y=2 or y=3 (4 corner nodes, SAME X/Z as base but DIFFERENT Y)
  3. Roof apex at y=3.5 or y=4 (1 center node)

Example fix for your structure:
  - Keep N1 at (0, 0, 0) for base
  - Create N5 at (0, 3, 0) for wall-top ABOVE N1
  - Keep N2 at (4, 0, 0) for base
  - Create N6 at (4, 3, 0) for wall-top ABOVE N2
  ... (etc for all corners)
```

### 3. Circuit Breaker Pattern

**Implementation:**
- Tracks validation attempts per conversation
- Detects when same error repeats 3+ times
- Triggers circuit breaker with critical warning
- Forces AI to stop retrying and ask user for help

**Code:**
```typescript
// Track validation history
const validationHistory = new Map<string, { count: number; lastError: string }>();

// Detect repeated failures
const errorSignature = JSON.stringify(validation.mismatches?.slice(0, 2) || []);
if (history.lastError === errorSignature) {
  history.count++;
} else {
  history.count = 1;
  history.lastError = errorSignature;
}

// Trigger circuit breaker at 3 failures
if (history.count >= 3) {
  return {
    circuitBreakerTriggered: true,
    criticalWarning: [
      '🚨 INFINITE LOOP DETECTED: This validation has failed 3 times with the same error.',
      'RECOMMENDED ACTIONS:',
      '1. STOP retrying the same approach',
      '2. Ask the user for clarification or simplification',
      '3. Try a completely different approach',
      ...
    ]
  };
}
```

### 4. Updated Tool Instructions

Added clear guidance for AI agents:
```
⚠️ CIRCUIT BREAKER: If validation fails 3+ times with the same error, this tool will
trigger a circuit breaker and provide a critical warning. If you receive a circuit
breaker warning:
- STOP retrying the same approach immediately
- Read the suggestedFixes carefully - they contain EXACT coordinates to use
- If still unclear, ask the user for help rather than continuing to retry
```

## Test Results

**Test Scenario:** Simulated the original church bug (all nodes at y=0)

**Before Improvements:**
- Attempt 1-25: Same incorrect plan created repeatedly
- Result: GraphRecursionError after 25 attempts

**After Improvements:**
- Attempt 1: Validation fails with detailed suggestions
- Attempt 2: Same error, count = 2
- Attempt 3: Circuit breaker triggered
- Result: AI receives concrete fixes and warning to stop

```
🚨 CIRCUIT BREAKER ACTIVATED!
⚠️  Same validation error repeated 3 times
⚠️  Infinite loop detected - stopping validation retries

📋 Suggested Fixes:
   - Keep N1 at (0, 0, 0) for base
   - Create N5 at (0, 3, 0) for wall-top ABOVE N1
   ... (exact coordinates for all nodes)

💡 Recommended Actions:
   1. STOP retrying the same approach
   2. Ask the user for clarification
```

## Impact

### Prevents Infinite Loops
- Circuit breaker triggers after 3 failures (not 25+)
- Saves computation time and API costs
- Better user experience

### Improves AI Learning
- Concrete coordinate examples help AI understand what to fix
- Specific error messages point to exact problem
- Suggested fixes provide actionable solutions

### Better Error Recovery
- AI forced to ask user for help instead of spinning
- User notified of issue early (after 3 attempts vs 25)
- Clear guidance on what went wrong

## Files Modified

1. `/Users/andresgarcia/craftea/src/lib/ai/tools/craftea/validateAsciiStructure.ts`
   - Added suggestedFixes to validation return types
   - Implemented circuit breaker logic
   - Enhanced error messages with concrete examples
   - Updated tool instructions

## Testing

Run the test to see circuit breaker in action:
```bash
node test-circuit-breaker.js
```

Expected output: Circuit breaker triggers at attempt 3, preventing infinite loop.

## Future Enhancements

1. **Adaptive Learning**: Track which errors AI commonly makes and provide extra hints
2. **Visual Diff**: Show visual comparison of expected vs actual node positions
3. **Auto-Fix Suggestions**: Provide code snippets AI can directly use
4. **Complexity Detection**: Warn if structure request is too complex before starting
