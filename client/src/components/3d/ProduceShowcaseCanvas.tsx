import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

interface ProduceItemProps {
  type: 'mango' | 'tomato' | 'capsicum' | 'wheat';
}

const ProduceModel: React.FC<ProduceItemProps> = ({ type }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <group ref={meshRef}>
      {type === 'mango' && (
        <group scale={1.8}>
          <mesh castShadow>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#b45309"
              emissiveIntensity={0.15}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0.12, 0.1, 0.1]}>
            <sphereGeometry args={[0.38, 20, 20]} />
            <meshStandardMaterial color="#ef4444" transparent opacity={0.3} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.52, 0]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.03, 0.04, 0.16, 8]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
          </mesh>
          <mesh position={[0.12, 0.55, 0]} rotation={[0.4, 0.2, 0.8]}>
            <boxGeometry args={[0.2, 0.02, 0.4]} />
            <meshStandardMaterial color="#15803d" roughness={0.4} />
          </mesh>
        </group>
      )}

      {type === 'tomato' && (
        <group scale={1.8}>
          <mesh castShadow>
            <sphereGeometry args={[0.52, 32, 32]} />
            <meshStandardMaterial
              color="#dc2626"
              emissive="#7f1d1d"
              emissiveIntensity={0.15}
              roughness={0.18}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 0.16, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.6} />
          </mesh>
          {[0, 1.25, 2.5, 3.75, 5.0].map((rot, i) => (
            <mesh
              key={`showcase-calyx-${i}`}
              position={[Math.sin(rot) * 0.15, 0.5, Math.cos(rot) * 0.15]}
              rotation={[0.3, rot, 0]}
            >
              <coneGeometry args={[0.05, 0.22, 4]} />
              <meshStandardMaterial color="#22c55e" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}

      {type === 'capsicum' && (
        <group scale={1.8}>
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.32, 0.75, 24]} />
            <meshStandardMaterial color="#15803d" roughness={0.25} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.42, 20, 20]} />
            <meshStandardMaterial color="#166534" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.68, 0]} rotation={[0.2, 0, 0.15]}>
            <cylinderGeometry args={[0.04, 0.05, 0.22, 8]} />
            <meshStandardMaterial color="#14532d" roughness={0.7} />
          </mesh>
        </group>
      )}

      {type === 'wheat' && (
        <group scale={1.8}>
          <mesh rotation={[0, 0, 0.1]} castShadow>
            <cylinderGeometry args={[0.025, 0.035, 1.6, 8]} />
            <meshStandardMaterial color="#ca8a04" roughness={0.5} />
          </mesh>
          {Array.from({ length: 11 }).map((_, i) => (
            <group key={`wheat-showcase-${i}`} position={[0, i * 0.11 - 0.4, 0]}>
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, 0.6]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.15} />
              </mesh>
              <mesh position={[-0.09, 0, 0]} rotation={[0, 0, -0.6]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.15} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};

export const ProduceShowcaseCanvas: React.FC<{ type: 'mango' | 'tomato' | 'capsicum' | 'wheat' }> = ({
  type,
}) => {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 3.8], fov: 45 }}
      style={{ width: '100%', height: '280px' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 4]} intensity={2.0} color="#ffffff" />
      <pointLight position={[-4, 2, -2]} intensity={1.0} color="#34d399" />
      <Float speed={2.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <ProduceModel type={type} />
      </Float>
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.5} />
    </Canvas>
  );
};
