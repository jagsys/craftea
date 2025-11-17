// Analyze the house structure to find missing lines

const house = {
  "nodes": [
    {"name": "N1", "x": 0, "y": 0, "z": 0},     // Floor front-left
    {"name": "N2", "x": 4, "y": 0, "z": 0},     // Floor front-right
    {"name": "N3", "x": 4, "y": 0, "z": 3},     // Floor back-right
    {"name": "N4", "x": 0, "y": 0, "z": 3},     // Floor back-left
    {"name": "N5", "x": 0, "y": 3, "z": 0},     // Wall-top front-left
    {"name": "N6", "x": 4, "y": 3, "z": 0},     // Wall-top front-right
    {"name": "N7", "x": 4, "y": 3, "z": 3},     // Wall-top back-right
    {"name": "N8", "x": 0, "y": 3, "z": 3},     // Wall-top back-left
    {"name": "N9", "x": 2, "y": 4, "z": 1.5}    // Roof apex
  ],
  "lines": [
    {"name": "L1", "node1": "N1", "node2": "N2"},  // Floor front
    {"name": "L2", "node1": "N2", "node2": "N3"},  // Floor right
    {"name": "L3", "node1": "N3", "node2": "N4"},  // Floor back
    {"name": "L4", "node1": "N4", "node2": "N1"},  // Floor left
    {"name": "L5", "node1": "N5", "node2": "N6"},  // Wall-top front
    {"name": "L6", "node1": "N6", "node2": "N7"},  // Wall-top right
    {"name": "L7", "node1": "N7", "node2": "N8"},  // Wall-top back
    {"name": "L8", "node1": "N8", "node2": "N5"},  // Wall-top left
    {"name": "L9", "node1": "N5", "node2": "N9"},  // Roof slope FL
    {"name": "L10", "node1": "N6", "node2": "N9"}, // Roof slope FR
    {"name": "L11", "node1": "N7", "node2": "N9"}, // Roof slope BR
    {"name": "L12", "node1": "N8", "node2": "N9"}  // Roof slope BL
  ]
};

console.log('🏠 Analyzing House Structure\n');

// Check for line between two nodes
function hasLine(n1, n2) {
  return house.lines.some(line =>
    (line.node1 === n1 && line.node2 === n2) ||
    (line.node2 === n1 && line.node1 === n2)
  );
}

// Floor perimeter (y=0)
const floorNodes = ['N1', 'N2', 'N3', 'N4'];
console.log('📐 Floor Perimeter (y=0):');
const floorEdges = [
  ['N1', 'N2'], // Front
  ['N2', 'N3'], // Right
  ['N3', 'N4'], // Back
  ['N4', 'N1']  // Left
];

const missingFloor = [];
floorEdges.forEach(([n1, n2]) => {
  const exists = hasLine(n1, n2);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${n1}→${n2}`);
  if (!exists) missingFloor.push(`${n1}→${n2}`);
});

// Wall-top perimeter (y=3)
console.log('\n📐 Wall-Top Perimeter (y=3):');
const wallEdges = [
  ['N5', 'N6'], // Front
  ['N6', 'N7'], // Right
  ['N7', 'N8'], // Back
  ['N8', 'N5']  // Left
];

const missingWalls = [];
wallEdges.forEach(([n1, n2]) => {
  const exists = hasLine(n1, n2);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${n1}→${n2}`);
  if (!exists) missingWalls.push(`${n1}→${n2}`);
});

// Vertical walls
console.log('\n📐 Vertical Walls (floor→wall-top):');
const verticals = [
  ['N1', 'N5'],
  ['N2', 'N6'],
  ['N3', 'N7'],
  ['N4', 'N8']
];

const missingVerticals = [];
verticals.forEach(([n1, n2]) => {
  const exists = hasLine(n1, n2);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${n1}→${n2}`);
  if (!exists) missingVerticals.push(`${n1}→${n2}`);
});

// Roof slopes
console.log('\n📐 Roof Slopes (wall-top→apex):');
const roofSlopes = [
  ['N5', 'N9'],
  ['N6', 'N9'],
  ['N7', 'N9'],
  ['N8', 'N9']
];

const missingRoof = [];
roofSlopes.forEach(([n1, n2]) => {
  const exists = hasLine(n1, n2);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${n1}→${n2}`);
  if (!exists) missingRoof.push(`${n1}→${n2}`);
});

// Summary
console.log('\n📋 Summary:');
console.log(`  Total nodes: ${house.nodes.length}`);
console.log(`  Total lines: ${house.lines.length}`);

const allMissing = [...missingFloor, ...missingWalls, ...missingVerticals, ...missingRoof];
if (allMissing.length > 0) {
  console.log(`\n  ❌ Missing ${allMissing.length} line(s):`);
  if (missingFloor.length > 0) {
    console.log(`     Floor edges: ${missingFloor.join(', ')}`);
  }
  if (missingWalls.length > 0) {
    console.log(`     Wall-top edges: ${missingWalls.join(', ')}`);
  }
  if (missingVerticals.length > 0) {
    console.log(`     Vertical walls: ${missingVerticals.join(', ')}`);
  }
  if (missingRoof.length > 0) {
    console.log(`     Roof slopes: ${missingRoof.join(', ')}`);
  }
} else {
  console.log('  ✅ House structure is complete!');
}
