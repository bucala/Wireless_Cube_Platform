import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { CORE_SIZE_MM, FACES, TAG_DIAMETER_MM, type FaceDef, type FaceId } from '../lib/dice';

export interface CoreCubeProps {
  /** face -> UID already stored in the calibration profile */
  bindings: Map<FaceId, string>;
  /** UIDs the reader currently sees */
  activeUids: Set<string>;
  /** true while the pairing flow waits for the user to pick the bottom face */
  awaitingFace: boolean;
  hoveredFace: FaceId | null;
  onHoverFace: (face: FaceId | null) => void;
  onSelectFace: (face: FaceId) => void;
  showLabels: boolean;
}

type FaceState = 'unbound' | 'bound' | 'live' | 'pending';

const STATE_COLOR: Record<FaceState, string> = {
  unbound: '#334155',
  bound: '#0ea5e9',
  live: '#34d399',
  pending: '#fbbf24',
};

const FACE_OFFSET = CORE_SIZE_MM / 2;
const PAD_LIFT = 0.02; // keeps the click pad from z-fighting with the core
const TAG_LIFT = 0.05;

export function CoreCube({
  bindings,
  activeUids,
  awaitingFace,
  hoveredFace,
  onHoverFace,
  onSelectFace,
  showLabels,
}: CoreCubeProps) {
  return (
    <group>
      <mesh castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[CORE_SIZE_MM, CORE_SIZE_MM, CORE_SIZE_MM]} />
        <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.25} />
      </mesh>

      {FACES.map((face) => {
        const uid = bindings.get(face.id) ?? null;
        const live = uid !== null && activeUids.has(uid);
        const state: FaceState = live ? 'live' : uid ? 'bound' : awaitingFace ? 'pending' : 'unbound';
        return (
          <CoreFace
            key={face.id}
            face={face}
            uid={uid}
            state={state}
            hovered={hoveredFace === face.id}
            awaitingFace={awaitingFace}
            showLabel={showLabels}
            onHover={onHoverFace}
            onSelect={onSelectFace}
          />
        );
      })}
    </group>
  );
}

interface CoreFaceProps {
  face: FaceDef;
  uid: string | null;
  state: FaceState;
  hovered: boolean;
  awaitingFace: boolean;
  showLabel: boolean;
  onHover: (face: FaceId | null) => void;
  onSelect: (face: FaceId) => void;
}

function CoreFace({
  face,
  uid,
  state,
  hovered,
  awaitingFace,
  showLabel,
  onHover,
  onSelect,
}: CoreFaceProps) {
  const tagRef = useRef<THREE.Mesh>(null);
  const [pressed, setPressed] = useState(false);
  const color = useMemo(() => new THREE.Color(STATE_COLOR[state]), [state]);

  useFrame(({ clock }) => {
    const mesh = tagRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    // Pulse the tag while the app waits for a face pick, and keep a steady glow
    // for a tag the reader is currently talking to.
    const base = state === 'live' ? 1.1 : state === 'pending' ? 0.75 : 0.25;
    const pulse =
      state === 'pending' || state === 'live'
        ? 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * (state === 'live' ? 4.5 : 2.6)))
        : 0;
    material.emissiveIntensity = base + pulse + (hovered ? 0.5 : 0);
  });

  const position: [number, number, number] = [
    face.normal[0] * (FACE_OFFSET + PAD_LIFT),
    face.normal[1] * (FACE_OFFSET + PAD_LIFT),
    face.normal[2] * (FACE_OFFSET + PAD_LIFT),
  ];

  return (
    <group position={position} rotation={face.rotation}>
      {/* Click target: covers the whole core face, not just the tag. */}
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(face.id);
          document.body.style.cursor = awaitingFace ? 'pointer' : 'default';
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onHover(null);
          document.body.style.cursor = 'default';
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          setPressed(true);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          setPressed(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(face.id);
        }}
      >
        <planeGeometry args={[CORE_SIZE_MM * 0.98, CORE_SIZE_MM * 0.98]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={pressed ? 0.34 : hovered ? 0.22 : awaitingFace ? 0.12 : 0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* The 5 mm NTAG213 inlay cast into this face of the core. */}
      <mesh ref={tagRef} position={[0, 0, TAG_LIFT]} raycast={() => null}>
        <circleGeometry args={[TAG_DIAMETER_MM / 2, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.35}
          metalness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, TAG_LIFT + 0.01]} raycast={() => null}>
        <ringGeometry args={[TAG_DIAMETER_MM / 2 - 0.35, TAG_DIAMETER_MM / 2 - 0.12, 48]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {showLabel && (
        <Html center distanceFactor={26} position={[0, 0, TAG_LIFT + 0.4]} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none rounded-md border border-white/10 bg-base-950/80 px-1.5 py-0.5 text-center font-mono text-[9px] leading-tight text-slate-300 backdrop-blur">
            <div className="text-[11px] font-semibold text-accent">{face.value}</div>
            <div>{uid ? uid.slice(-8) : 'nespárované'}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
