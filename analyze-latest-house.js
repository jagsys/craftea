const fs = require('fs');
const house = JSON.parse(fs.readFileSync('/Users/andresgarcia/Downloads/craftea-2025-11-17T05-20-38.json', 'utf8'));

console.log('🏠 Analyzing Latest House Structure\n');
console.log(`Total nodes: ${house.nodes.length}`);
console.log(`Total lines: ${house.lines.length}\n`);

// Categorize by Y level
const floor = house.nodes.filter(n => n.y === 0);
const wallTop = house.nodes.filter(n => n.y === 3);
const roof = house.nodes.filter(n => n.y === 4);

console.log('Nodes by level:');
console.log(`  Floor (y=0): ${floor.map(n => n.name).join(', ')}`);
console.log(`  Wall-tops (y=3): ${wallTop.map(n => n.name).join(', ')}`);
console.log(`  Roof (y=4): ${roof.map(n => n.name).join(', ')}\n`);

// Analyze lines by type
const verticals = [];
const floorEdges = [];
const wallEdges = [];
const roofSlopes = [];
const diagonals = [];

house.lines.forEach(line => {
  const n1 = house.nodes.find(n => n.name === line.node1);
  const n2 = house.nodes.find(n => n.name === line.node2);

  const yDiff = Math.abs(n1.y - n2.y);
  const xDiff = Math.abs(n1.x - n2.x);
  const zDiff = Math.abs(n1.z - n2.z);

  if (yDiff > 0.1 && xDiff < 0.1 && zDiff < 0.1) {
    verticals.push(`${line.name}: ${line.node1}→${line.node2}`);
  } else if (n1.y === 0 && n2.y === 0) {
    floorEdges.push(`${line.name}: ${line.node1}→${line.node2}`);
  } else if (n1.y === 3 && n2.y === 3) {
    wallEdges.push(`${line.name}: ${line.node1}→${line.node2}`);
  } else if ((n1.y === 3 && n2.y === 4) || (n1.y === 4 && n2.y === 3)) {
    roofSlopes.push(`${line.name}: ${line.node1}→${line.node2}`);
  } else {
    diagonals.push(`${line.name}: ${line.node1}→${line.node2} (y1=${n1.y}, y2=${n2.y})`);
  }
});

console.log('Lines by type:');
console.log(`  Vertical walls (4 expected): ${verticals.length}`);
verticals.forEach(v => console.log(`    ✅ ${v}`));

console.log(`\n  Floor edges (4 expected): ${floorEdges.length}`);
floorEdges.forEach(f => console.log(`    ✅ ${f}`));

console.log(`\n  Wall-top edges (4 expected): ${wallEdges.length}`);
if (wallEdges.length > 0) {
  wallEdges.forEach(w => console.log(`    ✅ ${w}`));
} else {
  console.log(`    ❌ No wall-top perimeter edges found!`);
}

console.log(`\n  Roof slopes (4 expected): ${roofSlopes.length}`);
roofSlopes.forEach(r => console.log(`    ✅ ${r}`));

if (diagonals.length > 0) {
  console.log(`\n  ⚠️  Diagonal/unexpected lines: ${diagonals.length}`);
  diagonals.forEach(d => console.log(`    ⚠️  ${d}`));
}

console.log('\n📊 Summary:');
const expected = 4 + 4 + 4 + 4; // verticals + floor + walls + roof
console.log(`  Expected lines: ${expected}`);
console.log(`  Actual lines: ${house.lines.length}`);
console.log(`  Missing: ${expected - (verticals.length + floorEdges.length + wallEdges.length + roofSlopes.length)}`);
console.log(`  Extra diagonals: ${diagonals.length}`);
console.log(`  Status: ${house.lines.length === expected && diagonals.length === 0 ? '✅ Perfect!' : '⚠️  Issues detected'}`);

// Check for missing wall-top edges
console.log('\n🔍 Missing wall-top edges:');
const wallTopPairs = [
  ['N5', 'N6'],
  ['N6', 'N7'],
  ['N7', 'N8'],
  ['N8', 'N5']
];

wallTopPairs.forEach(([n1, n2]) => {
  const hasEdge = house.lines.some(line =>
    (line.node1 === n1 && line.node2 === n2) ||
    (line.node2 === n1 && line.node1 === n2)
  );
  if (!hasEdge) {
    console.log(`  ❌ Missing: ${n1}→${n2}`);
  } else {
    console.log(`  ✅ Found: ${n1}→${n2}`);
  }
});
