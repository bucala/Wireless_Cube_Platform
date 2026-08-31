import { Edges, MeshTransmissionMaterial } from '@react-three/drei';

import { SHELL_SIZE_MM } from '../lib/dice';
import { Pips } from './Pips';

/**
 * The 12 x 12 x 12 mm transparent envelope around the core.
 *
 * The shell never takes pointer events: the calibration flow needs clicks to
 * land on the core faces underneath, so raycasting is disabled here instead of
 * inside the click handler.
 */
export function GlassShell({ tint = '#7dd3fc' }: { tint?: string }) {
  return (
    <group>
      <mesh raycast={() => null}>
        <boxGeometry args={[SHELL_SIZE_MM, SHELL_SIZE_MM, SHELL_SIZE_MM]} />
        <MeshTransmissionMaterial
          samples={6}
          resolution={512}
          transmission={1}
          thickness={1.6}
          ior={1.5}
          chromaticAberration={0.06}
          anisotropy={0.15}
          roughness={0.08}
          distortion={0.15}
          distortionScale={0.25}
          temporalDistortion={0.05}
          attenuationDistance={9}
          attenuationColor={tint}
          color="#eaf6ff"
        />
        <Edges scale={1.001} threshold={15} color="#38bdf8" />
      </mesh>
      <Pips />
    </group>
  );
}
