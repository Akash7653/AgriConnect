import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FarmTerrain } from './FarmTerrain.js';
import { FloatingProduce } from './FloatingProduce.js';
import { AtmosphericParticles } from './AtmosphericParticles.js';

// Smooth interactive cinematic camera reacting to pointer and time
const CinematicCameraRig: React.FC<{ pointer: { x: number; y: number } }> = ({ pointer }) => {
  const { camera } = useThree();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // Base gentle breathing motion + smooth pointer parallax lerp
    const targetX = pointer.x * 1.5 + Math.sin(t * 0.25) * 0.4;
    const targetY = 2.2 + pointer.y * 0.8 + Math.cos(t * 0.3) * 0.2;
    const targetZ = 8.5;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, delta * 2.5);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, delta * 2.5);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, delta * 2.5);

    camera.lookAt(0, 0.2, 0);
  });

  return null;
};

// Error Boundary for WebGL fallback
class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('WebGL Context Warning/Error captured gracefully:', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const FarmHeroCanvas: React.FC = () => {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setIsSupported(false);
    } catch {
      setIsSupported(false);
    }
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    setPointer({ x, y });
  };

  const fallbackUI = (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-gradient-to-br from-emerald-900 via-forest to-slate-950 rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
      <div className="relative text-center space-y-4 max-w-md">
        <span className="text-5xl">🌾</span>
        <h3 className="text-2xl font-bold text-white">Direct Farm-to-Table Ecosystem</h3>
        <p className="text-sm text-emerald-200/80">
          Connecting verified farmers directly with buyers across India with transparent 90% payouts and guaranteed 12-hour harvest delivery.
        </p>
      </div>
    </div>
  );

  if (!isSupported) {
    return fallbackUI;
  }

  return (
    <div
      onPointerMove={handlePointerMove}
      className="w-full h-full min-h-[520px] lg:min-h-[640px] relative cursor-grab active:cursor-grabbing select-none"
    >
      <WebGLErrorBoundary fallback={fallbackUI}>
        <Canvas
          shadows
          camera={{ position: [0, 2.2, 8.5], fov: 42 }}
          dpr={[1, 1.8]} // Responsive DPR clamped for high performance
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        >
          <Suspense fallback={null}>
            {/* Cinematic Lighting System */}
            {/* 1. Warm Golden Hour Sunlight */}
            <directionalLight
              position={[8, 12, 6]}
              intensity={2.2}
              color="#fffbeb"
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0001}
            />
            {/* 2. Soft Sky Ambient Fill */}
            <ambientLight intensity={0.9} color="#e0f2fe" />
            {/* 3. Rim Lighting on Produce Edges */}
            <pointLight position={[-6, 4, -4]} intensity={1.2} color="#34d399" />
            {/* 4. Ground Bounce Warm Light */}
            <pointLight position={[0, -2, 2]} intensity={0.5} color="#d97706" />

            {/* Camera Movement Rig */}
            <CinematicCameraRig pointer={pointer} />

            {/* 3D Scene Components */}
            <FarmTerrain />
            <FloatingProduce pointerParallax={pointer} />
            <AtmosphericParticles count={110} />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
};
