import * as THREE from "three";
import { VRButton } from "VRButton";
import { OrbitControls } from "OrbitControls";
import { XRHandModelFactory } from "XRHandModelFactory";

export class TourEngine {
  constructor() {
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.controls = null;
    this.panoramaSphere = null;
    this.textureLoader = new THREE.TextureLoader();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  // 1. ตั้งค่าพื้นฐาน (Scene, Camera, Renderer, Controls)
  init() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 0.1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    document.body.appendChild(VRButton.createButton(this.renderer));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    // VR Listeners
    this.renderer.xr.addEventListener("sessionstart", () => {
      this.controls.enabled = false;
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      this.controls.enabled = true;
    });

    // Setup Hand Tracking
    const handModelFactory = new XRHandModelFactory();
    const hand0 = this.renderer.xr.getHand(0);
    hand0.add(handModelFactory.createHandModel(hand0));
    this.scene.add(hand0);
    const hand1 = this.renderer.xr.getHand(1);
    hand1.add(handModelFactory.createHandModel(hand1));
    this.scene.add(hand1);

    // Resize Listener
    window.addEventListener("resize", () => this.onWindowResize());

    // Setup Click for Hotspots
    this.setupRaycasting();

    // Start Animation Loop
    this.renderer.setAnimationLoop(() => this.animate());
  }

  // 2. ฟังก์ชันโหลดพาโนรามา (ระบุรูป และมุมได้)
  loadPanorama(imagePath, startAngleDeg = 0) {
    this.textureLoader.load(
      imagePath,
      (texture) => {
        // ✅ 1) Color management (กันภาพสว่างจ้า/washed out)
        // ใช้กับ three r152+ (มี property: colorSpace)
        texture.colorSpace = THREE.SRGBColorSpace;

        // ✅ 2) Filtering + Mipmaps + Anisotropy (กันแตก/alias ตอนหมุน-ซูม)
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        if (this.renderer?.capabilities?.getMaxAnisotropy) {
          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }

        texture.needsUpdate = true;

        // ✅ 3) ล้างของเก่าให้หมด (รวม texture map ด้วย)
        if (this.panoramaSphere) {
          this.scene.remove(this.panoramaSphere);

          const oldMat = this.panoramaSphere.material;
          if (oldMat?.map) oldMat.map.dispose(); // สำคัญ: texture เก่า
          oldMat?.dispose?.();

          this.panoramaSphere.geometry?.dispose?.();
        }

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const material = new THREE.MeshBasicMaterial({ map: texture });

        // ✅ 4) กันโดน toneMapping/exposure ของ renderer ทำให้สว่างเว่อร์
        // (เผื่อโปรเจกต์คุณตั้ง toneMapping ไว้)
        material.toneMapped = false;

        this.panoramaSphere = new THREE.Mesh(geometry, material);

        // มุมเริ่มต้น
        this.panoramaSphere.rotation.y =
          THREE.MathUtils.degToRad(startAngleDeg);

        this.scene.add(this.panoramaSphere);
      },
      undefined,
      (err) => console.error("Panorama load error:", err)
    );
  }


addHotspot(targetURL, phiDeg = 0) {
  // ----- ค่าคงที่ -----
  const rho = 100;
  const y = -100;
  const iconPath = "/assets/img/uxui/blueArrow.png";
  const size = 50;

  const floatAmp = 5;
  const floatSpeed = 2.2;
  const phase = Math.random() * Math.PI * 2;

  // PNG นี้หัวลูกศร "ชี้ขึ้น" → ชดเชยให้ 0° ชี้ออกจากศูนย์ (+Z) ด้วย 180°
  const angleOffsetDeg = 180;

  // phi=0 -> +Z, phi=90 -> +X
  const phi = THREE.MathUtils.degToRad(phiDeg + 180);
  const x = rho * Math.sin(phi);
  const z = rho * Math.cos(phi);

  // ✅ ทำให้ plane อยู่บนระนาบ XZ ตั้งแต่ geometry (แก้ปัญหาแกนหมุนเพี้ยน)
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);

  const texLoader = this.textureLoader || new THREE.TextureLoader();
  texLoader.load(
    iconPath,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      if (this.renderer?.capabilities?.getMaxAnisotropy) {
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }
      tex.needsUpdate = true;

      const material = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false
      });

      const hotspot = new THREE.Mesh(geometry, material);
      hotspot.position.set(x, y, z);

      // ✅ ตอนนี้ rotation.y คือหมุนรอบโลกแกน Y จริง ๆ
      hotspot.rotation.y = THREE.MathUtils.degToRad(phiDeg + angleOffsetDeg + 180);
      hotspot.userData.yawRad = hotspot.rotation.y;

      hotspot.userData.targetURL = targetURL;
      hotspot.userData.basePos = new THREE.Vector3(x, y, z);
      hotspot.userData.floatAmp = floatAmp;
      hotspot.userData.floatSpeed = floatSpeed;
      hotspot.userData.phase = phase;

      hotspot.name = "Hotspot_Jump";

      this.scene.add(hotspot);
      this.hotspots ??= [];
      this.hotspots.push(hotspot);
    },
    undefined,
    (err) => console.error("Hotspot icon load error:", err)
  );
}

  // --- Helper Functions ---
  setupRaycasting() {
    window.addEventListener("click", (event) => {
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children);
      for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.name === "Hotspot_Jump") {
          window.location.href = intersects[i].object.userData.targetURL;
          return;
        }
      }
    });
  }

  animate() {
    if (this.renderer.xr.isPresenting === false) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);

    const t = performance.now() * 0.001;
    this.updateHotspots(t);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setCameraRotation(deg) {
    if (this.controls) {
      // แปลงองศาเป็นเรเดียน
      const radians = (Math.PI * deg) / 180;
      // ตั้งค่ามุม Azimuthal เริ่มต้น
      this.controls.setAzimuthalAngle(radians);
      // สำคัญ: ต้อง update controls เพื่อให้มุมใหม่ทำงาน
      this.controls.update();
    }
  }

  updateHotspots(timeSec) {
    if (!this.hotspots?.length) return;

    for (const hs of this.hotspots) {
      const b = hs.userData.basePos;
      const amp = hs.userData.floatAmp ?? 0;
      const spd = hs.userData.floatSpeed ?? 1;
      const ph = hs.userData.phase ?? 0;

      const yaw = hs.userData.yawRad ?? hs.rotation.y;

      // ค่าขยับไป-กลับ
      const d = Math.sin(timeSec * spd + ph) * amp;

      // เวกเตอร์ทิศทางบนระนาบ XZ ตามมุม yaw
      const dirX = Math.sin(yaw);
      const dirZ = Math.cos(yaw);

      // ขยับเข้า-ออกตามทิศลูกศร (บน XZ) โดยไม่แตะแกน Y
      hs.position.set(b.x + dirX * d, b.y, b.z + dirZ * d);
    }
  }


  
}
