// استيراد المكتبات من CDN
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import * as Multisynq from 'https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.esm.js';

// العناصر DOM
const menuScreen = document.getElementById('menu-screen');
const howToPlayScreen = document.getElementById('how-to-play-screen');
const gameScreen = document.getElementById('game-screen');
const joinGameBtn = document.getElementById('join-game');
const createGameBtn = document.getElementById('create-game');
const howToPlayBtn = document.getElementById('how-to-play');
const backToMenuBtn = document.getElementById('back-to-menu');
const playerNameInput = document.getElementById('player-name-input');
const playerNameDisplay = document.getElementById('player-name-display');
const gameContainer = document.getElementById('game-container');
const loadingElement = document.getElementById('loading');
const playerCountElement = document.getElementById('player-count');
const fpsCounterElement = document.getElementById('fps-counter');
const speedElement = document.getElementById('speed');

// متغيرات الأداء
let frameCount = 0;
let lastFpsUpdate = 0;
let deltaTime = 0;
let lastTime = 0;

// حالة التطبيق
let appState = {
    playerName: 'اللاعب',
    roomId: null,
    isMultiplayer: false
};

// أحداث واجهة المستخدم
joinGameBtn.addEventListener('click', () => {
    if (playerNameInput.value.trim()) {
        appState.playerName = playerNameInput.value.trim();
    }
    playerNameDisplay.textContent = appState.playerName;
    startGame(false);
});

createGameBtn.addEventListener('click', () => {
    if (playerNameInput.value.trim()) {
        appState.playerName = playerNameInput.value.trim();
    }
    playerNameDisplay.textContent = appState.playerName;
    startGame(true);
});

howToPlayBtn.addEventListener('click', () => {
    menuScreen.classList.remove('active');
    howToPlayScreen.classList.add('active');
});

backToMenuBtn.addEventListener('click', () => {
    howToPlayScreen.classList.remove('active');
    menuScreen.classList.add('active');
});

// فئة محاكاة السيارة
class SimCar {
    constructor() {
        this.position = { x: 0, y: 0.5, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.steering = 0;
        this.accelerating = 0;
        this.color = new THREE.Color(Math.random(), Math.random(), Math.random());
        this.name = appState.playerName;
    }

    update(delta) {
        // تطبيق القيود على التوجيه
        this.steering = Math.max(-1, Math.min(1, this.steering));
        
        // تطبيق القيود على التسارع
        this.accelerating = Math.max(-1, Math.min(1, this.accelerating));
        
        // تحديث الدوران بناءً على التوجيه
        this.rotation.y += this.steering * delta * 2;
        
        // حساب السرعة بناءً على التسارع
        const acceleration = this.accelerating * 20;
        const maxSpeed = 30;
        
        this.velocity.x = Math.sin(this.rotation.y) * acceleration;
        this.velocity.z = Math.cos(this.rotation.y) * acceleration;
        
        // تطبيق القيود على السرعة
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (speed > maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * maxSpeed;
            this.velocity.z = (this.velocity.z / speed) * maxSpeed;
        }
        
        // تطبيق الاحتكاك
        this.velocity.x *= 0.95;
        this.velocity.z *= 0.95;
        
        // تحديث الموقع بناءً على السرعة
        this.position.x += this.velocity.x * delta;
        this.position.z += this.velocity.z * delta;
        
        // التأكد من أن السيارة تبقى على الطريق
        const trackHalfWidth = 15;
        this.position.x = Math.max(-trackHalfWidth, Math.min(trackHalfWidth, this.position.x));
        
        // تحديث سرعة العرض
        const kmh = Math.round(speed * 10);
        speedElement.textContent = `${kmh} km/h`;
        
        return kmh;
    }
}

// فئة المحاكاة المشتركة
class SharedSimulation {
    constructor() {
        this.cars = new Map();
        this.nextCarId = 1;
        this.track = [];
        this.generateTrack();
    }

    generateTrack() {
        // إنشاء نقاط للطريق
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const radius = 50;
            this.track.push({
                x: Math.sin(angle) * radius,
                z: Math.cos(angle) * radius
            });
        }
    }

    addCar() {
        const carId = this.nextCarId++;
        const car = new SimCar();
        
        // وضع السيارة في نقطة عشوائية على الطريق
        const startPoint = this.track[Math.floor(Math.random() * this.track.length)];
        car.position.x = startPoint.x;
        car.position.z = startPoint.z;
        
        this.cars.set(carId, car);
        return carId;
    }

    removeCar(carId) {
        this.cars.delete(carId);
    }

    update(delta) {
        for (const car of this.cars.values()) {
            car.update(delta);
        }
    }
}

// واجهة المحاكاة
class SimInterface {
    constructor(model) {
        this.model = model;
        this.carId = model.addCar();
        this.car = model.cars.get(this.carId);
        
        this.initScene();
        this.initControls();
        this.createEnvironment();
        this.createTrack();
        this.createCarMesh();
        
        // إنشاء سيارات للاعبين الآخرين
        for (const [id, car] of model.cars) {
            if (id !== this.carId) {
                this.createOtherCarMesh(id, car);
            }
        }
        
        // تحديث عدد اللاعبين
        playerCountElement.textContent = `اللاعبين: ${this.model.cars.size}`;
    }

    initScene() {
        // إنشاء المشهد
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // إنشاء الكاميرا
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 15, -25);
        
        // إنشاء العارض
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        gameContainer.appendChild(this.renderer.domElement);
        
        // إضافة الإضاءة
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // إضافة ضوء مساعد للرؤية الليلية
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemisphereLight.position.set(0, 20, 0);
        this.scene.add(hemisphereLight);
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    createEnvironment() {
        // إنشاء الأرضية
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2e8b57,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // إضافة الجبال
        for (let i = 0; i < 20; i++) {
            const height = 5 + Math.random() * 15;
            const mountainGeometry = new THREE.ConeGeometry(5, height, 8);
            
            // جبال عالية ذات قمم ثلجية
            let mountainMaterial;
            if (height > 15) {
                mountainMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xf0f8ff,
                    roughness: 0.7,
                    metalness: 0.3
                });
            } else {
                mountainMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x8b4513,
                    roughness: 0.9,
                    metalness: 0.1
                });
            }
            
            const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
            mountain.position.set(
                Math.random() * 180 - 90,
                height / 2,
                Math.random() * 180 - 90
            );
            mountain.castShadow = true;
            this.scene.add(mountain);
        }
        
        // إضافة الأشجار
        for (let i = 0; i < 30; i++) {
            // جذع الشجرة
            const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 3, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x8b4513,
                roughness: 0.9,
                metalness: 0.1
            });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.castShadow = true;
            
            // أوراق الشجرة
            const leavesGeometry = new THREE.ConeGeometry(2, 5, 8);
            const leavesMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x228b22,
                roughness: 0.7,
                metalness: 0.2
            });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 3;
            leaves.castShadow = true;
            
            const tree = new THREE.Group();
            tree.add(trunk);
            tree.add(leaves);
            
            tree.position.set(
                Math.random() * 180 - 90,
                0,
                Math.random() * 180 - 90
            );
            this.scene.add(tree);
        }
        
        // إضافة السحب
        for (let i = 0; i < 15; i++) {
            const cloudGroup = new THREE.Group();
            
            for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
                const size = 2 + Math.random() * 3;
                const cloudGeometry = new THREE.SphereGeometry(size, 16, 16);
                const cloudMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.7,
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
                cloudPart.position.set(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 8
                );
                
                cloudGroup.add(cloudPart);
            }
            
            cloudGroup.position.set(
                Math.random() * 200 - 100,
                20 + Math.random() * 20,
                Math.random() * 200 - 100
            );
            
            this.scene.add(cloudGroup);
        }
    }

    createTrack() {
        // إنشاء الطريق
        const trackWidth = 10;
        const trackMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });
        
        for (let i = 0; i < this.model.track.length; i++) {
            const current = this.model.track[i];
            const next = this.model.track[(i + 1) % this.model.track.length];
            
            const dx = next.x - current.x;
            const dz = next.z - current.z;
            const length = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            
            const trackSegmentGeometry = new THREE.BoxGeometry(trackWidth, 0.2, length);
            const trackSegment = new THREE.Mesh(trackSegmentGeometry, trackMaterial);
            
            trackSegment.position.set(
                current.x + dx / 2,
                0.1,
                current.z + dz / 2
            );
            trackSegment.rotation.y = angle;
            
            trackSegment.receiveShadow = true;
            this.scene.add(trackSegment);
        }
        
        // إضافة علامات الطريق
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0x888888,
            emissiveIntensity: 0.5
        });
        
        for (let i = 0; i < this.model.track.length; i++) {
            const current = this.model.track[i];
            const next = this.model.track[(i + 1) % this.model.track.length];
            
            const dx = next.x - current.x;
            const dz = next.z - current.z;
            const length = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            
            // خطوط منتصف الطريق
            for (let j = 0; j < length; j += 5) {
                const lineGeometry = new THREE.BoxGeometry(0.5, 0.1, 1);
                const line = new THREE.Mesh(lineGeometry, lineMaterial);
                
                const t = j / length;
                line.position.set(
                    current.x + dx * t,
                    0.2,
                    current.z + dz * t
                );
                line.rotation.y = angle;
                
                this.scene.add(line);
            }
        }
    }

    createCarMesh() {
        // إنشاء جسم السيارة (تصميم أجمل)
        const carBodyGeometry = new THREE.BoxGeometry(3, 1.2, 6);
        this.carBodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.car.color,
            roughness: 0.5,
            metalness: 0.8
        });
        this.carBody = new THREE.Mesh(carBodyGeometry, this.carBodyMaterial);
        this.carBody.castShadow = true;
        
        // إنشاء كابينة السيارة
        const cabinGeometry = new THREE.BoxGeometry(2.2, 1, 2.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.4
        });
        this.cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        this.cabin.position.y = 1.1;
        this.cabin.position.z = -0.5;
        this.cabin.castShadow = true;
        
        // إنشاء مصابيح أمامية
        const headlightGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffcc,
            emissive: 0xffff99,
            emissiveIntensity: 0.5
        });
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.rotation.x = Math.PI / 2;
        leftHeadlight.position.set(-1.2, 0.6, 3);
        
        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.rotation.x = Math.PI / 2;
        rightHeadlight.position.set(1.2, 0.6, 3);
        
        // إنشاء العجلات (تصميم محسن)
        const wheelGeometry = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const wheelRimGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 12);
        const wheelRimMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            roughness: 0.4,
            metalness: 0.8
        });
        
        this.wheels = [];
        const wheelPositions = [
            [-1.5, -0.6, 2],   // أمام يسار
            [1.5, -0.6, 2],    // أمام يمين
            [-1.5, -0.6, -2],  // خلف يسار
            [1.5, -0.6, -2]    // خلف يمين
        ];
        
        for (let i = 0; i < 4; i++) {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            const wheelRim = new THREE.Mesh(wheelRimGeometry, wheelRimMaterial);
            wheelRim.position.y = 0.01;
            
            const wheelGroup = new THREE.Group();
            wheelGroup.add(wheel);
            wheelGroup.add(wheelRim);
            
            wheelGroup.rotation.z = Math.PI / 2;
            wheelGroup.position.set(wheelPositions[i][0], wheelPositions[i][1], wheelPositions[i][2]);
            
            this.wheels.push(wheelGroup);
        }
        
        // تجميع أجزاء السيارة
        this.carMesh = new THREE.Group();
        this.carMesh.add(this.carBody);
        this.carMesh.add(this.cabin);
        this.carMesh.add(leftHeadlight);
        this.carMesh.add(rightHeadlight);
        this.wheels.forEach(wheel => this.carMesh.add(wheel));
        
        this.scene.add(this.carMesh);
    }

    createOtherCarMesh(id, car) {
        // إنشاء سيارة للاعب آخر
        const carBodyGeometry = new THREE.BoxGeometry(3, 1.2, 6);
        const carBodyMaterial = new THREE.MeshStandardMaterial({ 
            color: car.color,
            roughness: 0.5,
            metalness: 0.8
        });
        const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
        carBody.castShadow = true;
        
        const cabinGeometry = new THREE.BoxGeometry(2.2, 1, 2.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.4
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = 1.1;
        cabin.position.z = -0.5;
        cabin.castShadow = true;
        
        const wheelGeometry = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const wheels = [];
        const wheelPositions = [
            [-1.5, -0.6, 2],
            [1.5, -0.6, 2],
            [-1.5, -0.6, -2],
            [1.5, -0.6, -2]
        ];
        
        for (let i = 0; i < 4; i++) {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wheelPositions[i][0], wheelPositions[i][1], wheelPositions[i][2]);
            wheels.push(wheel);
        }
        
        const carMesh = new THREE.Group();
        carMesh.add(carBody);
        carMesh.add(cabin);
        wheels.forEach(wheel => carMesh.add(wheel));
        
        this.scene.add(carMesh);
        
        // حفظ المرجع للسيارة
        this.otherCars = this.otherCars || new Map();
        this.otherCars.set(id, { mesh: carMesh, car: car, wheels: wheels });
    }

    initControls() {
        // التحكم باللوحة المفاتيح
        this.keys = {};
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // إعادة تعيين السيارة عند الضغط على R
            if (e.key.toLowerCase() === 'r') {
                this.car.position.x = 0;
                this.car.position.z = 0;
                this.car.velocity.x = 0;
                this.car.velocity.z = 0;
                this.car.rotation.y = 0;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // التحكم بالأزرار في الشاشة
        const btnFwd = document.getElementById('btn-fwd');
        const btnBwd = document.getElementById('btn-bwd');
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        
        const setKey = (key, value) => {
            this.keys[key] = value;
        };
        
        btnFwd.addEventListener('mousedown', () => setKey('arrowup', true));
        btnFwd.addEventListener('mouseup', () => setKey('arrowup', false));
        btnFwd.addEventListener('touchstart', (e) => { e.preventDefault(); setKey('arrowup', true); }, { passive: false });
        btnFwd.addEventListener('touchend', () => setKey('arrowup', false));
        
        btnBwd.addEventListener('mousedown', () => setKey('arrowdown', true));
        btnBwd.addEventListener('mouseup', () => setKey('arrowdown', false));
        btnBwd.addEventListener('touchstart', (e) => { e.preventDefault(); setKey('arrowdown', true); }, { passive: false });
        btnBwd.addEventListener('touchend', () => setKey('arrowdown', false));
        
        btnLeft.addEventListener('mousedown', () => setKey('arrowleft', true));
        btnLeft.addEventListener('mouseup', () => setKey('arrowleft', false));
        btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); setKey('arrowleft', true); }, { passive: false });
        btnLeft.addEventListener('touchend', () => setKey('arrowleft', false));
        
        btnRight.addEventListener('mousedown', () => setKey('arrowright', true));
        btnRight.addEventListener('mouseup', () => setKey('arrowright', false));
        btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); setKey('arrowright', true); }, { passive: false });
        btnRight.addEventListener('touchend', () => setKey('arrowright', false));
    }

    updateControls() {
        // تحديث حالة التحكم بناءً على المدخلات
        this.car.accelerating = 0;
        this.car.steering = 0;
        
        if (this.keys['w'] || this.keys['arrowup']) {
            this.car.accelerating = 1;
        }
        
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.car.accelerating = -1;
        }
        
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.car.steering = -1;
        }
        
        if (this.keys['d'] || this.keys['arrowright']) {
            this.car.steering = 1;
        }
    }

    updateCamera() {
        // تحديث موقع الكاميرا لتبع السيارة مع إضافة سلاسة
        const targetPosition = new THREE.Vector3(
            this.car.position.x + Math.sin(this.car.rotation.y) * 10,
            8,
            this.car.position.z + Math.cos(this.car.rotation.y) * 10
        );
        
        const currentPosition = this.camera.position;
        
        // تطبيق تأثير تدريجي لحركة الكاميرا
        currentPosition.lerp(targetPosition, 0.1);
        this.camera.position.copy(currentPosition);
        
        // جعل الكاميرا تنظر إلى السيارة
        this.camera.lookAt(
            this.car.position.x,
            this.car.position.y + 2,
            this.car.position.z
        );
    }

    updateCarMesh() {
        // تحديث موقع ودوران السيارة
        this.carMesh.position.set(
            this.car.position.x,
            this.car.position.y,
            this.car.position.z
        );
        this.carMesh.rotation.y = this.car.rotation.y;
        
        // تدوير العجلات الأمامية عند التوجيه
        this.wheels[0].rotation.y = this.car.steering * 0.5;
        this.wheels[1].rotation.y = this.car.steering * 0.5;
        
        // تدوير جميع العجلات بناءً على السرعة
        const rotationSpeed = Math.sqrt(
            this.car.velocity.x * this.car.velocity.x + 
            this.car.velocity.z * this.car.velocity.z
        ) * 2;
        
        for (const wheel of this.wheels) {
            wheel.rotation.x += rotationSpeed;
        }
    }

    updateOtherCars() {
        // تحديث سيارات اللاعبين الآخرين
        if (this.otherCars) {
            for (const [id, otherCar] of this.otherCars.entries()) {
                const car = this.model.cars.get(id);
                if (car) {
                    otherCar.mesh.position.set(car.position.x, car.position.y, car.position.z);
                    otherCar.mesh.rotation.y = car.rotation.y;
                    
                    // تدوير عجلات السيارات الأخرى
                    const rotationSpeed = Math.sqrt(
                        car.velocity.x * car.velocity.x + 
                        car.velocity.z * car.velocity.z
                    ) * 2;
                    
                    for (const wheel of otherCar.wheels) {
                        wheel.rotation.x += rotationSpeed;
                    }
                }
            }
        }
    }

    update(time) {
        // حساب الوقت المنقضي
        if (lastTime === 0) lastTime = time;
        deltaTime = (time - lastTime) / 1000;
        lastTime = time;
        
        // تحديث عداد FPS
        frameCount++;
        if (time - lastFpsUpdate >= 1000) {
            fpsCounterElement.textContent = `FPS: ${Math.round(frameCount * 1000 / (time - lastFpsUpdate))}`;
            frameCount = 0;
            lastFpsUpdate = time;
        }
        
        // تحديث عدد اللاعبين
        playerCountElement.textContent = `اللاعبين: ${this.model.cars.size}`;
        
        // تحديث التحكم
        this.updateControls();
        
        // تحديث المحاكاة
        this.model.update(deltaTime);
        
        // تحديث الرسوميات
        this.updateCarMesh();
        this.updateOtherCars();
        this.updateCamera();
        
        // عرض المشهد
        this.renderer.render(this.scene, this.camera);
    }
}

// بدء اللعبة
function startGame(isHost) {
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    loadingElement.style.display = 'flex';
    
    // محاكاة اتصال Multisynq (يجب استبدالها بالاتصال الحقيقي)
    setTimeout(() => {
        const model = new SharedSimulation();
        const view = new SimInterface(model);
        
        loadingElement.style.display = 'none';
        
        const loop = (time) => {
            view.update(time);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }, 2000);
    
    // في التطبيق الحقيقي، سيتم استخدام:
    /*
    Multisynq.Session.join({
        apiKey: "2EIkqLXgo51r7ZLU6lbnYPg0hMr7fnRHaAGiNlep1C",
        name: isHost ? "host-session" : "join-session",
        password: "none",
        model: SharedSimulation,
        view: SimInterface,
        debug: ["writes"]
    }).then(app => {
        const view = app.view || app;
        const loop = (time) => { view.update(time); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        loadingElement.style.display = "none";
    }).catch(error => {
        loadingElement.textContent = "خطأ في الاتصال: " + error.message;
    });
    */
}
