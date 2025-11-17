// Test the structural validation logic with the house JSON data

const houseData = {
  "nodes": [
    {"name": "N1", "x": 0, "y": 0, "z": 0},     // Floor front-left
    {"name": "N2", "x": 4, "y": 0, "z": 0},     // Floor front-right
    {"name": "N3", "x": 4, "y": 3, "z": 0},     // Wall-top front-right
    {"name": "N4", "x": 0, "y": 3, "z": 0},     // Wall-top front-left
    {"name": "N5", "x": 2, "y": 4, "z": 0},     // Roof apex front
    {"name": "N6", "x": 0, "y": 0, "z": 2},     // Floor back-left
    {"name": "N7", "x": 4, "y": 0, "z": 2},     // Floor back-right
    {"name": "N8", "x": 4, "y": 3, "z": 2},     // Wall-top back-right
    {"name": "N9", "x": 0, "y": 3, "z": 2},     // Wall-top back-left
    {"name": "N10", "x": 2, "y": 4, "z": 2}     // Roof apex back
  ],
  "lines": [
    {"name": "L1", "node1": "N1", "node2": "N2"},
    {"name": "L2", "node1": "N2", "node2": "N3"},
    {"name": "L3", "node1": "N3", "node2": "N4"},
    {"name": "L4", "node1": "N4", "node2": "N1"},
    {"name": "L5", "node1": "N1", "node2": "N6"},
    {"name": "L6", "node1": "N2", "node2": "N7"},
    {"name": "L7", "node1": "N3", "node2": "N8"},
    {"name": "L8", "node1": "N4", "node2": "N9"},
    {"name": "L9", "node1": "N5", "node2": "N10"},
    {"name": "L10", "node1": "N6", "node2": "N7"},
    {"name": "L11", "node1": "N7", "node2": "N8"},
    {"name": "L12", "node1": "N8", "node2": "N9"},
    {"name": "L13", "node1": "N9", "node2": "N6"},
    {"name": "L14", "node1": "N5", "node2": "N6"}  // ❌ ILLOGICAL: roof to floor!
  ]
};

console.log('🏠 Testing Structural Validation on House Data\n');
console.log('Structure:');
console.log(`  - ${houseData.nodes.length} nodes`);
console.log(`  - ${houseData.lines.length} lines\n`);

// Categorize nodes by Y level
const minY = Math.min(...houseData.nodes.map(n => n.y));
const maxY = Math.max(...houseData.nodes.map(n => n.y));

const floorNodes = houseData.nodes.filter(n => Math.abs(n.y - minY) < 0.1);
const roofNodes = houseData.nodes.filter(n => Math.abs(n.y - maxY) < 0.1);
const wallNodes = houseData.nodes.filter(n =>
  Math.abs(n.y - minY) >= 0.1 && Math.abs(n.y - maxY) >= 0.1
);

console.log('📊 Node categorization:');
console.log(`  Floor (y=${minY}): ${floorNodes.map(n => n.name).join(', ')}`);
console.log(`  Walls (y=3): ${wallNodes.map(n => n.name).join(', ')}`);
console.log(`  Roof (y=${maxY}): ${roofNodes.map(n => n.name).join(', ')}\n`);

// Check for illogical connections
console.log('🔍 Checking for illogical connections...\n');

const errors = [];

for (const line of houseData.lines) {
  const node1 = houseData.nodes.find(n => n.name === line.node1);
  const node2 = houseData.nodes.find(n => n.name === line.node2);

  if (!node1 || !node2) continue;

  const isFloor1 = Math.abs(node1.y - minY) < 0.1;
  const isFloor2 = Math.abs(node2.y - minY) < 0.1;
  const isRoof1 = Math.abs(node1.y - maxY) < 0.1;
  const isRoof2 = Math.abs(node2.y - maxY) < 0.1;

  // Check for roof-to-floor connection (non-vertical)
  if ((isRoof1 && isFloor2) || (isFloor1 && isRoof2)) {
    const isVertical = Math.abs(node1.x - node2.x) < 0.1 && Math.abs(node1.z - node2.z) < 0.1;

    if (!isVertical) {
      errors.push({
        line: line.name,
        node1: line.node1,
        node2: line.node2,
        error: `Illogical roof-to-floor connection`,
        description: `${line.node1} (${isRoof1 ? 'roof' : 'floor'} at y=${node1.y}) to ${line.node2} (${isRoof2 ? 'roof' : 'floor'} at y=${node2.y})`
      });
      console.log(`  ❌ ${line.name}: ${line.node1} → ${line.node2}`);
      console.log(`     ${line.node1} is at ${isRoof1 ? 'ROOF' : 'FLOOR'} (y=${node1.y})`);
      console.log(`     ${line.node2} is at ${isRoof2 ? 'ROOF' : 'FLOOR'} (y=${node2.y})`);
      console.log(`     💡 Roof should connect to wall-tops, not floor!\n`);
    }
  }
}

// Check for missing roof connections
console.log('🔍 Checking for missing roof connections...\n');

for (const apex of roofNodes) {
  // Find wall-top nodes that should connect to this apex
  const connectedWallNodes = wallNodes.filter(wallNode => {
    return houseData.lines.some(line =>
      (line.node1 === apex.name && line.node2 === wallNode.name) ||
      (line.node2 === apex.name && line.node1 === wallNode.name)
    );
  });

  console.log(`  📐 ${apex.name} (roof apex) connected to: ${connectedWallNodes.map(n => n.name).join(', ')}`);

  if (connectedWallNodes.length < 2) {
    const missingWallNodes = wallNodes.filter(w => !connectedWallNodes.includes(w));
    errors.push({
      apex: apex.name,
      error: 'Incomplete roof structure',
      description: `${apex.name} should connect to wall-top nodes: ${missingWallNodes.map(n => n.name).join(', ')}`
    });
    console.log(`     ⚠️  Missing connections to: ${missingWallNodes.map(n => n.name).join(', ')}\n`);
  }
}

console.log(`\n📋 Validation Summary:`);
console.log(`  Total Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n  ❌ Structure has logical errors:');
  errors.forEach((e, i) => {
    console.log(`\n  ${i + 1}. ${e.error}:`);
    console.log(`     ${e.description}`);
    if (e.line) console.log(`     Affected line: ${e.line}`);
  });

  console.log('\n  💡 Suggested fixes:');
  console.log('     - Remove L14 (illogical roof-to-floor connection)');
  console.log('     - Add L[4,5]: N4 → N5 (wall-top to roof apex)');
  console.log('     - Add L[5,3]: N5 → N3 (roof apex to wall-top)');
  console.log('     - Add L[9,10]: N9 → N10 (wall-top to roof apex)');
  console.log('     - Add L[10,8]: N10 → N8 (roof apex to wall-top)');
} else {
  console.log('  ✅ Structure is logically correct!');
}
