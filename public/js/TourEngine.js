import * as THREE from "three";
import { VRButton } from "VRButton";
import { OrbitControls } from "OrbitControls";
import { XRControllerModelFactory } from "XRControllerModelFactory";
import { XRHandModelFactory } from "XRHandModelFactory";
import gsap from "gsap";
import { Hotspot } from "./Hotspot.js";

export class TourEngine {
  constructor() {
    this.container = document.body;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.hotspotController = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();

    this.panoramaSphere = null;
    this.nadirPatch = null;
    this.fadeSphere = null;

    this.isTransitioning = false;
    this.onHotspotClick = null;
    this.onImagePopupClick = null;

    this.onWindowResize = this.onWindowResize.bind(this);
    this.animate = this.animate.bind(this);

    this.guidePlaneVR = null;
    this.closeBtnVR = null;

    const savedStatus = localStorage.getItem("tourAudioMuted");
    this.isSoundMuted = savedStatus === "true";

    this.audioListener = null;
    this.bgMusic = null;
    this.vrSoundBtn = null;
    this.vrHomeBtn = null;
    this.vrLangBtn = null;
    this.texSoundOn_Canvas = null;
    this.texSoundOff_Canvas = null;

    window.tourEngine = this;

    this.requestInventoryPermission =
      this.requestInventoryPermission.bind(this);
    this.isGyroEnabled = false;
  }

  init() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 1.6, 0.01);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;

    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = -0.3;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.target.set(0, 1.6, 0);
    this.controls.minPolarAngle = 0.01;
    this.controls.maxPolarAngle = Math.PI - 0.01;

    this.hotspotController = new Hotspot(this.scene, new THREE.TextureLoader());

    this.setupVRControllers();

    // พื้นปิดเท้า
    const patchGeo = new THREE.CircleGeometry(0.3, 64);
    const patchMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
    });
    this.nadirPatch = new THREE.Mesh(patchGeo, patchMat);
    this.nadirPatch.rotation.x = -Math.PI / 2;
    this.nadirPatch.position.set(0, 0, 0);
    this.scene.add(this.nadirPatch);

    // ลูกแก้วจอดำสำหรับเฟดตอนเปลี่ยนห้องใน VR
    const fadeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const fadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
    });
    this.fadeSphere = new THREE.Mesh(fadeGeo, fadeMat);
    this.camera.add(this.fadeSphere);
    if (!this.scene.children.includes(this.camera)) {
      this.scene.add(this.camera);
    }

    this.renderer.xr.addEventListener("sessionstart", () => {
      this.controls.enabled = false;
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      this.controls.enabled = true;
    });

    const handModelFactory = new XRHandModelFactory();
    const hand0 = this.renderer.xr.getHand(0);
    hand0.add(handModelFactory.createHandModel(hand0));
    this.scene.add(hand0);

    const hand1 = this.renderer.xr.getHand(1);
    hand1.add(handModelFactory.createHandModel(hand1));
    this.scene.add(hand1);

    window.addEventListener("resize", this.onWindowResize);
    this.setupRaycasting();
    this.renderer.setAnimationLoop(this.animate);

    this.setupVRUI();
    this.playBackgroundMusic("./assets/audio/factory-bgm.mp3");
  }

  setupVRUI() {
    const uiLoader = new THREE.TextureLoader();

    // 1. ป้ายแนะนำ
    uiLoader.load("assets/img/uxui/แนะนำการใช้งาน.png", (guideTex) => {
      guideTex.colorSpace = THREE.SRGBColorSpace;
      const guideMat = new THREE.MeshBasicMaterial({
        map: guideTex,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      this.guidePlaneVR = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.0),
        guideMat,
      );
      this.guidePlaneVR.position.set(0, 0, -1.0);
      this.guidePlaneVR.renderOrder = 9999;

      const closeTex = uiLoader.load("assets/img/uxui/close_icon.png");
      this.closeBtnVR = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({
          map: closeTex,
          transparent: true,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
      );
      this.guidePlaneVR.add(this.closeBtnVR);
      this.closeBtnVR.position.set(0.82, 0.42, 0.02);
      this.closeBtnVR.renderOrder = 10000;

      if (this.camera) this.camera.add(this.guidePlaneVR);
    });

    // 2. ปุ่มเสียง
    this.texSoundOn_Canvas = this.createSvgCanvasTexture(false);
    this.texSoundOff_Canvas = this.createSvgCanvasTexture(true);
    const soundMatVR = new THREE.SpriteMaterial({
      map: this.isSoundMuted ? this.texSoundOff_Canvas : this.texSoundOn_Canvas,
      depthTest: false,
      transparent: true,
    });
    this.vrSoundBtn = new THREE.Sprite(soundMatVR);
    this.vrSoundBtn.position.set(1.45, 0.9, -2.1);
    this.vrSoundBtn.scale.set(0.18, 0.18, 1);
    this.vrSoundBtn.visible = false;
    this.camera.add(this.vrSoundBtn);

    // 3. ปุ่ม Home
    const texHome = this.createHomeIconTexture();
    const homeMat = new THREE.SpriteMaterial({
      map: texHome,
      depthTest: false,
      transparent: true,
    });
    this.vrHomeBtn = new THREE.Sprite(homeMat);
    this.vrHomeBtn.position.set(1.2, 0.9, -2.1);
    this.vrHomeBtn.scale.set(0.18, 0.18, 1);
    this.vrHomeBtn.renderOrder = 99999;
    this.vrHomeBtn.visible = false;
    this.camera.add(this.vrHomeBtn);

    // 4. ปุ่มภาษา
    this.currentLang = localStorage.getItem("tourLang") || "th";
    const texLang = this.createLanguageTexture(this.currentLang);
    const langMat = new THREE.SpriteMaterial({
      map: texLang,
      depthTest: false,
      transparent: true,
    });
    this.vrLangBtn = new THREE.Sprite(langMat);
    this.vrLangBtn.position.set(0.8, 0.9, -2.1);
    this.vrLangBtn.scale.set(0.38, 0.19, 1);
    this.vrLangBtn.renderOrder = 99999;
    this.vrLangBtn.visible = false;
    this.camera.add(this.vrLangBtn);

    // Event เปิด/ปิดปุ่มเมื่อสวมแว่น
    this.renderer.xr.addEventListener("sessionstart", () => {
      if (this.vrSoundBtn) this.vrSoundBtn.visible = true;
      if (this.vrHomeBtn) this.vrHomeBtn.visible = true;
      if (this.vrLangBtn) this.vrLangBtn.visible = true;
    });

    this.renderer.xr.addEventListener("sessionend", () => {
      if (this.vrSoundBtn) this.vrSoundBtn.visible = false;
      if (this.vrHomeBtn) this.vrHomeBtn.visible = false;
      if (this.vrLangBtn) this.vrLangBtn.visible = false;
    });

    this.hideVRGuide = () => {
      if (this.guidePlaneVR) this.guidePlaneVR.visible = false;
    };
    setTimeout(() => {
      this.hideVRGuide();
    }, 7000);
  }

  requestInventoryPermission() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((permissionState) => {
          if (permissionState === "granted") this.startGyro();
          else alert("โดนบล็อก! กรุณาเช็กการตั้งค่า Safari หรือ HTTPS");
        })
        .catch((err) => console.error(err));
    } else {
      this.startGyro();
    }
  }

  startGyro() {
    this.isGyroEnabled = true;
    if (this.controls) this.controls.enabled = false;
    window.addEventListener(
      "deviceorientation",
      (e) => this.updateGyroRotation(e),
      true,
    );
  }

  updateGyroRotation(event) {
    if (!this.isGyroEnabled || event.alpha === null) return;
    const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
    const beta = THREE.MathUtils.degToRad(event.beta || 0);
    const gamma = THREE.MathUtils.degToRad(event.gamma || 0);
    const euler = new THREE.Euler(beta, alpha, -gamma, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  playBackgroundMusic(audioPath) {
    if (this.bgMusic && this.bgMusic.isPlaying) return;
    if (!this.audioListener) {
      this.audioListener = new THREE.AudioListener();
      this.camera.add(this.audioListener);
    }
    this.bgMusic = new THREE.Audio(this.audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(audioPath, (buffer) => {
      this.bgMusic.setBuffer(buffer);
      this.bgMusic.setLoop(true);
      const savedMute = localStorage.getItem("tourAudioMuted");
      const isMuted = savedMute === "true" || savedMute === true;
      this.bgMusic.setVolume(isMuted ? 0 : 0.3);
      this.bgMusic.play();
      this.setMute(isMuted);
    });
  }

  loadPanorama(imagePath, rotationY = 0) {
    const loader = new THREE.TextureLoader();
    loader.load(imagePath, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      if (this.panoramaSphere) {
        this.scene.remove(this.panoramaSphere);
        if (this.panoramaSphere.material.map)
          this.panoramaSphere.material.map.dispose();
        this.panoramaSphere.geometry.dispose();
        this.panoramaSphere.material.dispose();
      }
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.FrontSide,
        depthWrite: false,
      });
      this.panoramaSphere = new THREE.Mesh(geometry, material);
      this.panoramaSphere.position.set(0, 1.6, 0);
      this.panoramaSphere.rotation.y = THREE.MathUtils.degToRad(rotationY);
      this.panoramaSphere.renderOrder = -1;
      this.scene.add(this.panoramaSphere);
    });
  }

  preloadImage(imagePath) {
    if (!imagePath) return;
    if (!this.textureCache) this.textureCache = new Map();
    if (this.textureCache.has(imagePath)) return;

    const loader = new THREE.TextureLoader();
    loader.load(imagePath, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      this.textureCache.set(imagePath, texture);
    });
  }

  transitionTo(imagePath, startAngleDeg = 0, directionAngle = 0, onComplete) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const isVR = this.renderer.xr.isPresenting;
    const duration = 0.8;

    // ... (ส่วน Fade Out เหมือนเดิม) ...
    if (!isVR) {
      gsap.to(this.camera, {
        fov: 60,
        duration: duration / 2,
        ease: "power2.in",
        onUpdate: () => this.camera.updateProjectionMatrix(),
      });
    } else {
      if (this.fadeSphere)
        gsap.to(this.fadeSphere.material, {
          opacity: 1,
          duration: duration / 2,
        });
    }

    if (this.hotspotController && this.hotspotController.hotspots.length > 0) {
      this.hotspotController.hotspots.forEach((hs) => {
        const targets =
          hs.type === "Group"
            ? hs.children.map((c) => c.material).filter((m) => m)
            : [hs.material];
        targets.forEach((mat) => {
          if (mat) gsap.to(mat, { opacity: 0, duration: duration / 2 });
        });
      });
    }

    const applyNewScene = (newTexture) => {
      this.clearHotspots();

      if (this.panoramaSphere) {
        // 1. จำรูปห้องเก่าไว้ก่อน
        const oldTexture = this.panoramaSphere.material.map;

        // 2. สลับรูปเป็นห้องใหม่
        this.panoramaSphere.material.map = newTexture;
        this.panoramaSphere.material.needsUpdate = true;
        this.panoramaSphere.rotation.y =
          THREE.MathUtils.degToRad(startAngleDeg);

        // 🌟 3. ระบบ Garbage Collection (ล้าง Cache ห้องทางแยกที่เราไม่ได้เดินไป)
        if (this.textureCache) {
          for (const [key, tex] of this.textureCache.entries()) {
            // ถ้าไม่ใช่ห้องที่กำลังยืนอยู่ (new) และไม่ใช่ห้องที่เพิ่งจากมา (old) ให้ลบทิ้ง!
            if (tex !== newTexture && tex !== oldTexture) {
              tex.dispose(); // คืน VRAM ให้แว่น VR
              this.textureCache.delete(key);
              console.log("🗑️ คืนหน่วยความจำ: ล้างรูปห้องที่ไม่ได้ไป ->", key);
            }
          }
        }
      }

      try {
        if (onComplete) onComplete();
      } catch (e) {}

      this.camera.position.set(0, 1.6, 0.01);
      this.controls.target.set(0, 1.6, 0);

      // ... (ส่วน Fade In โค้ดเดิมข้างล่างไม่ต้องแก้ครับ) ...
      if (!isVR) {
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
      } else {
        if (this.fadeSphere)
          gsap.to(this.fadeSphere.material, {
            opacity: 0,
            duration: duration / 2,
          });
      }
      this.controls.update();

      setTimeout(
        () => {
          this.isTransitioning = false;
        },
        (duration / 2) * 1000 + 100,
      );
    };

    // ... (ส่วนโหลดรูปเข้า Cache เหมือนเดิม) ...
    setTimeout(
      () => {
        if (!this.textureCache) this.textureCache = new Map();

        if (this.textureCache.has(imagePath)) {
          applyNewScene(this.textureCache.get(imagePath));
        } else {
          const loader = new THREE.TextureLoader();
          loader.load(
            imagePath,
            (newTexture) => {
              newTexture.colorSpace = THREE.SRGBColorSpace;
              newTexture.generateMipmaps = true;

              // 🌟 ทริค: ให้ WebGL บังคับย่อยข้อมูลบน CPU ให้เสร็จก่อนส่งขึ้น GPU (ลดอาการ VR ค้างตอนสลับภาพ)
              this.renderer.initTexture(newTexture);

              this.textureCache.set(imagePath, newTexture);
              applyNewScene(newTexture);
            },
            undefined,
            (err) => {
              console.error("Error loading image", err);
              this.isTransitioning = false; // ปลดล็อกถ้าโหลดภาพพัง
            },
          );
        }
      },
      (duration / 2) * 1000,
    );
  }

  addHotspot(targetURL, angle) {
    if (this.hotspotController)
      this.hotspotController.addHotspot(targetURL, angle);
  }
  addRingJumpHotspot(name, x, z) {
    if (this.hotspotController)
      this.hotspotController.addRingJumpHotspot(name, x, z);
  }
  addImageHotspot(imagePath, x, y, z, angle, w, h) {
    if (this.hotspotController)
      this.hotspotController.addImageHotspot(imagePath, x, y, z, angle, w, h);
  }
  addImagePopupHotspot(target, x, y, z) {
    if (this.hotspotController)
      this.hotspotController.addImagePopupHotspot(target, x, y, z);
  }
  addVideoPopupHotspot(target, x, y, z) {
    if (this.hotspotController)
      this.hotspotController.addVideoPopupHotspot(target, x, y, z);
  }
  addDoorHotspot(targetID, x, y, z, color) {
    if (this.hotspotController)
      this.hotspotController.addDoorHotspot(targetID, x, y, z, color);
  }
  addVideoHotspot(videoPath, x, y, z, angle = 0, width = 40, height = 22.5) {
    if (this.hotspotController)
      this.hotspotController.addVideoHotspot(
        videoPath,
        x,
        y,
        z,
        angle,
        width,
        height,
      );
  }
  addModelHotspot(modelPath, x, y, z) {
    if (this.hotspotController)
      this.hotspotController.add3DModelHotspot(modelPath, x, y, z);
  }

  clearHotspots() {
    if (!this.hotspotController) return;
    this.hotspotController.hotspots.forEach((obj) => this.scene.remove(obj));
    this.hotspotController.hotspots = [];
  }

  setupRaycasting() {
    window.addEventListener("click", (event) => {
      this.playBackgroundMusic("./assets/audio/factory-bgm.mp3");
      if (this.isTransitioning) return;

      if (this.isGyroEnabled) {
        this.pointer.x = 0;
        this.pointer.y = 0;
      } else {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      }
      this.raycaster.setFromCamera(this.pointer, this.camera);

      this.handleIntersections(this.raycaster);
    });

    this.renderer.domElement.addEventListener(
      "wheel",
      (event) => {
        if (this.isTransitioning) return;
        let newFov = this.camera.fov + event.deltaY * 0.05;
        this.camera.fov = THREE.MathUtils.clamp(newFov, 30, 90);
        this.camera.updateProjectionMatrix();
      },
      { passive: true },
    );

    let pinchStartDistance = 0;
    let initialFov = 0;

    this.renderer.domElement.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 2) {
          pinchStartDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          initialFov = this.camera.fov;
        }
      },
      { passive: true },
    );

    this.renderer.domElement.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length === 2 && !this.isTransitioning) {
          const currentDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          this.camera.fov = THREE.MathUtils.clamp(
            initialFov + (pinchStartDistance - currentDistance) * 0.1,
            30,
            90,
          );
          this.camera.updateProjectionMatrix();
        }
      },
      { passive: true },
    );
  }

  onWindowResize() {
    if (this.renderer && this.renderer.xr && this.renderer.xr.isPresenting)
      return;
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  animate() {
    const time = this.clock.getElapsedTime();
    if (this.renderer.xr.isPresenting === false) this.controls.update();
    if (
      this.hotspotController &&
      typeof this.hotspotController.updateHotspots === "function"
    )
      this.hotspotController.updateHotspots(time, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  setupVRControllers() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry);
    line.scale.z = 5;

    this.controllers = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener("select", (e) => this.onSelect(e));
      controller.add(line.clone());
      this.scene.add(controller);
      this.controllers.push(controller);

      const controllerGrip = this.renderer.xr.getControllerGrip(i);
      controllerGrip.add(
        new XRControllerModelFactory().createControllerModel(controllerGrip),
      );
      this.scene.add(controllerGrip);
    }
  }

  onSelect(event) {
    if (this.isTransitioning) return;

    const controller = event.target;
    this.scene.updateMatrixWorld(true);
    controller.updateMatrixWorld(true);

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    this.handleIntersections(this.raycaster);
  }

  handleIntersections(raycaster) {
    if (
      this.vrHomeBtn &&
      this.vrHomeBtn.visible &&
      raycaster.intersectObject(this.vrHomeBtn, false).length > 0
    ) {
      window.location.href = "index.html";
      return;
    }
    if (
      this.closeBtnVR &&
      this.guidePlaneVR &&
      this.guidePlaneVR.visible &&
      raycaster.intersectObject(this.closeBtnVR, false).length > 0
    ) {
      this.hideVRGuide();
      return;
    }
    if (
      this.vrSoundBtn &&
      this.vrSoundBtn.visible &&
      raycaster.intersectObject(this.vrSoundBtn, false).length > 0
    ) {
      this.toggleSound();
      return;
    }
    if (
      this.vrLangBtn &&
      this.vrLangBtn.visible &&
      raycaster.intersectObject(this.vrLangBtn, false).length > 0
    ) {
      this.currentLang = this.currentLang === "th" ? "en" : "th";
      localStorage.setItem("tourLang", this.currentLang);
      this.vrLangBtn.material.map = this.createLanguageTexture(
        this.currentLang,
      );
      this.vrLangBtn.material.needsUpdate = true;
      if (typeof updateWebLanguageUI === "function")
        updateWebLanguageUI(this.currentLang);
      return;
    }

    const hotspotsArray = this.hotspotController
      ? this.hotspotController.hotspots
      : [];
    if (hotspotsArray.length === 0) return;

    const intersects = raycaster.intersectObjects(hotspotsArray, true);
    if (intersects.length > 0) {
      let hitObject = intersects[0].object;
      let foundUserData = null;

      while (hitObject) {
        if (
          hitObject.userData &&
          (hitObject.userData.type || hitObject.userData.targetID)
        ) {
          foundUserData = hitObject.userData;
          break;
        }
        if (hitObject === this.scene || !hitObject.parent) break;
        hitObject = hitObject.parent;
      }

      if (foundUserData) {
        const ud = foundUserData;
        if (ud.type === "pulse_ring" && this.onImagePopupClick)
          this.onImagePopupClick(ud.targetImage);
        else if (ud.type === "arrow" && this.onHotspotClick)
          this.onHotspotClick(ud.targetID, ud.angle);
        else if (ud.type === "door" && this.onHotspotClick)
          this.onHotspotClick(ud.targetID, 0);
        else if (ud.type === "ring_jump" && this.onHotspotClick)
          this.onHotspotClick(ud.targetID, 0);
        else if (ud.type === "model_3d" && this.onModelHotspotClick)
          this.onModelHotspotClick(ud.modelPath);
      }
    }
  }

  updateWebIcons() {
    const iconOn = document.getElementById("webIconOn");
    const iconOff = document.getElementById("webIconOff");
    if (iconOn && iconOff) {
      if (this.isSoundMuted) {
        iconOn.classList.add("hidden");
        iconOff.classList.remove("hidden");
      } else {
        iconOn.classList.remove("hidden");
        iconOff.classList.add("hidden");
      }
    }
  }

  createSvgCanvasTexture(isMuted) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.scale(256 / 24, 256 / 24);
    ctx.fillStyle = "white";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (!isMuted) {
      const p = new Path2D(
        "M13 5v14l-5-4H5V9h3l5-4zm2.5 7c0-1.5-.9-2.8-2.2-3.4v6.8c1.3-.6 2.2-1.9 2.2-3.4zM15 3.2v2.1c2.8.7 5 3.3 5 6.7s-2.2 6-5 6.7v2.1c4-.8 7-4.4 7-8.8s-3-8-7-8.8z",
      );
      ctx.fill(p);
    } else {
      const poly = [11, 5, 6, 9, 2, 9, 2, 15, 6, 15, 11, 19, 11, 5];
      ctx.beginPath();
      ctx.moveTo(poly[0], poly[1]);
      for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(23, 9);
      ctx.lineTo(17, 15);
      ctx.moveTo(17, 9);
      ctx.lineTo(23, 15);
      ctx.stroke();
    }
    return (
      (new THREE.CanvasTexture(canvas).colorSpace = THREE.SRGBColorSpace),
      new THREE.CanvasTexture(canvas)
    );
  }

  setMute(isMuted) {
    this.isSoundMuted = isMuted;
    localStorage.setItem("tourAudioMuted", isMuted);
    const audioCtx = THREE.AudioContext.getContext();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (this.bgMusic) {
      if (!isMuted) {
        if (this.bgMusic.isPlaying) this.bgMusic.stop();
        this.bgMusic.play();
      }
      this.bgMusic.setVolume(isMuted ? 0 : 0.3);
    }
    if (this.vrSoundBtn) {
      this.vrSoundBtn.material.map = isMuted
        ? this.texSoundOff_Canvas
        : this.texSoundOn_Canvas;
      this.vrSoundBtn.material.needsUpdate = true;
    }
    this.updateWebIcons();
  }

  toggleSound() {
    this.setMute(!this.isSoundMuted);
  }

  createHomeIconTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.scale(256 / 24, 256 / 24);
    ctx.fillStyle = "white";
    ctx.fill(new Path2D("M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"));
    return (
      (new THREE.CanvasTexture(canvas).colorSpace = THREE.SRGBColorSpace),
      new THREE.CanvasTexture(canvas)
    );
  }

  createLanguageTexture(currentLang) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.roundRect(20, 40, 472, 176, 88);
    ctx.fill();
    ctx.font = "bold 90px Kanit, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = currentLang === "en" ? "#20CDFA" : "white";
    ctx.fillText("EN", 145, 128);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("|", 256, 128);
    ctx.fillStyle = currentLang === "th" ? "#20CDFA" : "white";
    ctx.fillText("TH", 367, 128);
    return (
      (new THREE.CanvasTexture(canvas).colorSpace = THREE.SRGBColorSpace),
      new THREE.CanvasTexture(canvas)
    );
  }

  showVRGuideManual() {
    if (this.guidePlaneVR) {
      this.guidePlaneVR.visible = true;
      const vector = new THREE.Vector3(0, 0, -1);
      vector.applyQuaternion(this.camera.quaternion);
      this.guidePlaneVR.position
        .copy(this.camera.position)
        .add(vector.multiplyScalar(1.0));
      this.guidePlaneVR.lookAt(this.camera.position);
    }
  }
}
