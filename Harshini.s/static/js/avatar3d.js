/**
 * 3D Holographic AI Avatar Companion (Three.js)
 * Supports dynamic state transitions: IDLE, LISTENING, THINKING, SPEAKING
 * Tracks mouse cursor and enables interactive 3D orbit rotation.
 */

class Avatar3DCompanion {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 3D Objects
    this.coreMesh = null;
    this.wireMesh = null;
    this.outerRing1 = null;
    this.outerRing2 = null;
    this.outerRing3 = null;
    this.particles = null;

    // States: 'IDLE', 'LISTENING', 'THINKING', 'SPEAKING'
    this.state = 'IDLE';

    // Mouse tracking & interaction
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 340;
    const height = this.container.clientHeight || 220;

    // 1. Scene setup
    this.scene = new THREE.Scene();

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 4.2;

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x0a1020, 2);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f2fe, 3, 20);
    pointLight.position.set(0, 0, 2);
    this.scene.add(pointLight);

    const purpleLight = new THREE.PointLight(0x7928ca, 3, 20);
    purpleLight.position.set(-2, -2, -1);
    this.scene.add(purpleLight);

    // 5. Construct 3D Robotic / Holographic AI Core
    this.createCore();
    this.createGyroscopicRings();
    this.createParticleCloud();

    // 6. Bind Events
    this.bindEvents();

    // 7. Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  createCore() {
    // Inner glowing sphere
    const coreGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x005577,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(this.coreMesh);

    // Geometric Wireframe Facet Shell (Icosahedron)
    const wireGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x4facfe,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    this.wireMesh = new THREE.Mesh(wireGeo, wireMat);
    this.scene.add(this.wireMesh);
  }

  createGyroscopicRings() {
    // Ring 1 (Horizontal tilt)
    const ringGeo1 = new THREE.TorusGeometry(1.2, 0.02, 16, 100);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    this.outerRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.outerRing1.rotation.x = Math.PI / 3;
    this.scene.add(this.outerRing1);

    // Ring 2 (Vertical tilt)
    const ringGeo2 = new THREE.TorusGeometry(1.35, 0.02, 16, 100);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x7928ca,
      emissive: 0x7928ca,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    this.outerRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.outerRing2.rotation.y = Math.PI / 4;
    this.scene.add(this.outerRing2);

    // Ring 3 (Outer gyro)
    const ringGeo3 = new THREE.TorusGeometry(1.5, 0.015, 16, 100);
    const ringMat3 = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00f5d4,
      emissiveIntensity: 0.5
    });
    this.outerRing3 = new THREE.Mesh(ringGeo3, ringMat3);
    this.outerRing3.rotation.z = Math.PI / 6;
    this.scene.add(this.outerRing3);
  }

  createParticleCloud() {
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const c1 = new THREE.Color(0x00f2fe);
    const c2 = new THREE.Color(0x7928ca);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Distribute in a spherical shell
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.3 + Math.random() * 0.8;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const mixed = c1.clone().lerp(c2, Math.random());
      colors[i] = mixed.r;
      colors[i + 1] = mixed.g;
      colors[i + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  setState(newState) {
    this.state = newState;
    const tag = document.getElementById('avatarStateTag');
    if (tag) {
      tag.textContent = `State: ${newState}`;
      tag.className = 'avatar-state-tag ' + newState.toLowerCase();
    }

    if (!this.coreMesh) return;

    if (newState === 'LISTENING') {
      this.coreMesh.material.color.setHex(0x00f5d4);
      this.coreMesh.material.emissive.setHex(0x008877);
    } else if (newState === 'THINKING') {
      this.coreMesh.material.color.setHex(0x7928ca);
      this.coreMesh.material.emissive.setHex(0x551188);
    } else if (newState === 'SPEAKING') {
      this.coreMesh.material.color.setHex(0x00f2fe);
      this.coreMesh.material.emissive.setHex(0x0088cc);
    } else {
      // IDLE
      this.coreMesh.material.color.setHex(0x00f2fe);
      this.coreMesh.material.emissive.setHex(0x005577);
    }
  }

  bindEvents() {
    // Mouse gaze tracking
    window.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / (rect.width || 1) - 0.5;
      const y = (e.clientY - rect.top) / (rect.height || 1) - 0.5;
      this.mouse.targetX = x * 1.5;
      this.mouse.targetY = y * 1.5;
    });

    // Drag to rotate
    this.container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      if (this.coreMesh) {
        this.coreMesh.rotation.y += deltaX * 0.01;
        this.coreMesh.rotation.x += deltaY * 0.01;
      }
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    resizeObserver.observe(this.container);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Smooth mouse gaze tracking
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    // Levitation motion
    const floatOffset = Math.sin(time * 1.8) * 0.08;

    // Rotation speeds dependent on state
    let speedMult = 1.0;
    let pulseScale = 1.0;

    if (this.state === 'LISTENING') {
      speedMult = 1.6;
      pulseScale = 1.0 + Math.sin(time * 6) * 0.06;
    } else if (this.state === 'THINKING') {
      speedMult = 3.5;
      pulseScale = 1.0 + Math.sin(time * 12) * 0.1;
    } else if (this.state === 'SPEAKING') {
      speedMult = 2.0;
      pulseScale = 1.0 + Math.abs(Math.sin(time * 8)) * 0.15;
    } else {
      // IDLE
      speedMult = 0.8;
      pulseScale = 1.0 + Math.sin(time * 1.5) * 0.03;
    }

    // Apply updates to 3D components
    if (this.coreMesh) {
      this.coreMesh.position.y = floatOffset;
      this.coreMesh.scale.set(pulseScale, pulseScale, pulseScale);
      this.coreMesh.rotation.y += delta * 0.4 * speedMult;
      this.coreMesh.rotation.x = this.mouse.y * 0.4;
    }

    if (this.wireMesh) {
      this.wireMesh.position.y = floatOffset;
      this.wireMesh.rotation.y -= delta * 0.6 * speedMult;
      this.wireMesh.rotation.z += delta * 0.3 * speedMult;
      this.wireMesh.scale.set(pulseScale, pulseScale, pulseScale);
    }

    if (this.outerRing1) {
      this.outerRing1.position.y = floatOffset;
      this.outerRing1.rotation.z += delta * 0.8 * speedMult;
      this.outerRing1.rotation.x += delta * 0.2 * speedMult;
    }

    if (this.outerRing2) {
      this.outerRing2.position.y = floatOffset;
      this.outerRing2.rotation.x -= delta * 0.9 * speedMult;
      this.outerRing2.rotation.y += delta * 0.3 * speedMult;
    }

    if (this.outerRing3) {
      this.outerRing3.position.y = floatOffset;
      this.outerRing3.rotation.y += delta * 0.5 * speedMult;
      this.outerRing3.rotation.z -= delta * 0.4 * speedMult;
    }

    if (this.particles) {
      this.particles.position.y = floatOffset;
      this.particles.rotation.y += delta * 0.2 * speedMult;
    }

    // Camera subtle gaze tilt
    this.camera.position.x = this.mouse.x * 0.5;
    this.camera.position.y = -this.mouse.y * 0.5;
    this.camera.lookAt(0, floatOffset, 0);

    this.renderer.render(this.scene, this.camera);
  }
}

// Global hook
window.Avatar3DCompanion = Avatar3DCompanion;
