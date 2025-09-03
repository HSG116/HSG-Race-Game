// =================================================================================
// 1. استيراد المكتبات الأساسية
// =================================================================================
// نستورد مكتبة Three.js لإنشاء عالم ثلاثي الأبعاد
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
// نستورد مكتبة Multisynq لمزامنة اللاعبين عبر الإنترنت
import Multisynq from 'https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.esm.js';

// =================================================================================
// 2. الأصناف الخاصة بالمحاكاة (Game Logic - تعمل على السيرفر والعميل)
// =================================================================================

/**
 * يمثل سيارة واحدة في عالم اللعبة. يحتوي على حالتها (الموقع، الدوران، اللون) ومنطق حركتها.
 * @extends {Multisynq.Observed}
 */
class SimCar extends Multisynq.Observed {
    constructor() {
        super();
        // حالة السيارة التي ستتم مزامنتها
        this.position = { x: (Math.random() - 0.5) * 20, y: 0.4, z: (Math.random() - 0.5) * 20 };
        this.rotation = { y: 0 };
        this.color = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
        // مدخلات التحكم (لا تتم مزامنتها، كل لاعب يتحكم بسيارته فقط)
        this.inputs = { fwd: false, bwd: false, left: false, right: false };
    }

    // يتم استدعاؤها من العميل لتحديث حالة المدخلات
    setInputs(inputs) {
        this.inputs = inputs;
    }

    // يتم استدعاؤها كل إطار (frame) بواسطة المحاكي لتحديث فيزياء السيارة
    update(deltaTime) {
        const moveSpeed = 5.0; // متر في الثانية
        const turnSpeed = 2.5; // راديان في الثانية

        if (this.inputs.left) this.rotation.y += turnSpeed * deltaTime;
        if (this.inputs.right) this.rotation.y -= turnSpeed * deltaTime;

        const direction = this.inputs.fwd ? 1 : (this.inputs.bwd ? -1 : 0);
        if (direction !== 0) {
            this.position.x += Math.sin(this.rotation.y) * moveSpeed * direction * deltaTime;
            this.position.z += Math.cos(this.rotation.y) * moveSpeed * direction * deltaTime;
        }
    }
}

/**
 * يمثل عالم اللعبة بأكمله. يحتوي على جميع اللاعبين وسياراتهم.
 * @extends {Multisynq.Observed}
 */
class SharedSimulation extends Multisynq.Observed {
    constructor() {
        super();
        this.players = {}; // قاموس لتخزين بيانات كل لاعب
    }

    // يتم استدعاؤها تلقائيًا عند انضمام لاعب جديد
    addPlayer(player) {
        console.log(`Player ${player.id} joined.`);
        this.players[player.id] = {
            car: new SimCar()
        };
    }

    // يتم استدعاؤها تلقائيًا عند مغادرة لاعب
    removePlayer(player) {
        console.log(`Player ${player.id} left.`);
        delete this.players[player.id];
    }
    
    // يتم استدعاؤها كل إطار لتحديث كل الكائنات في عالم اللعبة
    update(deltaTime) {
        for (const playerId in this.players) {
            this.players[playerId].car.update(deltaTime);
        }
    }
}


// =================================================================================
// 3. واجهة العرض (View - تعمل على العميل فقط)
// =================================================================================

/**
 * هذا الصنف مسؤول عن كل ما يتعلق بالرسوميات (Three.js) والتحكم.
 * يعرض الحالة التي تصله من الـ `SharedSimulation`.
 */
class SimInterface {
    constructor(sim) {
        this.sim = sim; // نسخة من المحاكاة المتزامنة
        this.carMeshes = new Map(); // لتخزين نماذج السيارات ثلاثية الأبعاد
        this.clock = new THREE.Clock(); // ساعة لقياس الوقت بين الإطارات

        this.initScene();
        this.initScenery();
        this.initControls();
    }

    // إعداد المشهد الأساسي والكاميرا والإضاءة
    initScene() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87ceeb); // Sky blue
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Ground & Road
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const roadGeo = new THREE.PlaneGeometry(10, 200);
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01; // Slightly above ground
        road.receiveShadow = true;
        this.scene.add(road);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, false);
    }
    
    // إضافة عناصر تجميلية للمشهد (أشجار، جبال، سحاب)
    initScenery() {
        // Trees
        for (let i = 0; i < 50; i++) {
            const tree = this.createTree();
            tree.position.set(
                (Math.random() - 0.5) * 180,
                0,
                (Math.random() - 0.5) * 180
            );
            if (Math.abs(tree.position.x) < 10) tree.position.x += 20 * Math.sign(tree.position.x);
            this.scene.add(tree);
        }

        // Mountains
        for (let i = 0; i < 15; i++) {
            const mountain = this.createMountain();
            mountain.position.set(
                (Math.random() - 0.5) * 200,
                0,
                (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 20)
            );
            this.scene.add(mountain);
        }

        // Clouds
        for (let i = 0; i < 20; i++) {
            const cloud = this.createCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 200,
                20 + Math.random() * 10,
                (Math.random() - 0.5) * 200
            );
            this.scene.add(cloud);
        }
    }
    
    // ربط أزرار التحكم (لوحة المفاتيح واللمس)
    initControls() {
        this.inputs = { fwd: false, bwd: false, left: false, right: false };

        const keyMap = {
            'w': 'fwd', 'ArrowUp': 'fwd',
            's': 'bwd', 'ArrowDown': 'bwd',
            'a': 'left', 'ArrowLeft': 'left',
            'd': 'right', 'ArrowRight': 'right'
        };

        const setKey = (key, state) => {
            if (keyMap[key] !== undefined) {
                this.inputs[keyMap[key]] = state;
            }
        };

        document.addEventListener('keydown', e => setKey(e.key, true));
        document.addEventListener('keyup', e => setKey(e.key, false));
        
        const setupButton = (id, key) => {
            const button = document.getElementById(id);
            const setInput = (state) => this.inputs[key] = state;
            button.addEventListener('mousedown', () => setInput(true));
            button.addEventListener('mouseup', () => setInput(false));
            button.addEventListener('mouseleave', () => setInput(false));
            button.addEventListener('touchstart', (e) => { e.preventDefault(); setInput(true); });
            button.addEventListener('touchend', (e) => { e.preventDefault(); setInput(false); });
        };
        
        setupButton('btn-fwd', 'fwd');
        setupButton('btn-bwd', 'bwd');
        setupButton('btn-left', 'left');
        setupButton('btn-right', 'right');
    }

    // --- دوال مساعدة لإنشاء النماذج ثلاثية الأبعاد ---
    
    createCarMesh(color) {
        const car = new THREE.Group();
    
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const bodyGeo = new THREE.BoxGeometry(1, 0.4, 2);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        car.add(body);
    
        const cabinGeo = new THREE.BoxGeometry(0.8, 0.4, 1);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.4, -0.2);
        cabin.castShadow = true;
        car.add(cabin);
    
        const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    
        const positions = [{x: -0.5, z: 0.6}, {x: 0.5, z: 0.6}, {x: -0.5, z: -0.6}, {x: 0.5, z: -0.6}];
        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, -0.1, pos.z);
            car.add(wheel);
        });

        // نقطة غير مرئية لتتبع الكاميرا
        const cameraTarget = new THREE.Object3D();
        cameraTarget.position.set(0, 2, -5); // خلف السيارة وأعلى منها
        car.add(cameraTarget);
        car.userData.cameraTarget = cameraTarget;

        return car;
    }

    createTree() {
        const tree = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        tree.add(trunk);

        const leavesGeo = new THREE.ConeGeometry(1.5, 3, 8);
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 3;
        leaves.castShadow = true;
        tree.add(leaves);
        return tree;
    }

    createMountain() {
        const height = 10 + Math.random() * 20;
        const mountain = new THREE.Group();
        const mountainGeo = new THREE.ConeGeometry(8, height, 8);
        const mountainMat = new THREE.MeshLambertMaterial({ color: 0x969696 });
        const base = new THREE.Mesh(mountainGeo, mountainMat);
        base.position.y = height / 2;
        mountain.add(base);

        if (height > 20) { // Add snow cap for tall mountains
            const snowGeo = new THREE.ConeGeometry(2.5, 5, 8);
            const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.y = height - 2;
            mountain.add(snow);
        }
        return mountain;
    }

    createCloud() {
        const cloud = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(3, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

        for(let i=0; i<5; i++) {
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.set(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            sphere.scale.setScalar(0.5 + Math.random() * 0.5);
            cloud.add(sphere);
        }
        return cloud;
    }

    /**
     * الحلقة الرئيسية للعبة (Game Loop). يتم استدعاؤها في كل إطار.
     */
    update() {
        const simState = this.sim.getObserved();
        if (!simState || !simState.players) return; // انتظر حتى تصبح حالة المحاكاة جاهزة
        
        const localPlayerId = this.sim.getSession().getLocalPlayer().id;

        // 1. مزامنة نماذج السيارات مع حالة المحاكاة
        for (const playerId in simState.players) {
            if (!this.carMeshes.has(playerId)) {
                // لاعب جديد، أنشئ سيارة له
                const carState = simState.players[playerId].car;
                const newCarMesh = this.createCarMesh(carState.color);
                this.scene.add(newCarMesh);
                this.carMeshes.set(playerId, newCarMesh);
            }
            // تحديث موقع ودوران السيارة الحالية
            const carMesh = this.carMeshes.get(playerId);
            const carState = simState.players[playerId].car;
            carMesh.position.set(carState.position.x, carState.position.y, carState.position.z);
            carMesh.rotation.y = carState.rotation.y;
        }

        // 2. إزالة سيارات اللاعبين الذين غادروا
        this.carMeshes.forEach((mesh, playerId) => {
            if (!simState.players[playerId]) {
                this.scene.remove(mesh);
                this.carMeshes.delete(playerId);
            }
        });

        // 3. تحديث الكاميرا وإرسال المدخلات
        const localCarMesh = this.carMeshes.get(localPlayerId);
        const localCarSim = simState.players[localPlayerId]?.car;

        if (localCarMesh && localCarSim) {
            // أرسل حالة التحكم الحالية إلى المحاكاة
            localCarSim.setInputs(this.inputs);

            // اجعل الكاميرا تتبع سيارة اللاعب المحلي بسلاسة
            const targetPosition = new THREE.Vector3();
            localCarMesh.userData.cameraTarget.getWorldPosition(targetPosition);
            
            this.camera.position.lerp(targetPosition, 0.05);
            this.camera.lookAt(localCarMesh.position);
        }

        // 4. عرض المشهد
        this.renderer.render(this.scene, this.camera);
    }
}


// =================================================================================
// 4. نقطة بداية التطبيق (الانضمام للجلسة)
// =================================================================================

console.log("Joining Multisynq session...");

Multisynq.Session.join({
    // هام: استبدل هذا المفتاح بمفتاح API الخاص بك من موقع multisynq.io
    apiKey: "",
    
    // اسم الجلسة، استخدام الرابط يضمن أن اللاعبين في نفس الصفحة ينضمون لنفس الجلسة
    name: location.origin + location.pathname, 
    password: "none", // جلسة عامة بدون كلمة سر
    
    model: SharedSimulation, // صنف منطق اللعبة
    view: SimInterface,      // صنف العرض والتحكم
    
    // لعرض رسائل المزامنة في الكونسول للمساعدة في تصحيح الأخطاء
    debug: ["writes"] 
}).then(app => {
    // app.view هو نسخة من SimInterface
    const view = app.view || app;
    
    // إنشاء حلقة اللعبة الرئيسية
    const loop = () => {
        view.update();
        requestAnimationFrame(loop);
    };
    loop(); // بدء الحلقة
}).catch(err => {
    console.error("Failed to join session:", err);
    alert("Could not connect to the game session. Check the console for errors.");
});
