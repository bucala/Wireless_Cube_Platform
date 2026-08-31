import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef, useState } from 'react';
import * as THREE from 'three';

import { SHELL_SIZE_MM, type FaceId } from '../lib/dice';
import { CoreCube } from './CoreCube';
import { GlassShell } from './GlassShell';

export interface DiceViewerProps {
  bindings: Map<FaceId, string>;
  activeUids: Set<string>;
  awaitingFace: boolean;
  onSelectFace: (face: FaceId) => void;
  powerPct: number;
  collision: boolean;
  showLabels: boolean;
  showField: boolean;
}

const READER_Y = -SHELL_SIZE_MM / 2 - 0.4;

export function DiceViewer(props: DiceViewerProps) {
  const [hoveredFace, setHoveredFace] = useState<FaceId | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [21, 15, 23], fov: 32, near: 0.1, far: 400 }}
    >
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 45, 130]} />

      <Suspense fallback={null}>
        {/* Procedural environment: no HDRI download, so the viewer also works
            inside a packaged offline desktop build. */}
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.4} position={[0, 12, 6]} scale={[12, 12, 1]} color="#bae6fd" />
          <Lightformer intensity={1.4} position={[-10, 4, -8]} scale={[10, 10, 1]} color="#818cf8" />
          <Lightformer intensity={1.1} position={[10, -4, 6]} scale={[10, 10, 1]} color="#22d3ee" />
        </Environment>

        <ambientLight intensity={0.35} />
        <directionalLight
          position={[14, 20, 12]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-12, 6, -10]} intensity={35} color="#38bdf8" distance={60} />

        <group position={[0, 0, 0]}>
          <CoreCube
            bindings={props.bindings}
            activeUids={props.activeUids}
            awaitingFace={props.awaitingFace}
            hoveredFace={hoveredFace}
            onHoverFace={setHoveredFace}
            onSelectFace={props.onSelectFace}
            showLabels={props.showLabels}
          />
          <GlassShell tint={props.collision ? '#fca5a5' : '#7dd3fc'} />
        </group>

        <ReaderAntenna powerPct={props.powerPct} collision={props.collision} />
        {props.showField && <FieldBubble powerPct={props.powerPct} collision={props.collision} />}

        <ContactShadows
          position={[0, READER_Y - 0.05, 0]}
          opacity={0.55}
          scale={70}
          blur={2.6}
          far={20}
          color="#000000"
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate={!props.awaitingFace}
        autoRotateSpeed={0.55}
        minDistance={16}
        maxDistance={70}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

/** Stylised PN5180 antenna: a PCB plate with a printed coil under the dice. */
function ReaderAntenna({ powerPct, collision }: { powerPct: number; collision: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ringRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const beat = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2);
    material.opacity = 0.18 + (powerPct / 100) * 0.5 * beat;
  });

  return (
    <group position={[0, READER_Y, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#0b1220" roughness={0.85} metalness={0.2} />
      </mesh>
      {[9.5, 11, 12.5].map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01 + index * 0.002, 0]}>
          <ringGeometry args={[radius - 0.32, radius, 96]} />
          <meshBasicMaterial color="#1e3a5f" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[7.4, 8.2, 96]} />
        <meshBasicMaterial
          color={collision ? '#f87171' : '#38bdf8'}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Field visualisation: the radius of the bubble follows the commanded power, so
 * you can see at a glance whether the field still swallows the side tags.
 */
function FieldBubble({ powerPct, collision }: { powerPct: number; collision: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // 5 % -> 3 mm, 100 % -> 17 mm; eased so the low end stays readable.
    const target = 3 + Math.pow(powerPct / 100, 0.75) * 14;
    mesh.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 6));
  });

  return (
    <mesh ref={meshRef} position={[0, READER_Y + 0.2, 0]} raycast={() => null}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial
        color={collision ? '#f87171' : '#38bdf8'}
        transparent
        opacity={0.075}
        wireframe
      />
    </mesh>
  );
}
