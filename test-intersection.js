// Test intersection detection with exact user coordinates
// Line L5: N5(2,4,0) → N2(4,0,0)
// Line L3: N3(4,3,0) → N4(0,3,0)

function lineLineIntersection(p1, p2, q1, q2) {
  // Line 1: P = p1 + t * (p2 - p1), t in [0, 1]
  // Line 2: Q = q1 + s * (q2 - q1), s in [0, 1]

  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const d2 = { x: q2.x - q1.x, y: q2.y - q1.y, z: q2.z - q1.z };
  const w = { x: p1.x - q1.x, y: p1.y - q1.y, z: p1.z - q1.z };

  console.log(`d1 (direction 1): (${d1.x}, ${d1.y}, ${d1.z})`);
  console.log(`d2 (direction 2): (${d2.x}, ${d2.y}, ${d2.z})`);
  console.log(`w: (${w.x}, ${w.y}, ${w.z})`);

  const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
  const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
  const c = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
  const d = d1.x * w.x + d1.y * w.y + d1.z * w.z;
  const e = d2.x * w.x + d2.y * w.y + d2.z * w.z;

  const denom = a * c - b * b;

  console.log(`a=${a.toFixed(4)}, b=${b.toFixed(4)}, c=${c.toFixed(4)}`);
  console.log(`d=${d.toFixed(4)}, e=${e.toFixed(4)}, denom=${denom.toFixed(4)}`);

  if (Math.abs(denom) < 0.0001) {
    console.log(`❌ Lines are parallel or coincident (denom too small)`);
    return null;
  }

  const t = (b * e - c * d) / denom;
  const s = (a * e - b * d) / denom;

  console.log(`t=${t.toFixed(6)}, s=${s.toFixed(6)}`);

  const ENDPOINT_TOLERANCE = 0.005;
  if (t < ENDPOINT_TOLERANCE || t > (1 - ENDPOINT_TOLERANCE) ||
      s < ENDPOINT_TOLERANCE || s > (1 - ENDPOINT_TOLERANCE)) {
    console.log(`❌ Intersection outside segment range`);
    console.log(`   t=${t.toFixed(6)} (need ${ENDPOINT_TOLERANCE} to ${1-ENDPOINT_TOLERANCE})`);
    console.log(`   s=${s.toFixed(6)} (need ${ENDPOINT_TOLERANCE} to ${1-ENDPOINT_TOLERANCE})`);
    return null;
  }

  const intersection = {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
    z: p1.z + t * d1.z,
    t,
    s,
  };

  const q_at_s = {
    x: q1.x + s * d2.x,
    y: q1.y + s * d2.y,
    z: q1.z + s * d2.z,
  };

  const dist = Math.sqrt(
    Math.pow(intersection.x - q_at_s.x, 2) +
    Math.pow(intersection.y - q_at_s.y, 2) +
    Math.pow(intersection.z - q_at_s.z, 2)
  );

  console.log(`Intersection point: (${intersection.x.toFixed(3)}, ${intersection.y.toFixed(3)}, ${intersection.z.toFixed(3)})`);
  console.log(`Q at s: (${q_at_s.x.toFixed(3)}, ${q_at_s.y.toFixed(3)}, ${q_at_s.z.toFixed(3)})`);
  console.log(`Distance between points: ${dist.toFixed(6)}`);

  const DISTANCE_TOLERANCE = 0.5;
  if (dist > DISTANCE_TOLERANCE) {
    console.log(`❌ Lines are skew (distance ${dist.toFixed(6)} > ${DISTANCE_TOLERANCE})`);
    return null;
  }

  console.log(`✅ Valid intersection found!`);
  return intersection;
}

// Test with your exact coordinates
const N5 = { x: 2, y: 4, z: 0 };
const N2 = { x: 4, y: 0, z: 0 };
const N3 = { x: 4, y: 3, z: 0 };
const N4 = { x: 0, y: 3, z: 0 };

console.log('Testing L5 (N5→N2) vs L3 (N3→N4)');
console.log(`L5: (${N5.x}, ${N5.y}, ${N5.z}) → (${N2.x}, ${N2.y}, ${N2.z})`);
console.log(`L3: (${N3.x}, ${N3.y}, ${N3.z}) → (${N4.x}, ${N4.y}, ${N4.z})`);
console.log('');

const result = lineLineIntersection(N5, N2, N3, N4);

if (result) {
  console.log('\n✅ INTERSECTION DETECTED!');
  console.log(`   At: (${result.x}, ${result.y}, ${result.z})`);
  console.log(`   t=${result.t} (${(result.t*100).toFixed(1)}% along L5)`);
  console.log(`   s=${result.s} (${(result.s*100).toFixed(1)}% along L3)`);
} else {
  console.log('\n❌ NO INTERSECTION DETECTED');
}
