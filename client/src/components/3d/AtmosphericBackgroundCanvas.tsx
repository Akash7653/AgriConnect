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

  useFrame((state) => {
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

// 2. 3D Swaying Wheat Stalks & Green Shoots
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
      {Array.from({ length: 32 }).map((_, i) => {
        const x = (i - 16) * 0.95;
        const isWheat = i % 2 === 0;

        return (
          <group key={`crop-${i}`} position={[x, 0, (i % 3) * 0.8]}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.02, 0.035, 2.4, 6]} />
              <meshStandardMaterial color={isWheat ? '#eab308' : '#16a34a'} roughness={0.6} />
            </mesh>
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

// 3. Animated 3D Farmer in the Harvest Field
const AnimatedFarmer: React.FC = () => {
  const armRef = useRef<THREE.Group>(null);
  const farmerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (farmerRef.current) {
      farmerRef.current.position.y = -2.8 + Math.sin(t * 1.8) * 0.04;
    }
    if (armRef.current) {
      armRef.current.rotation.z = -0.3 + Math.sin(t * 2.2) * 0.22;
      armRef.current.rotation.x = Math.cos(t * 1.6) * 0.15;
    }
  });

  return (
    <group ref={farmerRef} position={[-7.2, -2.8, -1.5]} scale={0.85}>
      {/* Traditional Farmer Straw Hat */}
      <mesh position={[0, 1.55, 0]}>
        <coneGeometry args={[0.45, 0.22, 16]} />
        <meshStandardMaterial color="#d97706" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.68, 0.68, 0.03, 16]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.6} />
      </mesh>
      {/* Farmer Tunic Shirt */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.75, 12]} />
        <meshStandardMaterial color="#047857" roughness={0.7} />
      </mesh>
      {/* Cotton Overalls */}
      <mesh position={[0, 0.68, 0.02]}>
        <boxGeometry args={[0.36, 0.65, 0.32]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      {/* Animated Harvesting Arm with Sickle */}
      <group ref={armRef} position={[0.26, 0.98, 0]}>
        <mesh position={[0.15, -0.22, 0]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.06, 0.06, 0.45, 8]} />
          <meshStandardMaterial color="#047857" roughness={0.7} />
        </mesh>
        <mesh position={[0.3, -0.42, 0]} rotation={[0, 0, 1.2]}>
          <torusGeometry args={[0.13, 0.025, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      {/* Left Resting Arm */}
      <mesh position={[-0.26, 0.78, 0.1]} rotation={[0.4, 0, 0.2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.45, 8]} />
        <meshStandardMaterial color="#047857" roughness={0.7} />
      </mesh>
      {/* Legs & Boots */}
      <mesh position={[-0.12, 0.2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.55, 8]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.55, 8]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.12, -0.1, 0.05]}>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0.12, -0.1, 0.05]}>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 4. Animated Farm Tractor Rolling along the Field Horizon
const AnimatedFarmTractor: React.FC = () => {
  const tractorRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (tractorRef.current) {
      tractorRef.current.position.x -= delta * 1.1;
      if (tractorRef.current.position.x < -18) {
        tractorRef.current.position.x = 18;
      }
    }
    if (wheelsRef.current) {
      wheelsRef.current.children.forEach((wheel) => {
        wheel.rotation.z -= delta * 3.8;
      });
    }
  });

  return (
    <group ref={tractorRef} position={[12, -2.9, -3.8]} scale={0.65}>
      {/* Main Body Engine Chassis */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 0.6, 0.85]} />
        <meshStandardMaterial color="#16a34a" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Hood */}
      <mesh position={[-0.7, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.5, 0.7]} />
        <meshStandardMaterial color="#15803d" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Cab Frame */}
      <mesh position={[0.3, 1.05, 0]}>
        <boxGeometry args={[0.75, 0.65, 0.75]} />
        <meshStandardMaterial color="#f8fafc" transparent opacity={0.65} />
      </mesh>
      {/* Exhaust Pipe */}
      <mesh position={[-0.8, 0.95, 0.25]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
      {/* Wheels */}
      <group ref={wheelsRef}>
        <mesh position={[0.45, 0.35, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.22, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
        <mesh position={[0.45, 0.35, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.22, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.85, 0.2, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.18, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.85, 0.2, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.18, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
};

// 5. Flocking Farm Birds in the Sky
const FlockingFarmBirds: React.FC = () => {
  const birdsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (birdsRef.current) {
      const t = state.clock.elapsedTime;
      birdsRef.current.position.x = ((t * 1.4) % 38) - 19;
      birdsRef.current.position.y = 4.4 + Math.sin(t * 0.9) * 0.45;

      birdsRef.current.children.forEach((bird, i) => {
        const wing = bird.children[1];
        if (wing) {
          wing.rotation.z = Math.sin(t * 7 + i) * 0.4;
        }
      });
    }
  });

  return (
    <group ref={birdsRef} position={[-18, 4.4, -6]}>
      {[-1.2, 0, 1.2].map((offset, i) => (
        <group key={`bird-${i}`} position={[offset * 0.8, (i % 2) * 0.3, (i % 3) * 0.4]} scale={0.28}>
          <mesh>
            <coneGeometry args={[0.08, 0.45, 4]} />
            <meshBasicMaterial color="#064e3b" />
          </mesh>
          <group>
            <mesh position={[0.28, 0, 0]} rotation={[0, 0, 0.35]}>
              <boxGeometry args={[0.45, 0.03, 0.18]} />
              <meshBasicMaterial color="#047857" />
            </mesh>
            <mesh position={[-0.28, 0, 0]} rotation={[0, 0, -0.35]}>
              <boxGeometry args={[0.45, 0.03, 0.18]} />
              <meshBasicMaterial color="#047857" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

// 6. Floating Golden Sunlight Spores
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

// 7. Subtle Farm Sun Orb
const RisingFarmSun: React.FC = () => {
  return (
    <group position={[9, 6, -10]}>
      <mesh>
        <sphereGeometry args={[1.8, 24, 24]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
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
        <FlockingFarmBirds />
        <OrganicCropFieldWaves mouse={mouse} />
        <SwayingAgriculturalCrops />
        <AnimatedFarmer />
        <AnimatedFarmTractor />
        <FloatingSunlitSpores count={80} />
      </Canvas>
    </div>
  );
};
