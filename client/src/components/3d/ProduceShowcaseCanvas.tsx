import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
        <group scale={1.6}>
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
        <group scale={1.6}>
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
        <group scale={1.6}>
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.32, 0.75, 24]} />
            <meshStandardMaterial
              color="#16a34a"
              emissive="#14532d"
              emissiveIntensity={0.15}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
            <meshStandardMaterial color="#14532d" roughness={0.8} />
          </mesh>
        </group>
      )}

      {type === 'wheat' && (
        <group scale={1.5} position={[0, -0.4, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
            <meshStandardMaterial color="#ca8a04" roughness={0.7} />
          </mesh>
          {[-0.2, -0.05, 0.1, 0.25, 0.4, 0.55].map((y, i) => (
            <group key={`showcase-grain-${i}`} position={[0, y + 0.3, 0]}>
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, 0.6]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.15} />
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

const ResponsiveProduceWrapper: React.FC<ProduceItemProps> = ({ type }) => {
  const { viewport } = useThree();
  const scale = Math.min(1.0, Math.max(0.65, (viewport.width * 0.9) / 3.2));

  return (
    <group scale={scale}>
      <ProduceModel type={type} />
    </group>
  );
};

export const ProduceShowcaseCanvas: React.FC<{ type: 'mango' | 'tomato' | 'capsicum' | 'wheat' }> = ({
  type,
}) => {
  return (
    <div className="w-full h-[260px] sm:h-[320px] relative">
      <Canvas
        camera={{ position: [0, 0.4, 4.4], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 4]} intensity={2.0} color="#ffffff" />
        <pointLight position={[-4, 2, -2]} intensity={1.0} color="#34d399" />
        <Float speed={2.5} rotationIntensity={0.3} floatIntensity={0.5}>
          <ResponsiveProduceWrapper type={type} />
        </Float>
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  );
};
