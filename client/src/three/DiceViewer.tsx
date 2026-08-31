import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { ViewPreset, ViewerSettings } from '../hooks/useViewer';
import type { FaceId } from '../lib/dice';
import type { DiceGeometry } from '../lib/hardware';
import type { SkinScene } from '../lib/skins';
import { CoreCube } from './CoreCube';
import { GlassShell } from './GlassShell';

export interface DiceViewerProps {
  geometry: DiceGeometry;
  scene: SkinScene;
  settings: ViewerSettings;
  /** Zmena čísla znovu nastaví kameru na aktuálny preset. */
  cameraNonce: number;
  bindings: Map<FaceId, string>;
  activeUids: Set<string>;
  awaitingFace: boolean;
  onSelectFace: (face: FaceId) => void;
  powerPct: number;
  collision: boolean;
}

/** Smery kamery pre jednotlivé pohľady, násobené rozmerom kocky. */
const VIEW_DIRECTION: Record<ViewPreset, [number, number, number]> = {
  iso: [1.15, 0.85, 1.3],
  front: [0, 0.18, 2.05],
  top: [0.0001, 2.05, 0.0001],
  side: [2.05, 0.18, 0],
};

export function DiceViewer({
  geometry,
  scene,
  settings,
  cameraNonce,
  bindings,
  activeUids,
  awaitingFace,
  onSelectFace,
  powerPct,
  collision,
}: DiceViewerProps) {
  const [hoveredFace, setHoveredFace] = useState<FaceId | null>(null);
  const readerY = -geometry.shellMm / 2 - 0.4;
  const plain = settings.plain;
  const fieldColor = collision ? scene.fieldBad : scene.fieldOk;

  const initialPosition = useMemo(() => {
    const dir = VIEW_DIRECTION[settings.view];
    return [
      dir[0] * geometry.shellMm,
      dir[1] * geometry.shellMm,
      dir[2] * geometry.shellMm,
    ] as [number, number, number];
    // Iba počiatočná pozícia; ďalšie zmeny riadi CameraRig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: initialPosition, fov: 32, near: 0.1, far: 400 }}
    >
      <color attach="background" args={[scene.background]} />
      {!plain && <fog attach="fog" args={[scene.fog, geometry.shellMm * 4, geometry.shellMm * 11]} />}

      <Suspense fallback={null}>
        {/* Procedurálne prostredie: žiadne stahovanie HDRI, takže náhľad
            funguje aj v zabalenej offline desktop verzii. */}
        {!plain && (
          <Environment resolution={256} frames={1}>
            <Lightformer intensity={2.2} position={[0, 12, 6]} scale={[12, 12, 1]} color="#ffffff" />
            <Lightformer
              intensity={1.3}
              position={[-10, 4, -8]}
              scale={[10, 10, 1]}
              color={scene.shellEdge}
            />
            <Lightformer
              intensity={1}
              position={[10, -4, 6]}
              scale={[10, 10, 1]}
              color={scene.fieldOk}
            />
          </Environment>
        )}

        <ambientLight intensity={plain ? 1.1 : scene.ambient} />
        <directionalLight
          position={[geometry.shellMm * 1.2, geometry.shellMm * 1.7, geometry.shellMm]}
          intensity={plain ? 0.6 : scene.key}
          castShadow={!plain}
          shadow-mapSize={[1024, 1024]}
        />
        {!plain && (
          <pointLight
            position={[-geometry.shellMm, geometry.shellMm * 0.5, -geometry.shellMm]}
            intensity={35}
            color={scene.fieldOk}
            distance={geometry.shellMm * 5}
          />
        )}

        <group>
          <CoreCube
            geometry={geometry}
            scene={scene}
            bindings={bindings}
            activeUids={activeUids}
            awaitingFace={awaitingFace}
            hoveredFace={hoveredFace}
            onHoverFace={setHoveredFace}
            onSelectFace={onSelectFace}
            showLabels={settings.showLabels}
            showCore={settings.showCore}
            showTags={settings.showTags}
            plain={plain}
            explode={settings.explode}
          />

          {settings.showShell && (
            <group scale={1 + settings.explode * 0.75}>
              <GlassShell
                shellMm={geometry.shellMm}
                cornerRadiusMm={geometry.cornerRadiusMm}
                pipDepthMm={geometry.pipDepthMm}
                tint={collision ? scene.fieldBad : scene.shell}
                edgeColor={scene.shellEdge}
                pipColor={scene.pip}
                showPips={settings.showPips}
                plain={plain}
              />
            </group>
          )}
        </group>

        {settings.showAxes && <axesHelper args={[geometry.shellMm * 1.3]} />}

        {settings.showReader && (
          <ReaderAntenna
            y={readerY}
            shellMm={geometry.shellMm}
            scene={scene}
            powerPct={powerPct}
            fieldColor={fieldColor}
            plain={plain}
          />
        )}

        {settings.showField && (
          <FieldBubble
            y={readerY + 0.2}
            shellMm={geometry.shellMm}
            powerPct={powerPct}
            color={fieldColor}
          />
        )}

        {!plain && (
          <ContactShadows
            position={[0, readerY - 0.05, 0]}
            opacity={0.5}
            scale={geometry.shellMm * 6}
            blur={2.6}
            far={20}
            color="#000000"
          />
        )}
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate={settings.rotate && !awaitingFace}
        autoRotateSpeed={settings.speed}
        minDistance={geometry.shellMm * 1.15}
        maxDistance={geometry.shellMm * 7}
        target={[0, 0, 0]}
      />
      <CameraRig view={settings.view} nonce={cameraNonce} shellMm={geometry.shellMm} />
    </Canvas>
  );
}

interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
}

/** Nastaví kameru na zvolený pohľad; reaguje aj na tlačidlo "reset". */
function CameraRig({
  view,
  nonce,
  shellMm,
}: {
  view: ViewPreset;
  nonce: number;
  shellMm: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;

  useEffect(() => {
    const dir = VIEW_DIRECTION[view];
    camera.position.set(dir[0] * shellMm, dir[1] * shellMm, dir[2] * shellMm);
    controls?.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls?.update();
  }, [view, nonce, shellMm, camera, controls]);

  return null;
}

/** Stylizovaná anténa PN5180: DPS s natlačenou cievkou pod kockou. */
function ReaderAntenna({
  y,
  shellMm,
  scene,
  powerPct,
  fieldColor,
  plain,
}: {
  y: number;
  shellMm: number;
  scene: SkinScene;
  powerPct: number;
  fieldColor: string;
  plain: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ringRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const beat = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2);
    material.opacity = 0.18 + (powerPct / 100) * 0.5 * beat;
  });

  const coilRadii = [shellMm * 0.79, shellMm * 0.92, shellMm * 1.04];

  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow={!plain} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[shellMm * 2.8, shellMm * 2.8]} />
        {plain ? (
          <meshBasicMaterial color={scene.pcb} />
        ) : (
          <meshStandardMaterial color={scene.pcb} roughness={0.85} metalness={0.2} />
        )}
      </mesh>
      {coilRadii.map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01 + index * 0.002, 0]}>
          <ringGeometry args={[radius - 0.32, radius, 96]} />
          <meshBasicMaterial
            color={scene.coil}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[shellMm * 0.62, shellMm * 0.68, 96]} />
        <meshBasicMaterial color={fieldColor} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Vizualizácia poľa: priemer bubliny sleduje nastavený výkon, takže na prvý
 * pohľad vidíš, či pole ešte pohlcuje aj bočné tagy.
 */
function FieldBubble({
  y,
  shellMm,
  powerPct,
  color,
}: {
  y: number;
  shellMm: number;
  powerPct: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // 5 % -> ~0,25 kocky, 100 % -> ~1,45 kocky; odmocninou sa spodok rozsahu
    // nezlepí do jedného bodu.
    const size = shellMm * (0.25 + Math.pow(powerPct / 100, 0.75) * 1.2);
    target.set(size, size, size);
    mesh.scale.lerp(target, Math.min(1, delta * 6));
  });

  return (
    <mesh ref={meshRef} position={[0, y, 0]} raycast={() => null}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.075} wireframe />
    </mesh>
  );
}
