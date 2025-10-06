import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer, OrbitControls, RenderPass } from "three/examples/jsm/Addons.js";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

const Home = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  const createTextSprite = (text: string, fontSize = 48, color = "#ffffff") => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const scale = 256; // 텍스처 해상도
    canvas.width = scale;
    canvas.height = scale;

    // 텍스트 스타일
    context.font = `${fontSize}px Arial`;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, scale / 2, scale / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);

    // 스케일 조정 (작게)
    sprite.scale.set(0.05, 0.05, 0.05);

    return sprite;
  }

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 150;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = false;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const ambientLight = new THREE.AmbientLight(0xffffff, 5);
    scene.add(ambientLight);

    let humanModel: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.load("/models/human.glb", (gltf) => {
      humanModel = gltf.scene;

      humanModel.scale.set(1, 1, 1);
      humanModel.position.set(0, -150, 2.5);

      humanModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          materials.forEach((material) => {
            const mat = material as THREE.MeshStandardMaterial;

            // opacity가 정의되어 있지 않으면 1로 설정
            if (mat.opacity === undefined) mat.opacity = 1;
            // opacity가 1이면 transparent 끄기
            mat.transparent = mat.opacity < 1;

            if (mat.roughness === undefined) mat.roughness = 0.5;
            if (mat.metalness === undefined) mat.metalness = 0.3;
          });
        }
      });

      scene.add(humanModel);
    });

    let brainModel: THREE.Object3D | null = null;
    loader.load("/models/brain.glb", (gltf) => {
      brainModel = gltf.scene;

      brainModel.scale.set(8, 8, 8);
      brainModel.position.set(0, 0, 0);

      brainModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          materials.forEach((material) => {
            const mat = material as THREE.MeshStandardMaterial;

            // opacity가 정의되어 있지 않으면 1로 설정
            if (mat.opacity === undefined) mat.opacity = 1;
            // opacity가 1이면 transparent 끄기
            mat.transparent = mat.opacity < 1;

            if (mat.roughness === undefined) mat.roughness = 0.5;
            if (mat.metalness === undefined) mat.metalness = 0.3;
          });
        }
      });

      scene.add(brainModel)
    });

    const fading = new WeakMap<THREE.Object3D, boolean>();
    const fade = (direction: "in" | "out", model: THREE.Object3D, step = 0.05) => {
      if (fading.get(model)) return;
      fading.set(model, true);

      const start = () => {
        let valid = true;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.Material & { opacity?: number; transparent?: boolean };

            // opacity가 정의되지 않았으면 기본값 1
            if (mat.opacity === undefined) mat.opacity = 1;

            if (direction === "in") {
              if (mat.opacity < 1) {
                mat.opacity = Math.min(1, mat.opacity + step);
              }
              if (mat.opacity < 1) valid = false;
            } else { 
              if (mat.opacity > 0) {
                mat.opacity = Math.max(0, mat.opacity - step);
              }
              if (mat.opacity > 0) valid = false;
            }

            // opacity가 1이면 transparent 끄기, 1 미만이면 켜기
            mat.transparent = mat.opacity < 1;
          }
        });

        if (!valid) requestAnimationFrame(start);
        else fading.set(model, false);
      }

      start();
    }

    const smallSpheres: THREE.Mesh[] = [];
    const sphereInfos: {
      position: THREE.Vector3;
      radius: number;
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
    }[] = [];

    const numSpheres = 10;
    const maxDistance = 0.8;

    for (let i = 0; i < numSpheres; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = Math.cbrt(Math.random()) * maxDistance;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const sphereRadius = 0.02 + Math.random() * 0.02;

      const color = new THREE.Color(Math.random(), Math.random(), Math.random());

      const geometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.0002,
        (Math.random() - 0.5) * 0.0002,
        (Math.random() - 0.5) * 0.0002,
      )

      smallSpheres.push(mesh);
      sphereInfos.push({ position: new THREE.Vector3(x, y, z), radius: sphereRadius, mesh, velocity });
    }

    const setTextInSpheres = (spheres: THREE.Mesh[] = []) => {
      const sprites: THREE.Sprite[] = [];

      spheres.forEach((sphere, idx) => {
        const sprite = createTextSprite(`S${idx}`, 64, "#ffffff");

        sprite.position.set(
          sphere.position.x,
          sphere.position.y - (sphereInfos[idx].radius + 0.02),
          sphere.position.z
        );

        scene.add(sprite);
        sprites.push(sprite);
      });

      return sprites
    }

    const connectSpheres = (spheres: THREE.Mesh[] = []) => {
      const points: THREE.Vector3[] = [];
      const connectedSpheres = new Set<THREE.Mesh>();
  
      for (let i = 0; i < spheres.length; i++) {
        const posA = spheres[i].position;
        let minConnectDistance = Infinity;
        let closestSphere: THREE.Mesh | null = null;
  
        for (let j = 0; j < spheres.length; j++) {
          if (i === j) continue;
          else if (connectedSpheres.has(spheres[j])) continue;
  
          const posB = spheres[j].position;
          const distance = posA.distanceTo(posB);
          if (distance < minConnectDistance) {
            minConnectDistance = distance
            closestSphere = spheres[j];
          }
        }
  
        if (closestSphere && minConnectDistance) {
          points.push(posA.clone());
          points.push(closestSphere.position.clone());
          connectedSpheres.add(spheres[i]);
        }
      }
  
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });
      const lines = new THREE.LineSegments(geometry, material);
      scene.add(lines);

      return lines;
    }

    let sprites: THREE.Sprite[] = [];
    let lines: THREE.LineSegments | null = null;

    const animate = () => {
      requestAnimationFrame(animate);

      const spheres: THREE.Mesh[] = [];
      sphereInfos.forEach((info) => {
        // info.position.add(info.velocity);
        // info.mesh.position.copy(info.position);

        // if (info.position.length() > maxDistance) {
        //   info.position.normalize().multiplyScalar(maxDistance);
        //   info.velocity.reflect(info.position.clone().normalize());
        // }

        spheres.push(info.mesh);
      });

      sprites.forEach(sprite => scene.remove(sprite));
      sprites = setTextInSpheres(spheres)

      if (lines) {
        scene.remove(lines);
        (lines as THREE.LineSegments).geometry.dispose();
        ((lines as THREE.LineSegments).material as THREE.Material).dispose();
      }
      lines = connectSpheres(spheres);

      controls.update();
      composer.render();
    };
    animate();

    const handleZoom = () => {
      const distance = camera.position.distanceTo(controls.target);
      console.log(distance)
      
      if (distance < 3) {
        fade("out", brainModel!, 0.01);
      }
      else if (distance < 11) {
        fade("in", brainModel!, 0.005);
        fade("out", humanModel!);
      }
      else {
        fade("in", humanModel!);
      }
    };

    controls.addEventListener("change", handleZoom);

    const handleResize = () => {
      if (!mountRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("reszie", handleResize);
      controls.dispose();
      renderer.dispose();
      mountRef.current!.innerHTML = "";
    };
  }, []);

  return (
    <div ref={mountRef} className="full"></div>
  );
}

export default Home;