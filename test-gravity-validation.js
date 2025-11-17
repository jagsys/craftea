// Test gravity-based structural validation

console.log('🏗️  Testing Gravity-Based Structural Validation\n');

// Test Case 1: House with missing vertical walls (previous issue)
console.log('Test 1: House with complete perimeters but missing vertical walls');
console.log('Expected: Floating wall-top and roof nodes detected\n');

const testCase1 = {
  nodes: [
    {name: 'N1', x: 0, y: 0, z: 0},  // Floor
    {name: 'N2', x: 4, y: 0, z: 0},
    {name: 'N3', x: 4, y: 0, z: 3},
    {name: 'N4', x: 0, y: 0, z: 3},
    {name: 'N5', x: 0, y: 3, z: 0},  // Wall-tops (FLOATING!)
    {name: 'N6', x: 4, y: 3, z: 0},
    {name: 'N7', x: 4, y: 3, z: 3},
    {name: 'N8', x: 0, y: 3, z: 3},
    {name: 'N9', x: 2, y: 4, z: 1.5} // Roof apex (FLOATING!)
  ],
  lines: [
    // Floor perimeter (grounded)
    {name: 'L1', node1: 'N1', node2: 'N2'},
    {name: 'L2', node1: 'N2', node2: 'N3'},
    {name: 'L3', node1: 'N3', node2: 'N4'},
    {name: 'L4', node1: 'N4', node2: 'N1'},
    // Wall-top perimeter (NOT connected to ground!)
    {name: 'L5', node1: 'N5', node2: 'N6'},
    {name: 'L6', node1: 'N6', node2: 'N7'},
    {name: 'L7', node1: 'N7', node2: 'N8'},
    {name: 'L8', node1: 'N8', node2: 'N5'},
    // Roof slopes (connected to floating wall-tops)
    {name: 'L9', node1: 'N5', node2: 'N9'},
    {name: 'L10', node1: 'N6', node2: 'N9'},
    {name: 'L11', node1: 'N7', node2: 'N9'},
    {name: 'L12', node1: 'N8', node2: 'N9'}
    // MISSING: Vertical walls N1→N5, N2→N6, N3→N7, N4→N8
  ]
};

function analyzeGravity(structure) {
  const minY = Math.min(...structure.nodes.map(n => n.y));

  // Build adjacency graph
  const adjacency = new Map();
  structure.nodes.forEach(node => adjacency.set(node.name, new Set()));
  structure.lines.forEach(line => {
    adjacency.get(line.node1)?.add(line.node2);
    adjacency.get(line.node2)?.add(line.node1);
  });

  // Find grounded nodes
  const groundedNodes = new Set();
  const visited = new Set();

  function findGroundedNodes(nodeName) {
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    const node = structure.nodes.find(n => n.name === nodeName);
    if (!node) return;

    if (Math.abs(node.y - minY) < 0.1) {
      groundedNodes.add(nodeName);
    }

    const neighbors = adjacency.get(nodeName);
    if (neighbors) {
      neighbors.forEach(neighbor => findGroundedNodes(neighbor));
    }
  }

  // Start from floor nodes
  const floorNodes = structure.nodes.filter(n => Math.abs(n.y - minY) < 0.1);
  floorNodes.forEach(floor => findGroundedNodes(floor.name));

  // Propagate grounding
  let changed = true;
  while (changed) {
    changed = false;
    structure.nodes.forEach(node => {
      if (!groundedNodes.has(node.name)) {
        const neighbors = adjacency.get(node.name);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (groundedNodes.has(neighbor)) {
              groundedNodes.add(node.name);
              changed = true;
              break;
            }
          }
        }
      }
    });
  }

  // Find floating nodes
  const floatingNodes = structure.nodes.filter(n => !groundedNodes.has(n.name));

  return {
    groundedNodes: Array.from(groundedNodes).sort(),
    floatingNodes: floatingNodes.map(n => n.name).sort(),
    totalNodes: structure.nodes.length,
    floorNodes: floorNodes.map(n => n.name).sort()
  };
}

const result1 = analyzeGravity(testCase1);

console.log('Floor nodes (y=0):', result1.floorNodes.join(', '));
console.log('Grounded nodes:', result1.groundedNodes.join(', '));
console.log('Floating nodes:', result1.floatingNodes.join(', '));
console.log('');

if (result1.floatingNodes.length > 0) {
  console.log('❌ Structure is UNSTABLE - floating elements detected!');
  console.log('💡 Missing supports:');
  result1.floatingNodes.forEach(floating => {
    const node = testCase1.nodes.find(n => n.name === floating);
    // Find floor node at same X,Z
    const support = result1.floorNodes.find(floor => {
      const floorNode = testCase1.nodes.find(n => n.name === floor);
      return Math.abs(node.x - floorNode.x) < 0.1 &&
             Math.abs(node.z - floorNode.z) < 0.1;
    });
    if (support) {
      console.log(`   Add vertical support: ${support} → ${floating}`);
    }
  });
} else {
  console.log('✅ Structure is STABLE - all elements grounded!');
}

console.log('\n' + '='.repeat(60) + '\n');

// Test Case 2: Properly grounded house
console.log('Test 2: House with complete vertical walls');
console.log('Expected: All nodes grounded through structural path\n');

const testCase2 = {
  ...testCase1,
  lines: [
    ...testCase1.lines,
    // Add vertical walls
    {name: 'L13', node1: 'N1', node2: 'N5'},
    {name: 'L14', node1: 'N2', node2: 'N6'},
    {name: 'L15', node1: 'N3', node2: 'N7'},
    {name: 'L16', node1: 'N4', node2: 'N8'}
  ]
};

const result2 = analyzeGravity(testCase2);

console.log('Floor nodes (y=0):', result2.floorNodes.join(', '));
console.log('Grounded nodes:', result2.groundedNodes.join(', '));
console.log('Floating nodes:', result2.floatingNodes.join(', '));
console.log('');

if (result2.floatingNodes.length > 0) {
  console.log('❌ Structure is UNSTABLE');
} else {
  console.log('✅ Structure is STABLE - all elements grounded!');
  console.log('💚 Gravity analysis: All nodes have continuous load path to ground');
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('Summary:');
console.log(`Test 1 (no vertical walls): ${result1.floatingNodes.length}/${result1.totalNodes} nodes floating`);
console.log(`Test 2 (with vertical walls): ${result2.floatingNodes.length}/${result2.totalNodes} nodes floating`);
