import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FloatingProduceProps {
  pointerParallax?: { x: number; y: number };
}

export const FloatingProduce: React.FC<FloatingProduceProps> = ({ pointerParallax = { x: 0, y: 0 } }) => {
  const mangoGroup = useRef<THREE.Group>(null);
  const tomatoGroup = useRef<THREE.Group>(null);
  const pepperGroup = useRef<THREE.Group>(null);
  const wheatGroup = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // 1. Mango gentle hover & wobble
    if (mangoGroup.current) {
      mangoGroup.current.position.y = 1.2 + Math.sin(t * 1.5) * 0.15 + pointerParallax.y * 0.4;
      mangoGroup.current.position.x = 2.4 + pointerParallax.x * 0.4;
      mangoGroup.current.rotation.y += delta * 0.4;
      mangoGroup.current.rotation.z = Math.sin(t * 0.8) * 0.1;
    }

    // 2. Tomato gentle orbital hover
    if (tomatoGroup.current) {
      tomatoGroup.current.position.y = 0.8 + Math.cos(t * 1.8) * 0.12 - pointerParallax.y * 0.3;
      tomatoGroup.current.position.x = -2.6 - pointerParallax.x * 0.3;
      tomatoGroup.current.rotation.y += delta * 0.35;
      tomatoGroup.current.rotation.x = Math.sin(t * 1.2) * 0.12;
    }

    // 3. Bell Pepper hover
    if (pepperGroup.current) {
      pepperGroup.current.position.y = -0.5 + Math.sin(t * 1.3 + 1.2) * 0.14 + pointerParallax.y * 0.2;
      pepperGroup.current.position.x = 2.8 + pointerParallax.x * 0.2;
      pepperGroup.current.rotation.y -= delta * 0.3;
    }

    // 4. Wheat Stalk sway
    if (wheatGroup.current) {
      wheatGroup.current.position.y = -0.4 + Math.sin(t * 1.1 + 2.0) * 0.1 - pointerParallax.y * 0.25;
      wheatGroup.current.position.x = -2.7 + pointerParallax.x * 0.25;
      wheatGroup.current.rotation.z = Math.sin(t * 1.4) * 0.15;
    }
  });

  return (
    <group>
      {/* --- PRODUCE 1: GOLDEN ALPHONSO MANGO --- */}
      <group ref={mangoGroup} position={[2.4, 1.2, 0.5]} scale={1.2}>
        {/* Mango Body (Curved organic ellipsoidal form) */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#d97706"
            emissiveIntensity={0.12}
            roughness={0.25}
            metalness={0.08}
          />
        </mesh>
        {/* Mango blush tint */}
        <mesh position={[0.1, 0.1, 0.1]}>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshStandardMaterial
            color="#ef4444"
            transparent
            opacity={0.35}
            roughness={0.3}
          />
        </mesh>
        {/* Stem */}
        <mesh position={[0, 0.44, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.02, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
        {/* Green Leaf */}
        <mesh position={[0.1, 0.48, 0]} rotation={[0.4, 0.2, 0.8]}>
          <boxGeometry args={[0.18, 0.02, 0.35]} />
          <meshStandardMaterial color="#15803d" roughness={0.4} />
        </mesh>
      </group>

      {/* --- PRODUCE 2: RUBY HEIRLOOM TOMATO --- */}
      <group ref={tomatoGroup} position={[-2.6, 0.8, 0.4]} scale={1.15}>
        {/* Tomato Fruit */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#991b1b"
            emissiveIntensity={0.1}
            roughness={0.2}
            metalness={0.05}
          />
        </mesh>
        {/* Stem & Star Calyx */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.15, 8]} />
          <meshStandardMaterial color="#166534" roughness={0.6} />
        </mesh>
        {[0, 1.25, 2.5, 3.75, 5.0].map((rot, i) => (
          <mesh
            key={`calyx-${i}`}
            position={[Math.sin(rot) * 0.12, 0.44, Math.cos(rot) * 0.12]}
            rotation={[0.3, rot, 0]}
          >
            <coneGeometry args={[0.04, 0.18, 4]} />
            <meshStandardMaterial color="#22c55e" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* --- PRODUCE 3: CRISP EMERALD CAPSICUM --- */}
      <group ref={pepperGroup} position={[2.8, -0.5, 0.2]} scale={1.1}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.28, 0.65, 16]} />
          <meshStandardMaterial
            color="#15803d"
            roughness={0.22}
            metalness={0.1}
          />
        </mesh>
        {/* Capsicum Top Cap */}
        <mesh position={[0, 0.32, 0]}>
          <sphereGeometry args={[0.36, 16, 16]} />
          <meshStandardMaterial color="#166534" roughness={0.25} />
        </mesh>
        {/* Stem */}
        <mesh position={[0, 0.58, 0]} rotation={[0.2, 0, 0.15]}>
          <cylinderGeometry args={[0.03, 0.04, 0.2, 8]} />
          <meshStandardMaterial color="#14532d" roughness={0.7} />
        </mesh>
      </group>

      {/* --- PRODUCE 4: GOLDEN WHEAT SHEAF --- */}
      <group ref={wheatGroup} position={[-2.7, -0.4, 0.3]} scale={1.2}>
        <mesh rotation={[0, 0, 0.2]} castShadow>
          <cylinderGeometry args={[0.02, 0.03, 1.4, 8]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.5} />
        </mesh>
        {/* Golden Grains along stem */}
        {Array.from({ length: 9 }).map((_, i) => (
          <group key={`grain-pair-${i}`} position={[0, i * 0.1 - 0.2, 0]}>
            <mesh position={[0.08, 0, 0]} rotation={[0, 0, 0.6]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[-0.08, 0, 0]} rotation={[0, 0, -0.6]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
