import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { prefersReducedMotion } from '@/utils';

function CropField() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.08;
  });

  const stems = useMemo(() => {
    const items: { pos: [number, number, number]; rot: number; scale: number; color: string }[] = [];
    const rows = 9;
    const cols = 9;
    const palette = ['#38A169', '#246B45', '#4CA37B'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - cols / 2) * 0.55 + (r % 2) * 0.27;
        const z = (r - rows / 2) * 0.55;
        items.push({
          pos: [x, 0, z],
          rot: (Math.random() - 0.5) * 0.3,
          scale: 0.8 + Math.random() * 0.5,
          color: palette[(r + c) % palette.length],
        });
      }
    }
    return items;
  }, []);

  return (
    <group ref={groupRef} position={[0, -0.4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#163D2B" roughness={1} />
      </mesh>
      {stems.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.rot, 0]} scale={s.scale}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.04, 0.7, 6]} />
            <meshStandardMaterial color={s.color} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.75, 0]} castShadow>
            <coneGeometry args={[0.12, 0.25, 6]} />
            <meshStandardMaterial color="#38A169" roughness={0.6} emissive="#1E5A3A" emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RollingHills() {
  return (
    <>
      <mesh position={[-3, -0.2, -3]} rotation={[-0.2, 0, 0.1]}>
        <coneGeometry args={[2.5, 1.4, 8]} />
        <meshStandardMaterial color="#102B1F" roughness={1} />
      </mesh>
      <mesh position={[3.2, -0.3, -4]} rotation={[-0.15, 0, -0.1]}>
        <coneGeometry args={[3, 1.8, 8]} />
        <meshStandardMaterial color="#163D2B" roughness={1} />
      </mesh>
      <mesh position={[0, -0.5, -6]} rotation={[-0.1, 0, 0]}>
        <coneGeometry args={[5, 2.4, 8]} />
        <meshStandardMaterial color="#0A1B14" roughness={1} />
      </mesh>
    </>
  );
}

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 2.5 + Math.sin(t * 0.3) * 0.15;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.6 + Math.sin(t * 0.5) * 0.1;
  });
  return (
    <mesh ref={ref} position={[3, 2.5, -5]}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="#F7F5ED" emissive="#FFD9A0" emissiveIntensity={0.7} />
    </mesh>
  );
}

function Scene() {
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} castShadow color="#FFE5B0" />
      <fog attach="fog" args={['#163D2B', 6, 14]} />
      <Suspense fallback={null}>
        <Float speed={reduced ? 0 : 1.2} rotationIntensity={0.2} floatIntensity={0.4}>
          <CropField />
        </Float>
        <RollingHills />
        <Sun />
        <Environment preset="sunset" />
      </Suspense>
    </>
  );
}

interface AgriScene3DProps {
  className?: string;
}

export function AgriScene3D({ className }: AgriScene3DProps) {
  return (
    <div className={className}>
      <Canvas
        shadows="basic"
        dpr={[1, 1.5]}
        camera={{ position: [0, 2.2, 5], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
