import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Organic Undulating Agricultural Energy Wave Field
const OrganicCropFieldWaves: React.FC<{ mouse: { x: number; y: number } }> = ({ mouse }) => {
  const count = 2200;
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, initialY, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const initY = new Float32Array(count);
    const col = new Float32Array(count * 3);

    const colorEmerald = new THREE.Color('#059669');
    const colorGold = new THREE.Color('#d97706');
    const colorLush = new THREE.Color('#10b981');
    const colorSun = new THREE.Color('#fef08a');

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 32;
      const z = (Math.random() - 0.5) * 22 - 1;
      const y = (Math.random() - 0.5) * 8 - 2.5;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      initY[i] = y;

      const mixRatio = (x + 16) / 32;
      const pointColor =
        mixRatio < 0.3
          ? colorEmerald
          : mixRatio < 0.65
          ? colorLush
          : mixRatio < 0.85
          ? colorGold
          : colorSun;

      col[i * 3] = pointColor.r;
      col[i * 3 + 1] = pointColor.g;
      col[i * 3 + 2] = pointColor.b;
    }

    return [pos, initY, col];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.8;

    for (let i = 0; i < count; i++) {
      const x = array[i * 3];
      const z = array[i * 3 + 2];

      const wave =
        Math.sin(x * 0.3 + t) * 0.7 +
        Math.cos(z * 0.3 + t * 0.9) * 0.6 +
        Math.sin((x + z) * 0.18 + t * 1.3) * 0.35;

      const mouseInfluence = (mouse.x * x + mouse.y * z) * 0.05;
      array[i * 3 + 1] = initialY[i] + wave + mouseInfluence;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        vertexColors
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// 2. 3D Swaying Wheat Stalks & Green Foliage on Horizon
const SwayingAgriculturalCrops: React.FC = () => {
  const wheatGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (wheatGroupRef.current) {
      const t = state.clock.elapsedTime;
      wheatGroupRef.current.children.forEach((child, idx) => {
        child.rotation.z = Math.sin(t * 1.5 + idx * 0.4) * 0.18;
      });
    }
  });

  return (
    <group ref={wheatGroupRef} position={[0, -4.5, -3]}>
      {/* Golden Wheat & Emerald Shoots along the lower edge */}
      {Array.from({ length: 32 }).map((_, i) => {
        const x = (i - 16) * 0.95;
        const isWheat = i % 2 === 0;

        return (
          <group key={`crop-${i}`} position={[x, 0, (i % 3) * 0.8]}>
            {/* Stalk */}
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.02, 0.035, 2.4, 6]} />
              <meshStandardMaterial
                color={isWheat ? '#eab308' : '#16a34a'}
                roughness={0.6}
              />
            </mesh>
            {/* Wheat Ear / Leaf Head */}
            <mesh position={[0, 2.4, 0]}>
              <coneGeometry args={[0.1, 0.6, 6]} />
              <meshStandardMaterial
                color={isWheat ? '#facc15' : '#22c55e'}
                emissive={isWheat ? '#ca8a04' : '#15803d'}
                emissiveIntensity={0.2}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// 3. Floating Golden Sunlight Spores & Dew Particles
const FloatingSunlitSpores: React.FC<{ count?: number }> = ({ count = 75 }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      spd[i] = 0.35 + Math.random() * 0.5;
    }
    return [pos, spd];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += speeds[i] * delta * 0.7;
      array[i * 3] += Math.sin(state.clock.elapsedTime * 0.6 + i) * delta * 0.25;

      if (array[i * 3 + 1] > 9) {
        array[i * 3 + 1] = -9;
        array[i * 3] = (Math.random() - 0.5) * 26;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.24}
        color="#fbbf24"
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// 4. Subtle Farm Sun Orb in Upper Right
const RisingFarmSun: React.FC = () => {
  return (
    <group position={[9, 6, -10]}>
      {/* Sun Core */}
      <mesh>
        <sphereGeometry args={[1.8, 24, 24]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      {/* Radiant Solar Glow Halo */}
      <mesh>
        <sphereGeometry args={[3.2, 24, 24]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

export const AtmosphericBackgroundCanvas: React.FC = () => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) setSupported(false);
    } catch {
      setSupported(false);
    }

    const handlePointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMouse({ x, y });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  if (!supported) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none"
    >
      <Canvas
        camera={{ position: [0, 1.2, 11], fov: 48 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ width: '100vw', height: '100vh', position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.7} color="#064e3b" />
        <directionalLight position={[8, 10, 5]} intensity={1.8} color="#fffbeb" />
        <pointLight position={[-6, -3, 3]} intensity={0.9} color="#10b981" />

        <RisingFarmSun />
        <OrganicCropFieldWaves mouse={mouse} />
        <SwayingAgriculturalCrops />
        <FloatingSunlitSpores count={80} />
      </Canvas>
    </div>
  );
};
