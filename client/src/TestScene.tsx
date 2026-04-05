/**
 * TestScene.tsx — Minimal Three.js test to verify WebGL rendering works.
 * Pure Three.js, no R3F.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function TestScene() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(800, 600);
    renderer.setClearColor(0x0a0a0f, 1);
    divRef.current.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    camera.position.z = 20;

    // Box
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(0, 0, 0);
    scene.add(box);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(20, 5);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -4, 0);
    scene.add(ground);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xd0e8ff, 2.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x4466aa, 0.35));

    // Animate
    let frame = 0;
    const animate = () => {
      frame++;
      box.rotation.y = frame * 0.01;
      box.rotation.x = frame * 0.005;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.dispose();
      if (divRef.current) {
        divRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ width: 800, height: 600, position: 'relative' }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 14,
        pointerEvents: 'none',
      }}>
        RAW THREE.JS TEST
      </div>
    </div>
  );
}
