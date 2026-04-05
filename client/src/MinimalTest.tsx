/**
 * MinimalTest.tsx — Minimal R3F Canvas test
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4a4a4a" />
    </mesh>
  );
}

export function MinimalTest() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 20], zoom: 40, near: 0.1, far: 1000 }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#1a1a2f'));
          console.log('R3F Canvas created, gl:', gl);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <RotatingBox />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 10, color: '#0ff', fontFamily: 'monospace' }}>
        R3F MINIMAL TEST
      </div>
    </div>
  );
}
