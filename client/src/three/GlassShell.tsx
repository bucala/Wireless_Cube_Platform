import { Edges, MeshTransmissionMaterial, RoundedBox } from '@react-three/drei';

import { Pips } from './Pips';

export interface GlassShellProps {
  shellMm: number;
  /** Zaoblenie hrán – bez neho kocka vyzerá ako kváder z CAD-u. */
  cornerRadiusMm: number;
  pipDepthMm: number;
  /** Zabarvenie priehľadného materiálu. */
  tint: string;
  edgeColor: string;
  pipColor: string;
  showPips: boolean;
  /** Strohý režim: obyčajný priehľadný materiál namiesto transmisie. */
  plain: boolean;
}

/**
 * Priehľadný plášť kocky okolo jadra.
 *
 * Plášť nikdy neprijíma pointer eventy: kliknutia musia dopadnúť na steny jadra
 * pod ním, takže raycast je vypnutý priamo tu, nie až v handleri.
 */
export function GlassShell({
  shellMm,
  cornerRadiusMm,
  pipDepthMm,
  tint,
  edgeColor,
  pipColor,
  showPips,
  plain,
}: GlassShellProps) {
  // Zaoblenie nesmie prekročiť polovicu hrany, inak drei geometriu odmietne.
  const radius = Math.max(0.001, Math.min(cornerRadiusMm, shellMm / 2 - 0.05));

  return (
    <group>
      <RoundedBox
        args={[shellMm, shellMm, shellMm]}
        radius={radius}
        smoothness={plain ? 2 : 5}
        raycast={() => null}
      >
        {plain ? (
          <meshStandardMaterial
            color={tint}
            transparent
            opacity={0.38}
            roughness={0.35}
            metalness={0}
            depthWrite={false}
          />
        ) : (
          <MeshTransmissionMaterial
            samples={4}
            resolution={512}
            transmission={0.58}
            thickness={1.2}
            ior={1.46}
            chromaticAberration={0}
            anisotropy={0}
            roughness={0.16}
            distortion={0}
            distortionScale={0}
            temporalDistortion={0}
            attenuationDistance={7}
            attenuationColor={tint}
            color={tint}
          />
        )}
        <Edges scale={1.001} threshold={25} color={edgeColor} />
      </RoundedBox>

      {showPips && (
        <Pips shellMm={shellMm} depthMm={pipDepthMm} color={pipColor} plain={plain} />
      )}
    </group>
  );
}
