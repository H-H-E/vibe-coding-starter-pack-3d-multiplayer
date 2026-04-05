/**
 * FlailScene.tsx — Main Three.js scene for The Flail of Sisyphus.
 *
 * Sets up:
 * - Orthographic camera (strictly X/Y locked, Z for depth only)
 * - Lighting: cold directional + ambient
 * - Ground plane + platform meshes
 * - The Flail (body + chain + head)
 * - Volumetric fog at height
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { FlailPlayer } from '../entities/FlailPlayer';
import { Surface } from '../physics/CollisionSystem';

// ─── Camera ────────────────────────────────────────────────────────────────

function CameraController({ player }: { player: FlailPlayer }) {
  const { camera } = useThree();
  const smoothX = useRef(0);
  const smoothY = useRef(5);

  useFrame(() => {
    const state = player.getState();
    const lerp = 0.08;
    smoothX.current += (state.bodyX - smoothX.current) * lerp;
    smoothY.current += (state.cameraTargetY - smoothY.current) * lerp;

    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.x = smoothX.current;
      camera.position.y = smoothY.current;
      camera.position.z = 20;
      camera.lookAt(smoothX.current, smoothY.current, 0);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

// ─── Materials (memoized) ───────────────────────────────────────────────────

const concreteMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#4a4a4a'),
  roughness: 0.95,
  metalness: 0.05,
});

const siltMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#8b7355'),
  roughness: 1.0,
  metalness: 0.0,
});

const glassMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#88ccff'),
  roughness: 0.1,
  metalness: 0.0,
  transparent: true,
  opacity: 0.6,
});

const faradayMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1a0033'),
  roughness: 0.3,
  metalness: 0.8,
  emissive: new THREE.Color('#4400aa'),
  emissiveIntensity: 0.3,
});

// ─── Surfaces ───────────────────────────────────────────────────────────────

function SurfaceMesh({ surface }: { surface: Surface }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    switch (surface.type) {
      case 'silt': return siltMaterial;
      case 'glass': return surface.broken ? null : glassMaterial;
      case 'faraday': return faradayMaterial;
      default: return concreteMaterial;
    }
  }, [surface.type, surface.broken]);

  if (!material || surface.broken) return null;

  return (
    <mesh
      ref={meshRef}
      position={[surface.x + surface.width / 2, surface.y + surface.height / 2, 0]}
      receiveShadow
    >
      <boxGeometry args={[surface.width, surface.height, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─── The Flail ──────────────────────────────────────────────────────────────

const ironMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#3d2b1f'),
  roughness: 0.85,
  metalness: 0.7,
});

const chainMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#5a5a5a'),
  roughness: 0.6,
  metalness: 0.9,
});

const headMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1a1a1a'),
  roughness: 0.4,
  metalness: 0.95,
});

function FlailMesh({ player }: { player: FlailPlayer }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const chainLinesRef = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    const state = player.getState();

    // Update body position
    if (bodyRef.current) {
      bodyRef.current.position.x = state.bodyX;
      bodyRef.current.position.y = state.bodyY;
    }

    // Update chain line
    if (chainLinesRef.current) {
      const positions = chainLinesRef.current.geometry.attributes.position;
      const chain = player.chain;
      const segs = chain.segments;

      // Start from body
      positions.setXYZ(0, state.bodyX, state.bodyY, 0);
      // Then each segment
      for (let i = 0; i < segs.length; i++) {
        positions.setXYZ(i + 1, segs[i].positionX, segs[i].positionY, 0);
      }
      positions.needsUpdate = true;
    }
  });

  const chainPointCount = player.chain.segments.length + 2; // body + N segments + head

  return (
    <group>
      {/* Body — cast-iron safe */}
      <mesh ref={bodyRef} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.8]} />
        <primitive object={ironMaterial} attach="material" />
      </mesh>

      {/* Chain — line segments */}
      <lineSegments ref={chainLinesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={chainPointCount}
            array={new Float32Array(chainPointCount * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666666" linewidth={2} />
      </lineSegments>

      {/* Chain links — small spheres at each joint */}
      {player.chain.segments.map((seg, i) => (
        <ChainLink key={i} segment={seg} />
      ))}

      {/* Head — spiked wrecking ball */}
      <FlailHeadMesh player={player} />
    </group>
  );
}

function ChainLink({ segment }: { segment: any }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.x = segment.positionX;
      ref.current.position.y = segment.positionY;
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <primitive object={chainMaterial} attach="material" />
    </mesh>
  );
}

function FlailHeadMesh({ player }: { player: FlailPlayer }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const state = player.getState();
    if (ref.current) {
      ref.current.position.x = state.headX;
      ref.current.position.y = state.headY;
    }
  });

  const spikes = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        x: Math.cos(angle) * 0.5,
        y: Math.sin(angle) * 0.5,
        angle,
      };
    });
  }, []);

  return (
    <group ref={ref}>
      {/* Main ball */}
      <mesh castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <primitive object={headMaterial} attach="material" />
      </mesh>
      {/* Spikes */}
      {spikes.map((spike, i) => (
        <mesh
          key={i}
          position={[spike.x * 0.6, spike.y * 0.6, 0]}
          rotation={[0, 0, spike.angle]}
        >
          <coneGeometry args={[0.06, 0.25, 6]} />
          <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Environment ────────────────────────────────────────────────────────────

function Environment() {
  return (
    <group>
      {/* Cold directional light */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={2.5}
        color={new THREE.Color('#d0e8ff')}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      {/* Ambient */}
      <ambientLight intensity={0.3} color={new THREE.Color('#4466aa')} />
      {/* Rim light from behind */}
      <directionalLight position={[-5, -5, -10]} intensity={0.5} color={new THREE.Color('#8899bb')} />
    </group>
  );
}

// ─── Sky + Fog ─────────────────────────────────────────────────────────────

function SkyAndFog() {
  const { scene } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color('#0a0a0f');
    scene.fog = new THREE.FogExp2(new THREE.Color('#0a0a0f'), 0.025);
  }, [scene]);
  return null;
}

// ─── Main Scene ─────────────────────────────────────────────────────────────

function SceneContents({ player }: { player: FlailPlayer }) {
  const surfaces = player.getSurfaces();

  return (
    <>
      <SkyAndFog />
      <Environment />
      <CameraController player={player} />
      <FlailMesh player={player} />
      {surfaces.map((surf, i) => (
        <SurfaceMesh key={i} surface={surf} />
      ))}
    </>
  );
}

// ─── Public Component ────────────────────────────────────────────────────────

interface FlailSceneProps {
  player: FlailPlayer;
}

export function FlailScene({ player }: FlailSceneProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      <Canvas
        orthographic
        camera={{ position: [0, 5, 20], zoom: 40, near: 0.1, far: 1000 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContents player={player} />
      </Canvas>
    </div>
  );
}
