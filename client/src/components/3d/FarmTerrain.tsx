import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const FarmTerrain: React.FC = () => {
  const windmillRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  // Subtle blade rotation and water shimmer
  useFrame((state, delta) => {
    if (windmillRef.current) {
      windmillRef.current.rotation.z += delta * 1.2;
    }
    if (waterRef.current) {
      const mat = waterRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.roughness = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      }
    }
  });

  return (
    <group position={[0, -2, 0]}>
      {/* 1. Base Rolling Farm Island */}
      <mesh receiveShadow position={[0, -0.4, 0]}>
        <cylinderGeometry args={[7.2, 7.8, 1.2, 36]} />
        <meshStandardMaterial
          color="#1e3a1e"
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* 2. Top Fertile Soil & Rolling Green Pasture */}
      <mesh receiveShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[7.15, 7.2, 0.2, 36]} />
        <meshStandardMaterial
          color="#2d5a27"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* 3. Winding Fresh Water Irrigation River */}
      <mesh
        ref={waterRef}
        rotation={[-Math.PI / 2, 0, 0.4]}
        position={[-0.8, 0.36, 0.5]}
      >
        <planeGeometry args={[1.6, 9, 16, 16]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.1}
          metalness={0.6}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 4. Tiered Agricultural Crop Terraces (Furrows) */}
      {/* Golden Wheat Fields */}
      <group position={[-2.8, 0.4, -1.2]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <group key={`wheat-row-${i}`} position={[i * 0.45 - 1.2, 0, 0]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[0.3, 0.35, 3.8]} />
              <meshStandardMaterial color="#eab308" roughness={0.6} />
            </mesh>
            {/* Wheat Stalk detail tips */}
            {Array.from({ length: 8 }).map((_, j) => (
              <mesh
                key={`stalk-${j}`}
                position={[0, 0.22, j * 0.45 - 1.6]}
                castShadow
              >
                <coneGeometry args={[0.06, 0.25, 4]} />
                <meshStandardMaterial color="#fde047" roughness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Emerald Vegetable & Fruit Rows */}
      <group position={[2.6, 0.4, -0.8]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <group key={`veg-row-${i}`} position={[i * 0.5 - 1.0, 0, 0]}>
            <mesh receiveShadow>
              <boxGeometry args={[0.32, 0.25, 3.5]} />
              <meshStandardMaterial color="#166534" roughness={0.8} />
            </mesh>
            {/* Individual Plant clusters */}
            {Array.from({ length: 7 }).map((_, j) => (
              <mesh
                key={`cabbage-${j}`}
                position={[0, 0.18, j * 0.48 - 1.4]}
                castShadow
              >
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#22c55e" roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* 5. Terracotta Raised Farm Pathway */}
      <mesh
        rotation={[-Math.PI / 2, 0, -0.6]}
        position={[0.2, 0.36, -0.2]}
        receiveShadow
      >
        <planeGeometry args={[0.9, 9]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>

      {/* 6. Stylized Traditional Barn / Storage Silo */}
      <group position={[-1.2, 0.4, -3.2]}>
        {/* Barn Base */}
        <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
          <boxGeometry args={[1.2, 0.9, 1.4]} />
          <meshStandardMaterial color="#991b1b" roughness={0.6} />
        </mesh>
        {/* Barn Gambrel Roof */}
        <mesh castShadow position={[0, 1.15, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[1.0, 0.6, 4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        {/* Barn Door */}
        <mesh position={[0, 0.3, 0.71]}>
          <planeGeometry args={[0.4, 0.6]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
      </group>

      {/* 7. Eco Windmill (Renewable Sustainable Farming) */}
      <group position={[3.2, 0.4, -3.0]}>
        {/* Tower */}
        <mesh castShadow position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.18, 0.35, 1.6, 8]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </mesh>
        {/* Rotor Hub */}
        <mesh position={[0, 1.6, 0.22]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Rotating 4 Blades */}
        <group ref={windmillRef} position={[0, 1.6, 0.25]}>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
            <mesh key={`blade-${idx}`} rotation={[0, 0, angle]} position={[0, 0, 0]}>
              <boxGeometry args={[0.14, 0.9, 0.02]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 8. Solar Powered Smart IoT Weather Station */}
      <group position={[-3.2, 0.4, 1.8]}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Solar Panel */}
        <mesh position={[0, 1.15, 0]} rotation={[0.5, 0.3, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.35]} />
          <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* IoT Glowing Sensor Indicator */}
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>
    </group>
  );
};
