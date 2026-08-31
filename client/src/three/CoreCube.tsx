import { Html, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { FACES, type FaceDef, type FaceId } from '../lib/dice';
import type { DiceGeometry } from '../lib/hardware';
import type { SkinScene } from '../lib/skins';

export interface CoreCubeProps {
  geometry: DiceGeometry;
  scene: SkinScene;
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
  /** Zobraziť samotné jadro (kliknutie na steny funguje aj bez neho). */
  showCore: boolean;
  /** Zobraziť inlay tagov. */
  showTags: boolean;
  plain: boolean;
  /** 0..1 – odtiahnutie tagov od jadra pri rozklade zostavy. */
  explode: number;
}

type FaceState = 'unbound' | 'bound' | 'live' | 'pending';

const PAD_LIFT = 0.02; // drží klikaciu plochu mimo z-fightingu s jadrom
const TAG_LIFT = 0.05;

export function CoreCube({
  geometry,
  scene,
  bindings,
  activeUids,
  awaitingFace,
  hoveredFace,
  onHoverFace,
  onSelectFace,
  showLabels,
  showCore,
  showTags,
  plain,
  explode,
}: CoreCubeProps) {
  const stateColor: Record<FaceState, string> = {
    unbound: scene.faceUnbound,
    bound: scene.faceBound,
    live: scene.faceLive,
    pending: scene.facePending,
  };

  const core = geometry.coreMm;
  const radius = Math.max(0.001, core * 0.07);

  return (
    <group>
      {showCore && (
        <RoundedBox
          args={[core, core, core]}
          radius={radius}
          smoothness={plain ? 2 : 4}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          {plain ? (
            <meshBasicMaterial color={scene.core} />
          ) : (
            <meshStandardMaterial color={scene.core} roughness={0.55} metalness={0.25} />
          )}
        </RoundedBox>
      )}

      {FACES.map((face) => {
        const uid = bindings.get(face.id) ?? null;
        const live = uid !== null && activeUids.has(uid);
        const state: FaceState = live
          ? 'live'
          : uid
            ? 'bound'
            : awaitingFace
              ? 'pending'
              : 'unbound';
        return (
          <CoreFace
            key={face.id}
            face={face}
            geometry={geometry}
            scene={scene}
            uid={uid}
            state={state}
            color={stateColor[state]}
            hovered={hoveredFace === face.id}
            awaitingFace={awaitingFace}
            showLabel={showLabels}
            showTag={showTags}
            plain={plain}
            explode={explode}
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
  geometry: DiceGeometry;
  scene: SkinScene;
  uid: string | null;
  state: FaceState;
  color: string;
  hovered: boolean;
  awaitingFace: boolean;
  showLabel: boolean;
  showTag: boolean;
  plain: boolean;
  explode: number;
  onHover: (face: FaceId | null) => void;
  onSelect: (face: FaceId) => void;
}

function CoreFace({
  face,
  geometry,
  scene,
  uid,
  state,
  color,
  hovered,
  awaitingFace,
  showLabel,
  showTag,
  plain,
  explode,
  onHover,
  onSelect,
}: CoreFaceProps) {
  const tagRef = useRef<THREE.Mesh>(null);
  const [pressed, setPressed] = useState(false);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    const mesh = tagRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!('emissiveIntensity' in material)) return;
    // Tag pulzuje, kým appka čaká na výber steny, a svieti stálo, keď s ním
    // čítačka práve komunikuje.
    const base = state === 'live' ? 1.1 : state === 'pending' ? 0.75 : 0.25;
    const pulse =
      state === 'pending' || state === 'live'
        ? 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * (state === 'live' ? 4.5 : 2.6)))
        : 0;
    material.emissiveIntensity = base + pulse + (hovered ? 0.5 : 0);
  });

  const faceOffset = geometry.coreMm / 2;
  const tagPush = explode * (geometry.shellMm - geometry.coreMm) * 0.5;
  const position: [number, number, number] = [
    face.normal[0] * (faceOffset + PAD_LIFT),
    face.normal[1] * (faceOffset + PAD_LIFT),
    face.normal[2] * (faceOffset + PAD_LIFT),
  ];

  const tagHalf = geometry.tagMm / 2;

  return (
    <group position={position} rotation={face.rotation}>
      {/* Klikací cieľ pokrýva celú stenu jadra, nie iba tag. */}
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
        <planeGeometry args={[geometry.coreMm * 0.98, geometry.coreMm * 0.98]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={pressed ? 0.34 : hovered ? 0.24 : awaitingFace ? 0.14 : 0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {showTag && (
        <group position={[0, 0, TAG_LIFT + tagPush]}>
          {/* Inlay NTAG zalisovaný do tejto steny jadra. */}
          <mesh ref={tagRef} raycast={() => null}>
            {geometry.tagShape === 'square' ? (
              <planeGeometry args={[geometry.tagMm, geometry.tagMm]} />
            ) : (
              <circleGeometry args={[tagHalf, 48]} />
            )}
            {plain ? (
              <meshBasicMaterial color={threeColor} side={THREE.DoubleSide} />
            ) : (
              <meshStandardMaterial
                color={threeColor}
                emissive={threeColor}
                emissiveIntensity={0.3}
                roughness={0.35}
                metalness={0.55}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>

          {/* Obrys inlayu: u štvorca rámik, u kruhu prstenec. */}
          <mesh position={[0, 0, 0.01]} raycast={() => null}>
            {geometry.tagShape === 'square' ? (
              <ringGeometry args={[tagHalf * 0.86, tagHalf * 0.94, 4, 1, Math.PI / 4]} />
            ) : (
              <ringGeometry args={[tagHalf * 0.86, tagHalf * 0.94, 48]} />
            )}
            <meshBasicMaterial
              color={scene.tagRim}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {showLabel && (
        <Html
          center
          distanceFactor={geometry.shellMm * 2.2}
          position={[0, 0, TAG_LIFT + tagPush + 0.4]}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none select-none rounded-md border border-white/15 bg-base-950/85 px-1.5 py-0.5 text-center font-mono text-[9px] leading-tight text-slate-300 backdrop-blur">
            <div className="text-[11px] font-semibold text-accent">{face.value}</div>
            <div>{uid ? uid.slice(-8) : 'nespárované'}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
