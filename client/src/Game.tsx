/**
 * Game.tsx — Main game component for The Flail of Sisyphus.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { FlailPlayer } from './entities/FlailPlayer';
import * as THREE from 'three';

// ─── Camera Follow ─────────────────────────────────────────────────────────

function CameraController({ player }: { player: FlailPlayer }) {
  const { camera } = useThree();
  const smoothX = useRef(0);
  const smoothY = useRef(5);

  useFrame(() => {
    const state = player.getState();
    const lerp = 0.06;
    smoothX.current += (state.bodyX - smoothX.current) * lerp;
    smoothY.current += (state.cameraTargetY - smoothY.current) * lerp;

    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const cam = camera as THREE.OrthographicCamera;
      cam.position.x = smoothX.current;
      cam.position.y = smoothY.current;
      cam.position.z = 20;
      cam.lookAt(smoothX.current, smoothY.current, 0);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// ─── Input Sync ─────────────────────────────────────────────────────────────

function InputSync({ player, canvasRef }: { player: FlailPlayer; canvasRef: HTMLCanvasElement | null }) {
  const smoothX = useRef(0);
  const smoothY = useRef(5);

  useFrame(() => {
    const state = player.getState();
    smoothX.current = state.bodyX;
    smoothY.current = state.cameraTargetY;
  });

  useEffect(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const zoom = 40;
      const wupp = 1 / zoom;
      const viewW = canvas.clientWidth;
      const viewH = canvas.clientHeight;
      const centerX = viewW / 2;
      const centerY = viewH / 2;

      const worldX = smoothX.current + (e.clientX - rect.left - centerX) * wupp;
      const worldY = smoothY.current + (e.clientY - rect.top - centerY) * wupp;

      player.input.updateWorldCoords(viewW, viewH, smoothX.current, smoothY.current, wupp);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [player, canvasRef]);

  return null;
}

// ─── Surfaces ─────────────────────────────────────────────────────────────

function SurfaceMesh({ surface }: { surface: any }) {
  const mat = useMemo(() => {
    if (surface.type === 'silt') {
      return new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 1.0, metalness: 0 });
    }
    if (surface.type === 'glass') {
      return new THREE.MeshStandardMaterial({ color: '#88ccff', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.6 });
    }
    if (surface.type === 'faraday') {
      return new THREE.MeshStandardMaterial({ color: '#1a0033', roughness: 0.3, metalness: 0.8, emissive: '#4400aa', emissiveIntensity: 0.3 });
    }
    return new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.9, metalness: 0.05 });
  }, [surface.type]);

  if (surface.broken && surface.type === 'glass') return null;

  return (
    <mesh
      position={[surface.x + surface.width / 2, surface.y + surface.height / 2, 0]}
      receiveShadow
    >
      <boxGeometry args={[surface.width, surface.height, 1]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Flail Mesh ─────────────────────────────────────────────────────────────

function FlailMesh({ player }: { player: FlailPlayer }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const chainRef = useRef<THREE.Line>(null);
  const headRef = useRef<THREE.Group>(null);
  const linkRefs = useRef<(THREE.Mesh | null)[]>([]);

  const ironMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.85, metalness: 0.7 }), []);
  const chainMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a5a5a', roughness: 0.6, metalness: 0.9 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4, metalness: 0.95 }), []);

  const spikes = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.5, y: Math.sin(angle) * 0.5, angle };
    }), []);

  useFrame(() => {
    const state = player.getState();

    // Body
    if (bodyRef.current) {
      bodyRef.current.position.x = state.bodyX;
      bodyRef.current.position.y = state.bodyY;
    }

    // Chain line
    if (chainRef.current) {
      const geo = chainRef.current.geometry;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const segs = player.chain.segments;
      pos.setXYZ(0, state.bodyX, state.bodyY, 0);
      for (let i = 0; i < segs.length; i++) {
        pos.setXYZ(i + 1, segs[i].positionX, segs[i].positionY, 0);
      }
      pos.needsUpdate = true;
    }

    // Chain links
    const segs = player.chain.segments;
    for (let i = 0; i < segs.length; i++) {
      const link = linkRefs.current[i];
      if (link) {
        link.position.x = segs[i].positionX;
        link.position.y = segs[i].positionY;
      }
    }

    // Head
    if (headRef.current) {
      headRef.current.position.x = state.headX;
      headRef.current.position.y = state.headY;
    }
  });

  const chainPts = player.chain.segments.length + 2;

  return (
    <group>
      {/* Body — cast-iron safe */}
      <mesh ref={bodyRef} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.8]} />
        <primitive object={ironMat} attach="material" />
      </mesh>

      {/* Chain line */}
      <line ref={chainRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={chainPts}
            array={new Float32Array(chainPts * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#555555" />
      </line>

      {/* Chain links */}
      {player.chain.segments.map((seg, i) => (
        <mesh
          key={i}
          ref={el => { linkRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.1, 6, 6]} />
          <primitive object={chainMat} attach="material" />
        </mesh>
      ))}

      {/* Head — spiked wrecking ball */}
      <group ref={headRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.35, 16, 16]} />
          <primitive object={headMat} attach="material" />
        </mesh>
        {spikes.map((spike, i) => (
          <mesh
            key={i}
            position={[spike.x * 0.6, spike.y * 0.6, 0]}
            rotation={[0, 0, spike.angle]}
          >
            <coneGeometry args={[0.06, 0.22, 6]} />
            <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Scene Contents ─────────────────────────────────────────────────────────

function SceneContents({ player, canvasRef }: { player: FlailPlayer; canvasRef: HTMLCanvasElement | null }) {
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (canvasRef) player.attachInput(canvasRef);
    return () => player.detachInput();
  }, [player, canvasRef]);

  useFrame(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime.current) / 1000, 1 / 30);
    lastTime.current = now;
    player.update(dt);
  });

  const surfaces = player.getSurfaces();

  return (
    <>
      {/* Fog */}
      <fog attach="fog" args={['#0a0a0f', 30, 80]} />

      {/* Lighting */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={2.5}
        color="#d0e8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={150}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <ambientLight intensity={0.35} color="#4466aa" />
      <directionalLight position={[-5, -5, -10]} intensity={0.5} color="#8899bb" />

      {/* Environment */}
      {surfaces.map((surf, i) => <SurfaceMesh key={i} surface={surf} />)}

      {/* Player flail */}
      <FlailMesh player={player} />

      {/* Camera */}
      <CameraController player={player} />
    </>
  );
}

// ─── HUD ───────────────────────────────────────────────────────────────────

function HUD({ state }: { state: any }) {
  const tensionPct = Math.min(100, (state.chainTension / 8) * 100);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {/* Top-left status */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        color: '#888',
        fontFamily: '"Courier New", monospace',
        fontSize: 11,
        lineHeight: 1.8,
      }}>
        <div style={{ color: '#555', marginBottom: 8, fontSize: 10, letterSpacing: 2 }}>
          THE FLAIL OF SISYPHUS
        </div>
        <div>
          Height: <span style={{ color: '#ccc' }}>{state.bodyY.toFixed(1)}</span>
        </div>
        <div>
          Tension:{' '}
          <span style={{
            color: tensionPct > 80 ? '#ff4444' : tensionPct > 50 ? '#ffaa00' : '#44ff88',
          }}>
            {tensionPct.toFixed(0)}%
          </span>
        </div>
        <div>
          Anchored:{' '}
          <span style={{ color: state.isAnchored ? '#44ff88' : '#555' }}>
            {state.isAnchored ? 'YES' : 'no'}
          </span>
        </div>
        <div>
          Ground:{' '}
          <span style={{ color: state.grounded ? '#44ff88' : '#555' }}>
            {state.grounded ? 'YES' : 'no'}
          </span>
        </div>
        {state.surfaceType && (
          <div style={{ color: '#666' }}>
            Surface: <span style={{
              color: state.surfaceType === 'silt' ? '#aa8833' :
                state.surfaceType === 'glass' ? '#88ccff' :
                  state.surfaceType === 'faraday' ? '#aa44ff' : '#888'
            }}>{state.surfaceType.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        color: '#444',
        fontFamily: '"Courier New", monospace',
        fontSize: 10,
        lineHeight: 1.8,
      }}>
        <div>MOUSE — attract flail head</div>
        <div>LEFT CLICK — anchor to surface</div>
        <div>RELEASE — yank body upward</div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function Game() {
  const playerRef = useRef<FlailPlayer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<any>(null);

  if (!playerRef.current) {
    playerRef.current = new FlailPlayer(0, 2);
  }

  // Throttled state update for HUD
  useEffect(() => {
    const id = setInterval(() => {
      if (playerRef.current) {
        setGameState(playerRef.current.getState());
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a0f' }}>
      <Canvas
        ref={canvasRef}
        orthographic
        camera={{ position: [0, 5, 20], zoom: 40, near: 0.1, far: 1000 }}
        shadows
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#0a0a0f'));
        }}
      >
        <SceneContents player={playerRef.current} canvasRef={canvasRef.current} />
      </Canvas>

      {gameState && <HUD state={gameState} />}
    </div>
  );
}
