'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Billboard } from '@react-three/drei';
import { useEditorStore } from '@/lib/stores/editorStore';
import * as THREE from 'three';

const NODE_RADIUS = 0.1;
const LINE_RADIUS = 0.03;
const AXIS_LENGTH = 5;
const LABEL_OFFSET = 0.5;

const AxisLabels = () => (
  <>
    <Billboard position={[AXIS_LENGTH + LABEL_OFFSET, 0, 0]}>
      <Text
        color="#ff0000"
        fontSize={0.32}
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        renderOrder={999}
      >
        X
      </Text>
    </Billboard>
    <Billboard position={[0, AXIS_LENGTH + LABEL_OFFSET, 0]}>
      <Text
        color="#00ff00"
        fontSize={0.32}
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        renderOrder={999}
      >
        Y
      </Text>
    </Billboard>
    <Billboard position={[0, 0, AXIS_LENGTH + LABEL_OFFSET]}>
      <Text
        color="#0000ff"
        fontSize={0.32}
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        renderOrder={999}
      >
        Z
      </Text>
    </Billboard>
  </>
);

const NodeMesh = ({ node, isSelected }: { node: any; isSelected: boolean }) => (
  <group position={[node.x, node.y, node.z]}>
    <mesh>
      <sphereGeometry args={[NODE_RADIUS, 16, 16]} />
      <meshStandardMaterial color={isSelected ? '#00ff00' : '#4ade80'} />
    </mesh>
    <Billboard position={[0, NODE_RADIUS + 0.0375, 0]}>
      <Text
        color="#4ade80"
        fontSize={0.192}
        anchorX="center"
        anchorY="bottom"
        material-depthTest={false}
        material-depthWrite={false}
        renderOrder={999}
      >
        {node.name}
      </Text>
    </Billboard>
  </group>
);


const LineMesh = ({ line, showLabel }: { line: any; showLabel: boolean }) => {
  const start = new THREE.Vector3(line.node1.x, line.node1.y, line.node1.z);
  const end = new THREE.Vector3(line.node2.x, line.node2.y, line.node2.z);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <group>
      <mesh position={midpoint} quaternion={quaternion}>
        <cylinderGeometry args={[LINE_RADIUS, LINE_RADIUS, length, 8]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      {showLabel && (
        <Billboard position={[midpoint.x, midpoint.y + 0.04, midpoint.z]}>
          <Text
            color="#9ca3af"
            fontSize={0.16}
            anchorX="center"
            anchorY="center"
            material-depthTest={false}
            material-depthWrite={false}
            renderOrder={999}
          >
            {`${line.name} (${length.toFixed(2)}m)`}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

const Scene = () => {
  const { nodes, lines, selectedNodeId, gridSize, showAxisLabels, showNodes, showLineLabels } = useEditorStore();

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Grid args={[gridSize, gridSize]} cellSize={1} cellColor="#444" sectionColor="#666" />

      {showNodes && Array.from(nodes.values()).map((node) => (
        <NodeMesh
          key={node.name}
          node={node}
          isSelected={selectedNodeId === node.name}
        />
      ))}

      {Array.from(lines.values()).map((line) => (
        <LineMesh key={line.name} line={line} showLabel={showLineLabels} />
      ))}

      <axesHelper args={[AXIS_LENGTH]} />
      {showAxisLabels && <AxisLabels />}
    </>
  );
};

export const Viewport3D = () => (
  <div className="w-full h-full bg-black">
    <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
      <Scene />
      <OrbitControls makeDefault />
    </Canvas>
  </div>
);
