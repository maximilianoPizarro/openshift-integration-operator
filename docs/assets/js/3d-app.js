// docs/assets/js/3d-app.js
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

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

    // Nodes Data
    const nodeData = [
        { id: 'openshift', name: 'OpenShift', desc: 'The foundational Kubernetes platform.', code: 'kind: Cluster\napiVersion: config.openshift.io/v1', pos: {x: 0, y: 0, z: 0}, logo: 'assets/images/logos/openshift.png', color: 0xee0000 },
        { id: 'camel', name: 'Apache Camel', desc: 'Integration framework for routing and transforming data.', code: 'apiVersion: camel.apache.org/v1\nkind: Integration\nmetadata:\n  name: my-route', pos: {x: -15, y: 5, z: -10}, logo: 'assets/images/logos/camel.png', color: 0xff9900 },
        { id: 'sonataflow', name: 'SonataFlow', desc: 'Serverless workflow execution.', code: 'apiVersion: sonataflow.org/v1alpha08\nkind: SonataFlow\nmetadata:\n  name: my-workflow', pos: {x: 15, y: 5, z: -10}, logo: 'assets/images/logos/sonataflow.png', color: 0x0088ff },
        { id: 'kafka', name: 'AMQ Streams (Kafka)', desc: 'Distributed event streaming platform.', code: 'apiVersion: kafka.strimzi.io/v1beta2\nkind: Kafka\nmetadata:\n  name: my-cluster', pos: {x: 0, y: 10, z: -20}, logo: 'assets/images/logos/kafka.png', color: 0x00ff00 }
    ];

    const nodes = []; // Store meshes for raycasting
    const textureLoader = new THREE.TextureLoader();

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

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
                fullscreenBtn.innerText = "Exit Fullscreen";
            } else {
                document.exitFullscreen();
                fullscreenBtn.innerText = "Fullscreen";
            }
        });
    }
});
