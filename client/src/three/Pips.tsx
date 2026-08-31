import { FACES, pipLayout } from '../lib/dice';

export interface PipsProps {
  /** Hrana vonkajšej kocky v mm. */
  shellMm: number;
  /** Ako hlboko bodky sedia pod povrchom. */
  depthMm: number;
  color: string;
  /** Strohý režim: plochý materiál bez odleskov. */
  plain: boolean;
}

// Pomery odvodené z klasickej 12 mm kocky, takže bodky rastú s rozmerom.
const RADIUS_RATIO = 0.052;
const SPREAD_RATIO = 0.225;

/**
 * Klasické bodky D6 na povrchu plášťa.
 *
 * Skutočné vyfrézovanie by znamenalo booleovskú operáciu na každej stene;
 * sploštená guľa zapustená tesne pod povrch vyzerá cez priehľadný materiál
 * identicky a scéna zostane dostatočne ľahká na 60 fps.
 */
export function Pips({ shellMm, depthMm, color, plain }: PipsProps) {
  const radius = shellMm * RADIUS_RATIO;
  const spread = shellMm * SPREAD_RATIO;
  const surface = shellMm / 2 - depthMm;

  return (
    <group>
      {FACES.map((face) => (
        <group
          key={face.id}
          position={[face.normal[0] * surface, face.normal[1] * surface, face.normal[2] * surface]}
          rotation={face.rotation}
        >
          {pipLayout(face.value).map(([u, v], index) => (
            <mesh
              key={`${face.id}-${index}`}
              position={[u * spread, v * spread, 0]}
              scale={[1, 1, 0.45]}
              raycast={() => null}
            >
              <sphereGeometry args={[radius, plain ? 12 : 20, plain ? 8 : 14]} />
              {plain ? (
                <meshBasicMaterial color={color} />
              ) : (
                <meshPhysicalMaterial
                  color={color}
                  roughness={0.32}
                  metalness={0.65}
                  clearcoat={0.5}
                  clearcoatRoughness={0.4}
                />
              )}
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
