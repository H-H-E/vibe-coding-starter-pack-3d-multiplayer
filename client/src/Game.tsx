/**
 * Game.tsx — The Flail of Sisyphus
 * Uses raw Three.js (not R3F) to avoid rendering issues.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FlailPlayer } from './entities/FlailPlayer';
import { FlailPlayerState } from './entities/FlailPlayer';

export function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<FlailPlayer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const smoothXRef = useRef(0);
  const smoothYRef = useRef(5);
  const meshesRef = useRef<{
    body: THREE.Mesh | null;
    chain: THREE.LineSegments | null;
    chainLinks: THREE.Mesh[];
    head: THREE.Group | null;
    surfaces: THREE.Mesh[];
  }>({ body: null, chain: null, chainLinks: [], head: null, surfaces: [] });
  const [gameState, setGameState] = useState<FlailPlayerState | null>(null);

  // ── Init Three.js ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    playerRef.current = new FlailPlayer(0, 2);
    const player = playerRef.current;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x0a0a0f);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);
    sceneRef.current = scene;

    // Camera (orthographic)
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const frustumSize = 20;
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 5, 0);
    cameraRef.current = camera;

    // Lights
    const dirLight = new THREE.DirectionalLight(0xd0e8ff, 2.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x4466aa, 0.35));
    const rimLight = new THREE.DirectionalLight(0x8899bb, 0.5);
    rimLight.position.set(-5, -5, -10);
    scene.add(rimLight);

    // Materials
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.85, metalness: 0.7 });
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.6, metalness: 0.9 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.95 });

    // Body mesh — cast-iron safe
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 0.8);
    const bodyMesh = new THREE.Mesh(bodyGeo, ironMat);
    bodyMesh.castShadow = true;
    scene.add(bodyMesh);
    meshesRef.current.body = bodyMesh;

    // Chain geometry (line segments)
    const chainPointCount = player.chain.segments.length + 1; // body anchor + N segments
    const chainPositions = new Float32Array(chainPointCount * 3);
    const chainGeo = new THREE.BufferGeometry();
    chainGeo.setAttribute('position', new THREE.BufferAttribute(chainPositions, 3));
    const chainLineMat = new THREE.LineBasicMaterial({ color: 0x555555 });
    const chainLine = new THREE.LineSegments(chainGeo, chainLineMat);
    scene.add(chainLine);
    meshesRef.current.chain = chainLine;

    // Chain link spheres
    const linkGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const links: THREE.Mesh[] = [];
    for (let i = 0; i < player.chain.segments.length; i++) {
      const link = new THREE.Mesh(linkGeo, chainMat);
      scene.add(link);
      links.push(link);
    }
    meshesRef.current.chainLinks = links;

    // Head — spiked wrecking ball
    const headGroup = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const ballMesh = new THREE.Mesh(ballGeo, headMat);
    ballMesh.castShadow = true;
    headGroup.add(ballMesh);
    const spikeGeo = new THREE.ConeGeometry(0.06, 0.22, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0);
      spike.rotation.z = angle;
      headGroup.add(spike);
    }
    scene.add(headGroup);
    meshesRef.current.head = headGroup;

    // Surfaces
    const surfaces = player.getSurfaces();
    const surfaceMeshes: THREE.Mesh[] = [];
    const surfaceMats: THREE.MeshStandardMaterial[] = [];
    for (const surf of surfaces) {
      let color = 0x4a4a4a;
      if (surf.type === 'silt') color = 0x8b7355;
      else if (surf.type === 'glass') color = 0x88ccff;
      else if (surf.type === 'faraday') color = 0x1a0033;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: surf.type === 'glass' ? 0.1 : 0.9,
        metalness: surf.type === 'faraday' ? 0.8 : 0.05,
        transparent: surf.type === 'glass',
        opacity: surf.type === 'glass' ? 0.6 : 1.0,
      });
      if (surf.type === 'faraday') {
        mat.emissive = new THREE.Color(0x4400aa);
        mat.emissiveIntensity = 0.3;
      }
      surfaceMats.push(mat);
      const geo = new THREE.BoxGeometry(surf.width, surf.height, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(surf.x + surf.width / 2, surf.y + surf.height / 2, 0);
      mesh.receiveShadow = true;
      scene.add(mesh);
      surfaceMeshes.push(mesh);
    }
    meshesRef.current.surfaces = surfaceMeshes;

    // Input handling
    const canvas = renderer.domElement;
    player.attachInput(canvas);

    const handleMouseMove = (e: MouseEvent) => {
      if (!player || !cameraRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const zoom = 40;
      const cam = cameraRef.current;
      const worldW = (rect.width / window.devicePixelRatio) / zoom;
      const worldH = (rect.height / window.devicePixelRatio) / zoom;
      const worldX = smoothXRef.current + (e.clientX - rect.left - rect.width / 2) / (rect.width / 2) * (worldW / 2);
      const worldY = smoothYRef.current + (e.clientY - rect.top - rect.height / 2) / (rect.height / 2) * (worldH / 2);
      player.input.updateWorldCoords(
        rect.width / window.devicePixelRatio,
        rect.height / window.devicePixelRatio,
        smoothXRef.current,
        smoothYRef.current,
        1 / zoom
      );
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    // Game loop
    let lastTime = performance.now();
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;

      player.update(dt);

      const state = player.getState();

      // Camera follow
      smoothXRef.current += (state.bodyX - smoothXRef.current) * 0.06;
      smoothYRef.current += (state.cameraTargetY - smoothYRef.current) * 0.06;
      camera.position.x = smoothXRef.current;
      camera.position.y = smoothYRef.current;
      camera.lookAt(smoothXRef.current, smoothYRef.current, 0);

      // Update body mesh
      if (meshesRef.current.body) {
        meshesRef.current.body.position.x = state.bodyX;
        meshesRef.current.body.position.y = state.bodyY;
      }

      // Update chain line
      if (meshesRef.current.chain) {
        const positions = meshesRef.current.chain.geometry.attributes.position as THREE.BufferAttribute;
        const segs = player.chain.segments;
        positions.setXYZ(0, state.bodyX, state.bodyY, 0);
        for (let i = 0; i < segs.length; i++) {
          positions.setXYZ(i + 1, segs[i].positionX, segs[i].positionY, 0);
        }
        positions.needsUpdate = true;
      }

      // Update chain links
      const segs = player.chain.segments;
      for (let i = 0; i < meshesRef.current.chainLinks.length; i++) {
        const link = meshesRef.current.chainLinks[i];
        if (link && segs[i]) {
          link.position.x = segs[i].positionX;
          link.position.y = segs[i].positionY;
        }
      }

      // Update head
      if (meshesRef.current.head) {
        meshesRef.current.head.position.x = state.headX;
        meshesRef.current.head.position.y = state.headY;
      }

      renderer.render(scene, camera);
    };
    animate();

    // HUD state
    const hudInterval = setInterval(() => {
      if (playerRef.current) {
        setGameState(playerRef.current.getState());
      }
    }, 100);

    // Resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const aspect = w / h;
      const fs = 20;
      cameraRef.current.left = -fs * aspect / 2;
      cameraRef.current.right = fs * aspect / 2;
      cameraRef.current.top = fs / 2;
      cameraRef.current.bottom = -fs / 2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(hudInterval);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      player.detachInput();
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── HUD ────────────────────────────────────────────────────────────────────
  const tensionPct = gameState ? Math.min(100, (gameState.chainTension / 8) * 100) : 0;

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a0f' }}>
      {gameState && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
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
            <div>Height: <span style={{ color: '#ccc' }}>{gameState.bodyY.toFixed(1)}</span></div>
            <div>Tension: <span style={{ color: tensionPct > 80 ? '#ff4444' : tensionPct > 50 ? '#ffaa00' : '#44ff88' }}>{tensionPct.toFixed(0)}%</span></div>
            <div>Anchor: <span style={{ color: gameState.isAnchored ? '#44ff88' : '#555' }}>{gameState.isAnchored ? 'LOCKED' : '—'}</span></div>
            <div>Ground: <span style={{ color: gameState.grounded ? '#44ff88' : '#555' }}>{gameState.grounded ? 'YES' : 'no'}</span></div>
            {gameState.surfaceType && (
              <div style={{ color: '#666' }}>Surface: {gameState.surfaceType.toUpperCase()}</div>
            )}
          </div>
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
      )}
    </div>
  );
}
