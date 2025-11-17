# Multi-Agent Architecture for Craftea AI

## Overview

The Craftea AI system has been redesigned with a **multi-agent architecture** to reduce prompt sizes, improve clarity, and make the system more maintainable.

## Architecture

```
User Request
     ↓
[Orchestrator] ←→ [Knowledge Base]
     ↓
┌────────────────────────────────────┐
│  1. PLANNER AGENT                  │
│  Focus: Create detailed plans      │
│  Prompt size: ~500 tokens          │
│  Tools: createPlan                 │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│  2. REVIEWER AGENT                 │
│  Focus: Validate geometry          │
│  Prompt size: ~400 tokens          │
│  Tools: reviewPlan                 │
└────────────────┬───────────────────┘
                 ↓ (if approved)
┌────────────────────────────────────┐
│  3. EXECUTOR AGENT                 │
│  Focus: Execute approved plans     │
│  Prompt size: ~300 tokens          │
│  Tools: createNode, createLine, etc│
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│  4. EXPLAINER AGENT                │
│  Focus: Communicate with user      │
│  Prompt size: ~300 tokens          │
│  Tools: None (pure communication)  │
└────────────────────────────────────┘
```

## Agent Responsibilities

### 1. Planner Agent (`agents/planner-agent.ts`)

**What it does:**
- Interprets user requests
- Generates ASCII art previews
- Creates detailed plans with exact coordinates

**What it doesn't do:**
- Validate geometry (Reviewer's job)
- Execute plans (Executor's job)
- Chat with user (Explainer's job)

**Prompt size:** ~500 tokens (vs. 3000+ in monolithic system)

**Example:**
```typescript
User: "draw letter K"
Planner: Calls createPlan with:
- asciiPreview: ASCII art of K
- steps: ["Create node N1 at (0,0,0)...", ...]
```

### 2. Reviewer Agent (`agents/reviewer-agent.ts`)

**What it does:**
- **ASCII art validation** - Ensures coordinates match visual preview
- Validates geometric correctness
- Checks 2D/3D constraints
- Enforces structure rules (houses, letters, etc.)
- Validates connection patterns

**What it doesn't do:**
- Create plans
- Execute plans
- Chat with user

**Prompt size:** ~400 tokens
**Tools:** `validateAsciiStructure`, `reviewPlan`

**Example:**
```typescript
Input: Plan for house with ASCII art
Reviewer:
  1. Calls validateAsciiStructure → Detects missing wall layer!
  2. Output: { approved: false, feedback: "ASCII shows 3 layers (base/walls/roof) but coordinates only have 2 (base/apex)" }
```

**New ASCII Validation Feature:**
- Compares plan coordinates to ASCII art structure
- Detects Y-axis layering mismatches (e.g., missing wall layer in house)
- Catches pyramid vs house confusion
- Validates vertical alignment and apex positioning

### 3. Executor Agent (`agents/executor-agent.ts`)

**What it does:**
- Executes approved plans
- Calls createNode, createLine, deleteNode, deleteLine
- Calls fixIntersections when needed
- Safe execution with no geometry decisions

**What it doesn't do:**
- Create or validate plans
- Make geometric decisions
- Chat with user

**Prompt size:** ~300 tokens

**Example:**
```typescript
Input: Approved plan
Executor: Calls createNode, createLine tools in sequence
Output: Nodes and lines created
```

### 4. Explainer Agent (`agents/explainer-agent.ts`)

**What it does:**
- Communicates results to user
- Asks clarifying questions
- Handles errors gracefully
- Pure communication, no geometry knowledge

**What it doesn't do:**
- Create, validate, or execute plans
- Make geometry decisions

**Prompt size:** ~300 tokens

**Example:**
```typescript
Input: Execution results
Explainer: "Created letter K with 5 nodes and 4 lines. All connections verified!"
```

## Knowledge Base (`knowledge/geometry-specs.ts`)

Reference data extracted from system prompts:

### Letter Specifications
```typescript
LETTER_SPECS = {
  K: {
    minNodes: 5,
    minEdges: 4,
    description: "Vertical + two diagonals from middle",
    example: { coordinates, connections },
    ascii: "...",
  },
  // ... all letters A-Z
}
```

### Shape Specifications
```typescript
SHAPE_SPECS = {
  cube: { minNodes: 8, minEdges: 12, ... },
  house: { minNodes: 9, minEdges: 16, ... },
  pyramid: { minNodes: 5, minEdges: 8, ... },
}
```

### Dynamic Knowledge Injection

Instead of loading ALL specs into every prompt, the orchestrator injects only what's needed:

```typescript
User: "draw letter K"
→ Orchestrator detects "K"
→ Loads only letter K spec
→ Injects into Planner prompt

User: "draw HELLO"
→ Orchestrator detects word
→ Loads specs for H, E, L, L, O
→ Calculates spacing: "H at x=0-1, E at x=2-3, ..."
→ Injects into Planner prompt
```

## Orchestrator (`orchestrator.ts`)

Coordinates the agents with full implementation:

```typescript
class MultiAgentOrchestrator {
  // Main orchestration flow
  async handleRequest(context) {
    // 1. Check if this is an approval response
    if (this.isApprovalResponse(userRequest)) {
      return await this.executePlan(context);
    }

    // 2. Inject relevant knowledge (only what's needed!)
    const knowledge = this.injectRelevantKnowledge(userRequest);

    // 3. Call Planner Agent with createPlan & getGeometrySpec tools
    const plan = await this.callPlannerAgent(context, knowledge);

    if (!plan) {
      return { message: 'Informational response' };
    }

    // 4. Call Reviewer Agent with reviewPlan tool
    const review = await this.callReviewerAgent({ ...context, plan });

    if (!review.approved) {
      // 5. Revise plan with feedback (calls Planner again)
      return await this.revisePlan(context, review.feedback, knowledge);
    }

    // 6. Present to user for approval
    return { plan, needsUserApproval: true, message: formatPlanForUser(plan) };
  }

  // Each agent has access ONLY to its specific tools:
  // - Planner: createPlan, getGeometrySpec
  // - Reviewer: validateAsciiStructure, reviewPlan
  // - Executor: createNode, createLine, deleteNode, deleteLine, fixIntersections
  // - Explainer: No tools (communication only)
}
```

**Key Features:**
- ✅ Full agent implementations with tool binding
- ✅ Automatic plan revision loop when Reviewer rejects
- ✅ Dynamic knowledge injection (only load specs for requested items)
- ✅ User approval flow for plans before execution
- ✅ Proper error handling and feedback propagation

## Benefits

### 1. Reduced Prompt Sizes
- **Before:** Single 3000+ token prompt
- **After:** 4 agents × ~400 tokens average = ~1600 tokens total
- **Savings:** ~50% reduction + only relevant knowledge injected

### 2. Improved Clarity
- Each agent has a single, focused responsibility
- No confusion about what rules apply when
- Easier to debug and maintain

### 3. Better Validation
- Reviewer agent focuses purely on geometric validation
- No distraction with planning or execution logic
- Can have comprehensive validation rules without cluttering other agents

### 4. Flexible Knowledge Loading
- Letter specs loaded only when needed
- Shape specs loaded only for relevant requests
- Future: Could load from database or API

### 5. Easier Testing
- Test each agent independently
- Mock agent responses
- Validate orchestration flow separately

## Migration Path

To migrate from the current monolithic system:

1. **Phase 1: Create agents** ✅ **COMPLETE**
   - ✅ Created 4 specialized agents (Planner, Reviewer, Executor, Explainer)
   - ✅ Created knowledge base with geometry specs
   - ✅ Created orchestrator with full implementation
   - ✅ Implemented dynamic knowledge injection
   - ✅ Created getGeometrySpec tool
   - ✅ All agent methods fully implemented (no TODOs remaining)

2. **Phase 2: Update backend** 🔄 **NEXT**
   - Modify `/api/chat/route.ts` to use orchestrator
   - Handle multi-agent flow
   - Manage pending plans in session state

3. **Phase 3: Testing**
   - Test each agent independently
   - Test full orchestration flow
   - Verify all existing functionality works

4. **Phase 4: Optimization**
   - Fine-tune agent prompts
   - Add caching for knowledge specs
   - Monitor token usage

## Usage Example

```typescript
import { MultiAgentOrchestrator } from './orchestrator';

const orchestrator = new MultiAgentOrchestrator(apiKey);

const result = await orchestrator.handleRequest({
  apiKey,
  state: { nodes, lines, is2DMode },
  userRequest: "draw letter K",
  conversationHistory: [...],
});

if (result.needsUserApproval) {
  // Show plan to user
  displayPlan(result.plan);

  // Wait for approval
  if (userApproves) {
    const execResult = await orchestrator.handleRequest({
      ...context,
      userRequest: "yes", // Approval response
    });
  }
}
```

## Future Enhancements

1. **Agent Memory**
   - Agents remember previous interactions
   - Learn from corrections

2. **Parallel Execution**
   - Run Planner + Knowledge lookup in parallel
   - Speed up response time

3. **Dynamic Agent Selection**
   - Orchestrator chooses which agents to invoke
   - Skip unnecessary steps

4. **Agent Specialization**
   - Letter specialist agent
   - 3D structure specialist agent
   - Word layout specialist agent

5. **Knowledge API**
   - Load specs from external API
   - Update specs without code changes
   - User-defined custom structures
