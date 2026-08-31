import { useMemo } from 'react';
import * as THREE from 'three';

import { FACES, SHELL_SIZE_MM, pipLayout } from '../lib/dice';

const PIP_RADIUS_MM = 0.62;
const PIP_SPREAD_MM = 2.7; // distance of the outer pip row from the face centre
const PIP_DEPTH_MM = 0.22; // how deep the "engraving" sits below the surface

/**
 * Classic D6 pips on the outside of the glass shell.
 *
 * True CSG engraving would need a boolean mesh operation per face; a flattened
 * sphere sunk slightly below the surface reads exactly the same through a
 * transmissive material and keeps the geometry cheap enough for a 60 fps
 * dashboard.
 */
export function Pips({ color = '#0b1220' }: { color?: string }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(PIP_RADIUS_MM, 20, 14), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness: 0.85,
        metalness: 0.05,
        clearcoat: 0.4,
        clearcoatRoughness: 0.6,
      }),
    [color],
  );

  const surface = SHELL_SIZE_MM / 2 - PIP_DEPTH_MM;

  return (
    <group>
      {FACES.map((face) => (
        <group
          key={face.id}
          position={[
            face.normal[0] * surface,
            face.normal[1] * surface,
            face.normal[2] * surface,
          ]}
          rotation={face.rotation}
        >
          {pipLayout(face.value).map(([u, v], index) => (
            <mesh
              key={`${face.id}-${index}`}
              geometry={geometry}
              material={material}
              position={[u * PIP_SPREAD_MM, v * PIP_SPREAD_MM, 0]}
              scale={[1, 1, 0.45]}
              raycast={() => null}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
