import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

const NetworkNode: React.FC<{
  position: [number, number, number];
  color: string;
  label: string;
  iconText: string;
  active?: boolean;
}> = ({ position, color, label, iconText, active = true }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.4 : 0.1}
          metalness={0.7}
          roughness={0.2}
          wireframe={!active}
        />
      </mesh>
      {/* Outer pulsing halo */}
      {active && (
        <mesh>
          <sphereGeometry args={[0.65, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} wireframe />
        </mesh>
      )}
    </group>
  );
};

const ConnectionBeam: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  broken?: boolean;
}> = ({ start, end, color, broken = false }) => {
  const lineMesh = React.useMemo(() => {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: broken ? '#ef4444' : color,
      linewidth: 3,
      transparent: true,
      opacity: broken ? 0.35 : 0.85,
    });
    return new THREE.Line(lineGeo, lineMat);
  }, [start, end, color, broken]);

  return <primitive object={lineMesh} />;
};

export const SupplyChainTransformationScene: React.FC<{ mode: 'traditional' | 'agriconnect' }> = ({
  mode,
}) => {
  const isAgri = mode === 'agriconnect';

  return (
    <Canvas
      camera={{ position: [0, 1.2, 7.5], fov: 45 }}
      style={{ height: '360px', width: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-4, -2, 2]} intensity={0.6} color={isAgri ? '#10b981' : '#f87171'} />

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.4}>
        {isAgri ? (
          /* --- AGRICONNECT ONE NETWORK (Connected Direct) --- */
          <group>
            {/* Central Farm Producer Hub */}
            <NetworkNode
              position={[-3, 0, 0]}
              color="#10b981"
              label="Verified Farmers & FPOs"
              iconText="🌾"
            />

            {/* Direct Connected Buyer Nodes */}
            <NetworkNode position={[2.8, 1.6, 0]} color="#38bdf8" label="Households" iconText="🏠" />
            <NetworkNode position={[3.2, 0, 0]} color="#a855f7" label="Restaurants & Hotels" iconText="🍽️" />
            <NetworkNode position={[2.8, -1.6, 0]} color="#f59e0b" label="Supermarkets & Retail" iconText="🏬" />
            <NetworkNode position={[0, -1.8, 0.5]} color="#14b8a6" label="Cold-Chain Logistics" iconText="🚚" />

            {/* Glowing Direct Connection Lines */}
            <ConnectionBeam start={[-3, 0, 0]} end={[2.8, 1.6, 0]} color="#10b981" />
            <ConnectionBeam start={[-3, 0, 0]} end={[3.2, 0, 0]} color="#10b981" />
            <ConnectionBeam start={[-3, 0, 0]} end={[2.8, -1.6, 0]} color="#10b981" />
            <ConnectionBeam start={[-3, 0, 0]} end={[0, -1.8, 0.5]} color="#14b8a6" />
            <ConnectionBeam start={[0, -1.8, 0.5]} end={[2.8, 1.6, 0]} color="#14b8a6" />
            <ConnectionBeam start={[0, -1.8, 0.5]} end={[3.2, 0, 0]} color="#14b8a6" />
          </group>
        ) : (
          /* --- TRADITIONAL FRAGMENTED MANDI CHAIN (Disconnected, 5 Intermediaries) --- */
          <group>
            <NetworkNode position={[-3.6, 0, 0]} color="#94a3b8" label="Farmer (33% value)" iconText="🌾" active={false} />
            <NetworkNode position={[-2.0, 0.8, -0.5]} color="#f87171" label="Village Middleman" iconText="⚠️" active={false} />
            <NetworkNode position={[-0.4, -0.6, 0.2]} color="#f87171" label="Commission Agent" iconText="⚠️" active={false} />
            <NetworkNode position={[1.2, 0.9, -0.4]} color="#f87171" label="Wholesale Mandi" iconText="⚠️" active={false} />
            <NetworkNode position={[2.6, -0.5, 0.3]} color="#f87171" label="Local Retailer (+150% markup)" iconText="⚠️" active={false} />
            <NetworkNode position={[3.8, 0, 0]} color="#94a3b8" label="Consumer" iconText="🛒" active={false} />

            {/* Fragmented, thin, broken links */}
            <ConnectionBeam start={[-3.6, 0, 0]} end={[-2.0, 0.8, -0.5]} color="#ef4444" broken />
            <ConnectionBeam start={[-2.0, 0.8, -0.5]} end={[-0.4, -0.6, 0.2]} color="#ef4444" broken />
            <ConnectionBeam start={[-0.4, -0.6, 0.2]} end={[1.2, 0.9, -0.4]} color="#ef4444" broken />
            <ConnectionBeam start={[1.2, 0.9, -0.4]} end={[2.6, -0.5, 0.3]} color="#ef4444" broken />
            <ConnectionBeam start={[2.6, -0.5, 0.3]} end={[3.8, 0, 0]} color="#ef4444" broken />
          </group>
        )}
      </Float>
    </Canvas>
  );
};
