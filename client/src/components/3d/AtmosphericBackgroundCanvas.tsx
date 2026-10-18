import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Organic Undulating Agricultural Energy Wave Field
const OrganicCropFieldWaves: React.FC<{ mouse: { x: number; y: number } }> = ({ mouse }) => {
  const count = 1800;
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, initialY, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const initY = new Float32Array(count);
    const col = new Float32Array(count * 3);

    const colorEmerald = new THREE.Color('#10b981');
    const colorGold = new THREE.Color('#f59e0b');
    const colorTeal = new THREE.Color('#14b8a6');
    const colorCream = new THREE.Color('#fef3c7');

    for (let i = 0; i < count; i++) {
      // Wide dispersion across the screen space
      const x = (Math.random() - 0.5) * 28;
      const z = (Math.random() - 0.5) * 20 - 2;
      const y = (Math.random() - 0.5) * 10 - 1;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      initY[i] = y;

      // Color palette mix based on position
      const mixRatio = (x + 14) / 28;
      const pointColor =
        mixRatio < 0.35
          ? colorEmerald
          : mixRatio < 0.7
          ? colorTeal
          : mixRatio < 0.9
          ? colorGold
          : colorCream;

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
    const t = state.clock.elapsedTime * 0.7;

    for (let i = 0; i < count; i++) {
      const x = array[i * 3];
      const z = array[i * 3 + 2];

      // Wave formula representing rolling wind over agricultural crops
      const wave =
        Math.sin(x * 0.25 + t) * 0.6 +
        Math.cos(z * 0.25 + t * 0.8) * 0.5 +
        Math.sin((x + z) * 0.15 + t * 1.2) * 0.3;

      // React subtly to mouse position
      const mouseInfluence = (mouse.x * x + mouse.y * z) * 0.04;

      array[i * 3 + 1] = initialY[i] + wave + mouseInfluence;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// 2. Floating Bioluminescent Spores & Atmospheric Orbs
const FloatingBioSpores: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      spd[i] = 0.3 + Math.random() * 0.5;
    }
    return [pos, spd];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += speeds[i] * delta * 0.6;
      array[i * 3] += Math.sin(state.clock.elapsedTime * 0.5 + i) * delta * 0.2;

      // Wrap around when rising past top
      if (array[i * 3 + 1] > 9) {
        array[i * 3 + 1] = -9;
        array[i * 3] = (Math.random() - 0.5) * 24;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.22}
        color="#fbbf24"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
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
        camera={{ position: [0, 1.5, 11], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ width: '100vw', height: '100vh', position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.6} color="#064e3b" />
        <pointLight position={[6, 8, 4]} intensity={1.2} color="#10b981" />
        <pointLight position={[-6, -4, 2]} intensity={0.8} color="#f59e0b" />

        <OrganicCropFieldWaves mouse={mouse} />
        <FloatingBioSpores count={60} />
      </Canvas>
    </div>
  );
};
