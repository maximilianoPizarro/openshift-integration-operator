# 3D Onboarding Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive 3D scene using Three.js to visually explain the OpenShift Integration Operator architecture for the GitHub Pages documentation.

**Architecture:** A pure HTML/JS/CSS implementation using Three.js for the 3D canvas and standard DOM elements for the UI overlay (glassmorphism panels). GSAP will be used for smooth camera animations.

**Tech Stack:** HTML5, CSS3, JavaScript (ES6+), Three.js, GSAP.

---

### Task 1: Setup Project Structure and Assets

**Files:**
- Create: `docs/3d-onboarding.html`
- Create: `docs/assets/css/3d-style.css`
- Create: `docs/assets/js/3d-app.js`
- Create: `docs/assets/images/logos/openshift.png` (Placeholder)
- Create: `docs/assets/images/logos/camel.png` (Placeholder)
- Create: `docs/assets/images/logos/sonataflow.png` (Placeholder)
- Create: `docs/assets/images/logos/kafka.png` (Placeholder)

- [ ] **Step 1: Create the HTML skeleton**

```html
<!-- docs/3d-onboarding.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenShift Integration Operator - 3D Overview</title>
    <link rel="stylesheet" href="assets/css/3d-style.css">
    <!-- Import Three.js and GSAP from CDN for GitHub Pages compatibility -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>
    <div id="canvas-container"></div>
    
    <!-- UI Overlay -->
    <div id="ui-layer">
        <button id="fullscreen-btn">Fullscreen</button>
        
        <div id="info-panel" class="hidden">
            <h2 id="panel-title">Node Title</h2>
            <p id="panel-desc">Node description goes here.</p>
            <pre><code id="panel-code">yaml snippet</code></pre>
            <button id="close-panel-btn">Back to Overview</button>
        </div>
    </div>

    <script src="assets/js/3d-app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create basic CSS styling**

```css
/* docs/assets/css/3d-style.css */
body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #050510;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: white;
}

#canvas-container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
}

#ui-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    pointer-events: none; /* Let clicks pass through to canvas by default */
}

#fullscreen-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 5px;
    cursor: pointer;
    pointer-events: auto;
    backdrop-filter: blur(5px);
}

#info-panel {
    position: absolute;
    top: 50%;
    right: 40px;
    transform: translateY(-50%);
    width: 350px;
    background: rgba(10, 15, 30, 0.7);
    border: 1px solid rgba(100, 150, 255, 0.3);
    border-radius: 10px;
    padding: 25px;
    backdrop-filter: blur(10px);
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

#info-panel.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%) translateX(20px);
}

#info-panel h2 { margin-top: 0; color: #6495ED; }
#info-panel pre { background: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 0.8em; }
#close-panel-btn {
    margin-top: 15px;
    padding: 8px 15px;
    background: #6495ED;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
}
```

- [ ] **Step 3: Create placeholder logo images**
Run the following commands to create dummy images so the textures don't fail to load.

```bash
mkdir -p docs/assets/images/logos
convert -size 256x256 xc:red docs/assets/images/logos/openshift.png || echo "Please download real openshift.png later"
convert -size 256x256 xc:orange docs/assets/images/logos/camel.png || echo "Please download real camel.png later"
convert -size 256x256 xc:blue docs/assets/images/logos/sonataflow.png || echo "Please download real sonataflow.png later"
convert -size 256x256 xc:green docs/assets/images/logos/kafka.png || echo "Please download real kafka.png later"
```

### Task 2: Initialize Three.js Scene and Camera

**Files:**
- Modify: `docs/assets/js/3d-app.js`

- [ ] **Step 1: Setup Scene, Camera, Renderer, and Controls**

```javascript
// docs/assets/js/3d-app.js
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050510, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 100;
controls.minDistance = 10;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
```

- [ ] **Step 2: Add Fullscreen Logic**

```javascript
// Append to docs/assets/js/3d-app.js
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message}`);
        });
        fullscreenBtn.innerText = "Exit Fullscreen";
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerText = "Fullscreen";
    }
});
```

### Task 3: Build the 3D Nodes (Middlewares)

**Files:**
- Modify: `docs/assets/js/3d-app.js`

- [ ] **Step 1: Define Node Data Structure**

```javascript
// Append to docs/assets/js/3d-app.js
const nodeData = [
    { id: 'openshift', name: 'OpenShift', desc: 'The foundational Kubernetes platform.', code: 'kind: Cluster\napiVersion: config.openshift.io/v1', pos: {x: 0, y: 0, z: 0}, logo: 'assets/images/logos/openshift.png', color: 0xee0000 },
    { id: 'camel', name: 'Apache Camel', desc: 'Integration framework for routing and transforming data.', code: 'apiVersion: camel.apache.org/v1\nkind: Integration\nmetadata:\n  name: my-route', pos: {x: -15, y: 5, z: -10}, logo: 'assets/images/logos/camel.png', color: 0xff9900 },
    { id: 'sonataflow', name: 'SonataFlow', desc: 'Serverless workflow execution.', code: 'apiVersion: sonataflow.org/v1alpha08\nkind: SonataFlow\nmetadata:\n  name: my-workflow', pos: {x: 15, y: 5, z: -10}, logo: 'assets/images/logos/sonataflow.png', color: 0x0088ff },
    { id: 'kafka', name: 'AMQ Streams (Kafka)', desc: 'Distributed event streaming platform.', code: 'apiVersion: kafka.strimzi.io/v1beta2\nkind: Kafka\nmetadata:\n  name: my-cluster', pos: {x: 0, y: 10, z: -20}, logo: 'assets/images/logos/kafka.png', color: 0x00ff00 }
];

const nodes = []; // Store meshes for raycasting
const textureLoader = new THREE.TextureLoader();
```

- [ ] **Step 2: Create Node Meshes (Pedestal + Glass Cube + Logo)**

```javascript
// Append to docs/assets/js/3d-app.js
function createNode(data) {
    const group = new THREE.Group();
    group.position.set(data.pos.x, data.pos.y, data.pos.z);
    group.userData = data; // Store data for click events

    // Pedestal
    const pedGeo = new THREE.CylinderGeometry(3, 3.5, 1, 32);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.8, metalness: 0.2 });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -0.5;
    group.add(pedestal);

    // Glass Cube
    const cubeGeo = new THREE.BoxGeometry(4, 4, 4);
    const cubeMat = new THREE.MeshPhysicalMaterial({
        color: data.color,
        transmission: 0.9, // glass effect
        opacity: 1,
        metalness: 0,
        roughness: 0.1,
        ior: 1.5,
        thickness: 0.5,
        transparent: true
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.y = 2;
    group.add(cube);
    
    // Logo Plane inside cube
    textureLoader.load(data.logo, (texture) => {
        const planeGeo = new THREE.PlaneGeometry(3, 3);
        const planeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.y = 2;
        // Make logo always face camera (billboard)
        plane.onBeforeRender = function(renderer, scene, camera) {
            this.quaternion.copy(camera.quaternion);
        };
        group.add(plane);
    });

    scene.add(group);
    nodes.push(cube); // Add cube to interactable objects
    cube.userData = group.userData; // Pass data up to the mesh we will raycast against
}

nodeData.forEach(data => createNode(data));
```

### Task 4: Add Connections and Particles

**Files:**
- Modify: `docs/assets/js/3d-app.js`

- [ ] **Step 1: Draw lines between nodes**

```javascript
// Append to docs/assets/js/3d-app.js
const connections = [
    ['openshift', 'camel'],
    ['openshift', 'sonataflow'],
    ['openshift', 'kafka'],
    ['camel', 'kafka'],
    ['sonataflow', 'kafka']
];

const lineMaterial = new THREE.LineBasicMaterial({ color: 0x445588, transparent: true, opacity: 0.5 });

connections.forEach(conn => {
    const startNode = nodeData.find(n => n.id === conn[0]);
    const endNode = nodeData.find(n => n.id === conn[1]);
    
    if(startNode && endNode) {
        const points = [];
        // Connect from center of pedestal
        points.push(new THREE.Vector3(startNode.pos.x, startNode.pos.y, startNode.pos.z));
        points.push(new THREE.Vector3(endNode.pos.x, endNode.pos.y, endNode.pos.z));
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        scene.add(line);
    }
});
```

- [ ] **Step 2: Add Particle System for Data Flow**

```javascript
// Append to docs/assets/js/3d-app.js
const particles = [];
const particleGeo = new THREE.SphereGeometry(0.3, 8, 8);
const particleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

function spawnParticle(startPos, endPos) {
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.copy(startPos);
    scene.add(particle);
    
    // Animate particle from start to end
    gsap.to(particle.position, {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: 2 + Math.random() * 2,
        ease: "none",
        onComplete: () => {
            scene.remove(particle);
            particles.splice(particles.indexOf(particle), 1);
        }
    });
    particles.push(particle);
}

// Spawn particles continuously
setInterval(() => {
    const conn = connections[Math.floor(Math.random() * connections.length)];
    const startNode = nodeData.find(n => n.id === conn[0]);
    const endNode = nodeData.find(n => n.id === conn[1]);
    if(startNode && endNode) {
        spawnParticle(
            new THREE.Vector3(startNode.pos.x, startNode.pos.y, startNode.pos.z),
            new THREE.Vector3(endNode.pos.x, endNode.pos.y, endNode.pos.z)
        );
    }
}, 500);
```

### Task 5: Interactivity (Raycasting and UI)

**Files:**
- Modify: `docs/assets/js/3d-app.js`

- [ ] **Step 1: Setup Raycaster for Hover Effects**

```javascript
// Append to docs/assets/js/3d-app.js
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;
let isAutoRotating = true;

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);
    
    if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
        if (hoveredNode !== intersects[0].object) {
            if (hoveredNode) hoveredNode.material.emissive.setHex(0x000000);
            hoveredNode = intersects[0].object;
            hoveredNode.material.emissive.setHex(hoveredNode.userData.color);
            hoveredNode.material.emissiveIntensity = 0.5;
            isAutoRotating = false;
        }
    } else {
        document.body.style.cursor = 'default';
        if (hoveredNode) {
            hoveredNode.material.emissive.setHex(0x000000);
            hoveredNode = null;
            isAutoRotating = true;
        }
    }
});

// Update animate function to include auto-rotation
const originalAnimate = animate;
animate = function() {
    if(isAutoRotating) {
        scene.rotation.y += 0.001;
    }
    originalAnimate();
}
```

- [ ] **Step 2: Handle Click Events and Camera Animation**

```javascript
// Append to docs/assets/js/3d-app.js
const infoPanel = document.getElementById('info-panel');
const panelTitle = document.getElementById('panel-title');
const panelDesc = document.getElementById('panel-desc');
const panelCode = document.getElementById('panel-code');
const closeBtn = document.getElementById('close-panel-btn');

let originalCameraPos = new THREE.Vector3();
let originalTarget = new THREE.Vector3();

window.addEventListener('click', () => {
    if (hoveredNode) {
        const data = hoveredNode.userData;
        
        // Populate UI
        panelTitle.innerText = data.name;
        panelDesc.innerText = data.desc;
        panelCode.innerText = data.code;
        
        // Show Panel
        infoPanel.classList.remove('hidden');
        
        // Save current camera state if not already focused
        if(infoPanel.classList.contains('hidden')) {
            originalCameraPos.copy(camera.position);
            originalTarget.copy(controls.target);
        }

        // Calculate new camera position (offset from node)
        // Adjust for scene rotation
        const worldPos = new THREE.Vector3();
        hoveredNode.getWorldPosition(worldPos);
        
        const offset = new THREE.Vector3(0, 5, 15);
        offset.applyEuler(scene.quaternion);
        const targetCamPos = worldPos.clone().add(offset);

        // Animate Camera
        gsap.to(camera.position, {
            x: targetCamPos.x,
            y: targetCamPos.y,
            z: targetCamPos.z,
            duration: 1.5,
            ease: "power2.inOut"
        });
        
        gsap.to(controls.target, {
            x: worldPos.x,
            y: worldPos.y,
            z: worldPos.z,
            duration: 1.5,
            ease: "power2.inOut"
        });
        
        isAutoRotating = false;
    }
});

closeBtn.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
    isAutoRotating = true;
    
    // Reset Camera
    gsap.to(camera.position, {
        x: 0, y: 20, z: 40, // Default pos
        duration: 1.5,
        ease: "power2.inOut"
    });
    
    gsap.to(controls.target, {
        x: 0, y: 0, z: 0,
        duration: 1.5,
        ease: "power2.inOut"
    });
});
```