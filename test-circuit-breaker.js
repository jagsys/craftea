// Test the circuit breaker functionality for validation
// This simulates the church creation infinite loop scenario

console.log('🧪 Testing Circuit Breaker Functionality\n');

// Simulate the validation function
const validationHistory = new Map();

function simulateValidation(conversationId, nodes, attempt) {
  console.log(`\n📝 Attempt ${attempt}:`);
  console.log(`   Testing plan with ${nodes.length} nodes`);

  // Group nodes by Y-level
  const levels = new Map();
  nodes.forEach(node => {
    const yKey = node.y;
    if (!levels.has(yKey)) {
      levels.set(yKey, []);
    }
    levels.get(yKey).push(node);
  });

  const sortedLevels = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);

  // Validation issues
  const issues = [];
  const suggestedFixes = [];

  // Check Y-levels (should be 3 for house)
  if (sortedLevels.length !== 3) {
    issues.push(
      `House requires 3 Y-levels (base, wall-tops, apex), but found ${sortedLevels.length} levels`
    );
    issues.push(
      `Found Y-levels: ${sortedLevels.map(([y, nodes]) => `y=${y} (${nodes.length} nodes)`).join(', ')}`
    );

    // Provide concrete fixes
    if (sortedLevels.length === 1) {
      const baseY = sortedLevels[0][0];
      const baseNodes = sortedLevels[0][1];
      suggestedFixes.push(
        `CRITICAL: You created all nodes at the same Y-level (y=${baseY}). Houses need 3 DIFFERENT heights:`
      );
      suggestedFixes.push(`  1. Base floor at y=0 (4 corner nodes)`);
      suggestedFixes.push(`  2. Wall-tops at y=2 or y=3 (4 corner nodes, SAME X/Z as base but DIFFERENT Y)`);
      suggestedFixes.push(`  3. Roof apex at y=3.5 or y=4 (1 center node)`);

      if (baseNodes.length >= 4) {
        suggestedFixes.push(``);
        suggestedFixes.push(`Example fix for your structure:`);
        baseNodes.slice(0, 4).forEach((node, i) => {
          suggestedFixes.push(`  - Keep ${node.name} at (${node.x}, 0, ${node.z}) for base`);
          suggestedFixes.push(`  - Create N${5+i} at (${node.x}, 3, ${node.z}) for wall-top ABOVE ${node.name}`);
        });
        suggestedFixes.push(`  - Create N9 at center position with y=4 for roof apex`);
      }
    }
  }

  // Base should have 4 nodes
  if (sortedLevels.length > 0 && sortedLevels[0][1].length !== 4) {
    const baseLevel = sortedLevels[0];
    issues.push(
      `Base layer should have 4 corner nodes, found ${baseLevel[1].length} nodes at y=${baseLevel[0]}`
    );
    if (baseLevel[1].length > 4) {
      suggestedFixes.push(
        `Too many nodes at base level (y=${baseLevel[0]}). You may have duplicate nodes or wall-top nodes at wrong Y-level.`
      );
      suggestedFixes.push(`Base nodes found: ${baseLevel[1].map(n => n.name).join(', ')}`);
      suggestedFixes.push(`Make sure wall-top nodes (N5-N8) are at a HIGHER Y value like y=3, not y=${baseLevel[0]}`);
    }
  }

  const valid = issues.length === 0;

  console.log(`   Result: ${valid ? '✅ PASSED' : '❌ FAILED'}`);

  if (!valid) {
    console.log(`   Issues detected:`);
    issues.forEach(issue => console.log(`     - ${issue}`));

    // Circuit breaker logic
    const errorSignature = JSON.stringify(issues.slice(0, 2));
    const history = validationHistory.get(conversationId) || { count: 0, lastError: '' };

    if (history.lastError === errorSignature) {
      history.count++;
    } else {
      history.count = 1;
      history.lastError = errorSignature;
    }

    validationHistory.set(conversationId, history);

    console.log(`   Failure count for this error: ${history.count}`);

    // Trigger circuit breaker at 3 failures
    if (history.count >= 3) {
      console.log('\n🚨 ================================');
      console.log('🚨 CIRCUIT BREAKER ACTIVATED!');
      console.log('🚨 ================================\n');
      console.log(`⚠️  Same validation error repeated ${history.count} times`);
      console.log(`⚠️  Infinite loop detected - stopping validation retries\n`);

      console.log('📋 Suggested Fixes:');
      suggestedFixes.forEach(fix => console.log(`   ${fix}`));

      console.log('\n💡 Recommended Actions:');
      console.log('   1. STOP retrying the same approach');
      console.log('   2. Ask the user for clarification');
      console.log('   3. Try a completely different approach');
      console.log('   4. Consider if this structure is too complex\n');

      return { valid: false, circuitBreakerTriggered: true, issues, suggestedFixes };
    }

    return { valid: false, circuitBreakerTriggered: false, issues, suggestedFixes };
  }

  // Clear history on success
  validationHistory.delete(conversationId);
  return { valid: true };
}

// Test Case: Simulate the church infinite loop scenario
console.log('Test Scenario: Church creation with all nodes at y=0 (same as original bug)\n');
console.log('This simulates the AI repeatedly creating the same incorrect plan...\n');

const conversationId = 'test-conversation-1';

// The problematic plan that keeps getting created (all nodes at y=0)
const badPlan = [
  { name: 'N1', x: 0, y: 0, z: 0 },   // Floor corners
  { name: 'N2', x: 4, y: 0, z: 0 },
  { name: 'N3', x: 4, y: 0, z: 3 },
  { name: 'N4', x: 0, y: 0, z: 3 },
  { name: 'N5', x: 0, y: 0, z: 0 },   // WRONG! Wall-tops at same Y as floor
  { name: 'N6', x: 4, y: 0, z: 0 },
  { name: 'N7', x: 4, y: 0, z: 3 },
  { name: 'N8', x: 0, y: 0, z: 3 },
  { name: 'N9', x: 2, y: 0, z: 1.5 }, // WRONG! Apex at same Y too
];

// Simulate 5 attempts with the same bad plan
for (let i = 1; i <= 5; i++) {
  const result = simulateValidation(conversationId, badPlan, i);

  if (result.circuitBreakerTriggered) {
    console.log('✅ Circuit breaker successfully prevented infinite loop!');
    console.log('✅ AI would now be forced to ask user for help instead of retrying');
    break;
  }

  if (i === 5) {
    console.log('\n❌ Test failed - circuit breaker did not trigger after 5 attempts');
  }
}

console.log('\n' + '='.repeat(70));
console.log('\n🎯 Test Summary:');
console.log('   Before: AI would retry 25+ times until recursion limit');
console.log('   After:  Circuit breaker triggers at 3 failures, preventing infinite loop');
console.log('   Result: AI receives concrete fix suggestions and warning to stop retrying\n');
