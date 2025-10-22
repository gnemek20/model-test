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
      5000
    );
    camera.position.z = 750;
    // camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.zoomSpeed = 1.5;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    let spaceModel: THREE.Object3D | null = null;
    loader.load("/models/space.glb", (gltf) => {
      spaceModel = gltf.scene;
      const spaceSize = 25;

      spaceModel.scale.set(spaceSize, spaceSize, spaceSize);
      spaceModel.position.set(0, 0, 0);

      scene.add(spaceModel);
    });

    let humanModel: THREE.Object3D | null = null;
    loader.load("/models/human.glb", (gltf) => {
      humanModel = gltf.scene;
      const humanSize = 12;

      humanModel.scale.set(humanSize , humanSize, humanSize);
      humanModel.position.set(0, -1800, 2.5);

      humanModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 15);
          const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf2f2f2, linewidth: 1, transparent: true, opacity: 1 });
          const lineSegments = new THREE.LineSegments(edgesGeometry, lineMaterial);

          mesh.add(lineSegments);

          materials.forEach((material) => {
            const mat = material as THREE.MeshStandardMaterial;

            mat.emissive = new THREE.Color(0xffffff);
            mat.emissiveIntensity = 0.6

            if (mat.roughness === undefined) mat.roughness = 0.5;
            if (mat.metalness === undefined) mat.metalness = 0.3;

            mat.needsUpdate = true;
          });
        }
      });

      // humanModel.visible = false
      scene.add(humanModel);
    });

    let brainModel: THREE.Object3D | null = null;
    loader.load("/models/brain.glb", (gltf) => {
      brainModel = gltf.scene;
      const brainSize = 15;

      brainModel.scale.set(brainSize, brainSize, brainSize);
      brainModel.position.set(0, 0, 0);
      brainModel.rotation.set(0, (Math.PI - 0.4), 0);

      // brainModel 전체 bounding box
      const centerOffset = -0.2;
      const brainBox = new THREE.Box3().setFromObject(brainModel);
      const brainCenterX = (brainBox.min.x + brainBox.max.x) / 2 + centerOffset;

      brainModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const geometry = mesh.geometry as THREE.BufferGeometry;

          // 기존 material 정보 저장
          const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

          if ((oldMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = oldMat as THREE.MeshStandardMaterial;
            const vertexMat = new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: stdMat.roughness,
              metalness: stdMat.metalness,
            });
            mesh.material = vertexMat;
          }

          // vertex color attribute 준비
          const position = geometry.attributes.position;
          let color = geometry.attributes.color as THREE.BufferAttribute;

          if (!color) {
            const colors = new Float32Array(position.count * 3);
            color = new THREE.BufferAttribute(colors, 3);
            geometry.setAttribute("color", color);
          }

          // vertex별 좌/우 색상 적용
          for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);

            if (x < brainCenterX) {
              color.setXYZ(i, 1, 0, 0); // 왼쪽 빨강
            } else {
              color.setXYZ(i, 0, 0, 1); // 오른쪽 파랑
            }
          }

          color.needsUpdate = true;

          // cast/receive shadow 설정 (선택)
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      scene.add(brainModel);
    });


    const fading = new WeakMap<THREE.Object3D, { running: boolean; direction: "in" | "out" }>();
    const fade = (direction: "in" | "out", model: THREE.Object3D, step = 0.05) => {
      if (!mountRef.current || !model) return;

      const state = fading.get(model);

      if (state && state.running && state.direction !== direction) {
        state.running = false;
      }

      fading.set(model, { running: true, direction });

      const start = () => {
        const currentState = fading.get(model);
        if (!currentState || !currentState.running) return;

        let valid = true;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

            materials.forEach((m) => {
              const mat = m as THREE.MeshStandardMaterial & { opacity?: number; transparent?: boolean };

              if (mat.opacity === undefined) mat.opacity = 1;

              if (direction === "in") mat.opacity = Math.min(1, mat.opacity + step);
              else mat.opacity = Math.max(0, mat.opacity - step);

              if ((direction === "in" && mat.opacity < 1) || (direction === "out" && mat.opacity > 0)) valid = false;

              mat.transparent = mat.opacity < 1;
              mat.needsUpdate = true;
            });
          }
          else if ((child as THREE.LineSegments).isLineSegments) {
            const line = child as THREE.LineSegments;
            const mat = line.material as any;

            if (mat.opacity === undefined) mat.opacity = 1;

            if (direction === "in") mat.opacity = Math.min(1, mat.opacity + step);
            else mat.opacity = Math.max(0, mat.opacity - step);

            if ((direction === "in" && mat.opacity < 1) || (direction === "out" && mat.opacity > 0)) valid = false;

            mat.transparent = mat.opacity < 1;
          }
        });

        if (!valid) requestAnimationFrame(start);
        else fading.set(model, { running: false, direction });
      }

      start();
    }

    const bigSpheres : THREE.Mesh[] = [];
    const bigSphereInfos: {
      mesh: THREE.Mesh;
      radius: number;
      orbitSpeed: number;
      orbitRadius: number;
      theta: number;
    }[] = [];

    const maxSpheres = 5;
    const minD = 50;
    const maxD = 75;
    const minS = 2;
    const maxS = 7;
    const fixedY = 0;
    const spehreDistance = 10;

    const occupiedPositions: THREE.Vector3[] = [];

    for (let i = 0; i <maxSpheres; i++) {
      let orbitRadius = 0;
      let theta = 0;
      let x = 0, z = 0;
      let valid = false;

      while (!valid) {
        orbitRadius = minD + Math.random() * (maxD - minD);
        theta = Math.random() * 2 * Math.PI;
        x = orbitRadius * Math.cos(theta);
        z = orbitRadius * Math.sin(theta);

        valid = occupiedPositions.every((pos) => {
          return pos.distanceTo(new THREE.Vector3(x, fixedY, z)) >= spehreDistance;
        });
      }

      occupiedPositions.push(new THREE.Vector3(x, fixedY, z));

      const y = fixedY;
      const radius = minS + Math.random() * (maxS - minS);

      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        roughness: 0.5,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(x, y, z);
      scene.add(mesh)

      const orbitSpeed = (0.00075 + Math.random() * 0.0001) * (Math.random() < 0.5 ? 1 : -1);

      bigSpheres.push(mesh);
      bigSphereInfos.push({ mesh, radius, orbitSpeed, orbitRadius, theta });
    }

    const planeWidth = 0.1;
    const palneHeight = 20;
    const planeDepth = 20;

    const planeGeometry = new THREE.BoxGeometry(planeWidth, palneHeight, planeDepth);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const centralPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    centralPlane.position.set(0, 0, 0);
    centralPlane.visible = false;
    scene.add(centralPlane);

    const leftSpheres: THREE.Mesh[] = [];
    const leftSphereInfos: {
      position: THREE.Vector3;
      radius: number;
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
    }[] = [];

    const rightSpheres: THREE.Mesh[] = [];
    const rightSphereInfos: {
      position: THREE.Vector3;
      radius: number;
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
    }[] = [];

    const brainLeftCenter = new THREE.Vector3(-3, 1, 0);
    const brainRightCenter = new THREE.Vector3(3, 1, 0);

    const numSpheres = 10;
    const maxDistance = 0.8;

    const createSpheresAroundCenter = (
      center: THREE.Vector3,
      spheres: THREE.Mesh[],
      sphereInfos: typeof leftSphereInfos,
    ) => {
      for (let i = 0; i < numSpheres; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * maxDistance;

        const x = r * Math.sin(phi) * Math.cos(theta) + center.x;
        const y = r * Math.sin(phi) * Math.sin(theta) + center.y;
        const z = r * Math.cos(phi) + center.z;

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

        const sprite = createTextSprite(`S${i}`, 64, "#000000");
        sprite.position.set(0, -(sphereRadius + 0.03), 0); // 살짝 아래에 위치

        mesh.add(sprite);
        scene.add(mesh);
        
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.0002,
          (Math.random() - 0.5) * 0.0002,
          (Math.random() - 0.5) * 0.0002,
        )
        
        spheres.push(mesh);
        sphereInfos.push({ position: new THREE.Vector3(x, y, z), radius: sphereRadius, mesh, velocity });
      }
    }

    createSpheresAroundCenter(brainLeftCenter, leftSpheres, leftSphereInfos);
    createSpheresAroundCenter(brainRightCenter, rightSpheres, rightSphereInfos);

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
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
      });
      const lines = new THREE.LineSegments(geometry, material);
      scene.add(lines);

      return lines;
    }

    let selectedSphere: THREE.Mesh | null = null;
    let followSphere = false;

    const defaultTarget = new THREE.Vector3(0, 0, 0);
    const leftTarget = new THREE.Vector3(-3, 1, 0);  // 왼쪽으로 살짝 이동
    const rightTarget = new THREE.Vector3(3, 1, 0);  // 오른쪽으로 살짝 이동

    let goalTarget = defaultTarget.clone();
    let goalLocked = false;

    let showingNeuron = false;

    const handleZoom = () => {
      if (!mountRef.current) return;

      const angle = controls.getAzimuthalAngle();
      const distance = camera.position.distanceTo(controls.target);
      console.log(distance);
      
      if (distance < 3) {
        targetBackground.set(0xffffff);
        fade("out", brainModel!, 0.05);

        showingNeuron = true;
        centralPlane.visible = true;
        bigSpheres.forEach((s) => {
          s.visible = false;
        });
      }
      else if (distance < 10) {
        if (!goalLocked) {
          goalTarget = angle < 0 ? leftTarget.clone() : rightTarget.clone();
          goalLocked = true;
        }

        showingNeuron = false;
        centralPlane.visible = false;
        targetBackground.set(0x000000)
        bigSpheres.forEach((s) => {
          s.visible = true;
        });

        fade("in", brainModel!, 0.01);
      }
      else if (distance < 150) {
        goalTarget = defaultTarget.clone();
        goalLocked = false;

        fade("in", brainModel!, 0.01);
        fade("out", humanModel!, 0.05);
      }
      else {
        fade("out", brainModel!, 0.01);
        fade("in", humanModel!, 0.05);
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

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let initialCameraPos = camera.position.clone();
    let initialTarget = controls.target.clone();

    const handleClick = (event: MouseEvent) => {
      if (!mountRef.current) return;
      else if (selectedSphere && followSphere) return;

      initialCameraPos = camera.position.clone();
      initialTarget = goalTarget.clone();

      const rect = mountRef.current.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const clickableSpheres = [...leftSpheres, ...rightSpheres, ...bigSpheres];
      const intersects = raycaster.intersectObjects(clickableSpheres);

      if (intersects.length > 0) {
        const clicked = intersects[0].object as THREE.Mesh;
        console.log("Clicked Sphere: ", clicked);

        const geometry = clicked.geometry as THREE.SphereGeometry;

        const radius = geometry.parameters.radius;
        if (radius < 1 && !showingNeuron) return;

        selectedSphere = clicked;
        goalLocked = true;
        followSphere = true;

        controls.removeEventListener("change", handleZoom);

        const targetPos = clicked.position.clone();

        const sg = selectedSphere.geometry as THREE.SphereGeometry;
        const sphereRadius = sg.parameters.radius;

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        const zoomDistance = sphereRadius * 3;
        const zoomTarget = targetPos.clone().add(cameraDir.clone().multiplyScalar(-zoomDistance));

        let zoomProgress = 0;
        const zoomIn = () => {
          zoomProgress += 0.02;
          camera.position.lerp(zoomTarget, 0.05);

          if (zoomProgress < 1) {
            requestAnimationFrame(zoomIn);
          }
          else {
            goalTarget.copy(targetPos);
            window.addEventListener("keydown", handleKeyDown);
          }
        }

        zoomIn();
      }
    }
    window.addEventListener("click", handleClick);

    const resetCamera = () => {
      let resetProgress = 0;

      const currentPos = camera.position.clone();
      const currentTarget = controls.target.clone();
      
      const zoomOut = () => {
        resetProgress += 0.02;

        camera.position.lerpVectors(currentPos, initialCameraPos, resetProgress);
        controls.target.lerpVectors(currentTarget, initialTarget, resetProgress);
        controls.update();

        if (resetProgress < 1) requestAnimationFrame(zoomOut);
        else {
          selectedSphere = null;
          followSphere = false;
          goalTarget = initialTarget.clone();
          
          camera.position.copy(initialCameraPos);
          controls.target.copy(initialTarget);
          controls.update();

          controls.addEventListener("change", handleZoom);
        }
      };
      
      zoomOut();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetCamera();
        window.removeEventListener("keydown", handleKeyDown);
      }
    };

    let leftLines: THREE.LineSegments | null = null;
    let rightLines: THREE.LineSegments | null = null;

    let currentBackground = new THREE.Color(0x000000);
    let targetBackground = new THREE.Color(0x000000);

    const animate = () => {
      requestAnimationFrame(animate);

      if (followSphere && selectedSphere) {
        const targetPos = selectedSphere.position.clone();
        goalTarget.lerp(targetPos, 0.1);
      }
      else {
        bigSphereInfos.forEach((info) => {
          info.theta += info.orbitSpeed;
          info.mesh.position.x = info.orbitRadius * Math.cos(info.theta);
          info.mesh.position.y = fixedY;
          info.mesh.position.z = info.orbitRadius * Math.sin(info.theta);
        });
  
        leftSphereInfos.forEach((info) => {
          info.position.add(info.velocity);
          info.mesh.position.copy(info.position);
  
          if (info.position.distanceTo(brainLeftCenter) > maxDistance) {
            info.position.sub(brainLeftCenter).normalize().multiplyScalar(maxDistance).add(brainLeftCenter);
            info.velocity.reflect(info.position.clone().sub(brainLeftCenter).normalize());
          }
        });
  
        rightSphereInfos.forEach((info) => {
          info.position.add(info.velocity);
          info.mesh.position.copy(info.position);
  
          if (info.position.distanceTo(brainRightCenter) > maxDistance) {
            info.position.sub(brainRightCenter).normalize().multiplyScalar(maxDistance).add(brainRightCenter);
            info.velocity.reflect(info.position.clone().sub(brainRightCenter).normalize());
          }
        });
  
        if (leftLines) {
          scene.remove(leftLines);
          (leftLines as THREE.LineSegments).geometry.dispose();
          ((leftLines as THREE.LineSegments).material as THREE.Material).dispose();
        }
        leftLines = connectSpheres(leftSpheres);
  
        if (rightLines) {
          scene.remove(rightLines);
          (rightLines as THREE.LineSegments).geometry.dispose();
          ((rightLines as THREE.LineSegments).material as THREE.Material).dispose();
        }
        rightLines = connectSpheres(rightSpheres);
      }

      controls.target.lerp(goalTarget, 0.05);
      controls.update();

      currentBackground.lerp(targetBackground, 0.075);
      scene.background = currentBackground.clone();

      controls.update();
      composer.render();
    };
    animate();

    return () => {
      window.removeEventListener("reszie", handleResize);
      window.removeEventListener("click", handleClick);
      controls.removeEventListener("change", handleZoom)
      controls.dispose();
      renderer.dispose();
      mountRef.current!.innerHTML = "";
      selectedSphere = null;
      followSphere = false;
    };
  }, []);

  return (
    <div ref={mountRef} className="full"></div>
  );
}

export default Home;