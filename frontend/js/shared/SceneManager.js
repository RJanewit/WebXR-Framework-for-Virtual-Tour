import * as THREE from "three";
import gsap from "../../lib/gsap/index.js";
import { EventBus } from "../utils/EventBus.js";

export class SceneManager {
  constructor() {
    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = null;
    this.clock    = new THREE.Clock();

    this.panoramaSphere  = null;
    this.nadirPatch      = null;
    this.fadeSphere      = null;
    this.textureCache    = new Map();
    this.isTransitioning = false;

    this._onWindowResize = this._onWindowResize.bind(this);
  }

  init() {
    this.camera.position.set(0, 1.6, 0.01);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;

    const container = document.getElementById('scene-container');
    if (container) {
      container.appendChild(this.renderer.domElement);
    }
    
    this.scene.add(this.camera);

    const patchGeo = new THREE.CircleGeometry(0.3, 64);
    const patchMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
    });
    this.nadirPatch = new THREE.Mesh(patchGeo, patchMat);
    this.nadirPatch.rotation.x = -Math.PI / 2;
    this.nadirPatch.position.set(0, 0, 0);
    this.scene.add(this.nadirPatch);

    const fadeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const fadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
    });
    this.fadeSphere = new THREE.Mesh(fadeGeo, fadeMat);
    this.camera.add(this.fadeSphere);

    window.addEventListener("resize", this._onWindowResize);
  }

  loadPanorama(imagePath, rotationY = 0) {
    const loader = new THREE.TextureLoader();
    loader.load(imagePath, (texture) => {
      texture.colorSpace   = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;

      if (this.panoramaSphere) {
        this.scene.remove(this.panoramaSphere);
        this.panoramaSphere.material.map?.dispose();
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
      this.panoramaSphere.renderOrder = -1;
      this.scene.add(this.panoramaSphere);
      EventBus.emit("camera:setAngle", { angle: rotationY });
    });
  }

  preloadImage(imagePath) {
    if (!imagePath) return;
    if (this.textureCache.has(imagePath)) return;

    const loader = new THREE.TextureLoader();
    loader.load(imagePath, (texture) => {
      texture.colorSpace      = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      this.textureCache.set(imagePath, texture);
    });
  }

  /**
   * @param {string}   imagePath
   * @param {number}   startAngleDeg
   * @param {number}   directionAngle 
   * @param {Function} onComplete 
   */
  transitionTo(imagePath, startAngleDeg = 0, directionAngle = 0, onComplete) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const isVR    = this.renderer.xr.isPresenting;
    const HALF    = 0.4;

    EventBus.emit("scene:transitioning", { to: imagePath });

    if (!isVR) {
      gsap.to(this.camera, {
        fov: 60,
        duration: HALF,
        ease: "power2.in",
        onUpdate: () => this.camera.updateProjectionMatrix(),
      });
    } else {
      if (this.fadeSphere) {
        gsap.to(this.fadeSphere.material, { opacity: 1, duration: HALF });
      }
    }

    setTimeout(() => {
      const applyScene = (newTexture) => this._applyNewScene(
        newTexture, imagePath, startAngleDeg, isVR, HALF, onComplete
      );

      if (this.textureCache.has(imagePath)) {
        applyScene(this.textureCache.get(imagePath));
      } else {
        new THREE.TextureLoader().load(
          imagePath,
          (tex) => {
            tex.colorSpace      = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            this.renderer.initTexture(tex);
            this.textureCache.set(imagePath, tex);
            applyScene(tex);
          },
          undefined,
          (err) => {
            console.error("[SceneManager] โหลดภาพล้มเหลว:", err);
            this.isTransitioning = false;
          }
        );
      }
    }, HALF * 1000);
  }

  _applyNewScene(newTexture, imagePath, startAngleDeg, isVR, HALF, onComplete) {
    if (!this.panoramaSphere) return;

    const oldTexture = this.panoramaSphere.material.map;

    this.panoramaSphere.material.map        = newTexture;
    this.panoramaSphere.material.needsUpdate = true;

    for (const [key, tex] of this.textureCache.entries()) {
      if (tex !== newTexture && tex !== oldTexture) {
        tex.dispose();
        this.textureCache.delete(key);
        console.log("[SceneManager] 🗑️ GC texture:", key);
      }
    }

    this.camera.position.set(0, 1.6, 0.01);
    EventBus.emit("camera:setAngle", { angle: startAngleDeg });
    EventBus.emit("scene:transitioned", { imagePath });

    try { if (onComplete) onComplete(); } catch (e) {
      console.error("[SceneManager] onComplete error:", e);
    }

    if (!isVR) {
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
    } else {
      if (this.fadeSphere) {
        gsap.to(this.fadeSphere.material, { opacity: 0, duration: HALF });
      }
    }

    setTimeout(() => {
      this.isTransitioning = false;
      EventBus.emit("scene:ready");
    }, HALF * 1000 + 100);
  }

  resetCameraTarget() {
    this.camera.position.set(0, 1.6, 0.01);
  }

  _onWindowResize() {
    if (this.renderer?.xr?.isPresenting) return;
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  dispose() {
    window.removeEventListener("resize", this._onWindowResize);

    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();

    if (this.panoramaSphere) {
      this.panoramaSphere.material.map?.dispose();
      this.panoramaSphere.geometry.dispose();
      this.panoramaSphere.material.dispose();
    }

    this.fadeSphere?.geometry.dispose();
    this.fadeSphere?.material.dispose();
    this.nadirPatch?.geometry.dispose();
    this.nadirPatch?.material.dispose();

    this.renderer?.dispose();
  }
}
