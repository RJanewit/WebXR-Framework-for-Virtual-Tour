import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { EventBus } from "../utils/EventBus.js";

export class DesktopControls {
  constructor(camera, domElement = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = null;
    this.isGyroEnabled = false;
  }

  init() {
    if (this.camera && this.domElement) {
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = -0.3;
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
        this.controls.target.set(0, 1.6, 0);
        this.controls.minPolarAngle = 0.01;
        this.controls.maxPolarAngle = Math.PI - 0.01;
    }

    this._setupWheelZoom();
    this._setupPinchZoom();

    EventBus.on("xr:sessionStart", () => { if(this.controls) this.controls.enabled = false; });
    EventBus.on("xr:sessionEnd", () => { if(this.controls) this.controls.enabled = true; });

    EventBus.on("camera:setAngle", ({ angle }) => {
      if (this.controls && this.camera) {
        const angleRad = THREE.MathUtils.degToRad(angle);

        const radius = 0.01;

        const camX = -Math.sin(angleRad) * radius;
        const camZ = Math.cos(angleRad) * radius;

        this.camera.position.set(camX, 1.6, camZ);
        this.controls.target.set(0, 1.6, 0);

        this.controls.update();
      }
    });
  }

  update() {
    if (this.controls && !this.isGyroEnabled) {
      this.controls.update();
    }
  }

  requestGyro() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === "granted") this._startGyro();
          else alert("โดนบล็อก! กรุณาเช็กการตั้งค่า Safari หรือ HTTPS");
        })
        .catch(console.error);
    } else {
      this._startGyro();
    }
  }

  _startGyro() {
    this.isGyroEnabled = true;
    if (this.controls) this.controls.enabled = false;
    window.addEventListener(
      "deviceorientation",
      (e) => this._onGyroMove(e),
      true
    );
  }

  _onGyroMove(event) {
    if (!this.isGyroEnabled || event.alpha === null) return;
    const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
    const beta = THREE.MathUtils.degToRad(event.beta || 0);
    const gamma = THREE.MathUtils.degToRad(event.gamma || 0);
    const euler = new THREE.Euler(beta, alpha, -gamma, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  _setupWheelZoom() {
      if (!this.domElement) return;
      this.domElement.addEventListener("wheel", (event) => {
          let newFov = this.camera.fov + event.deltaY * 0.05;
          this.camera.fov = THREE.MathUtils.clamp(newFov, 30, 90);
          this.camera.updateProjectionMatrix();
      }, { passive: true });
  }

  _setupPinchZoom() {
      if (!this.domElement) return;
      let pinchStartDistance = 0;
      let initialFov = 0;

      this.domElement.addEventListener("touchstart", (event) => {
          if (event.touches.length === 2) {
              pinchStartDistance = Math.hypot(
                  event.touches[0].clientX - event.touches[1].clientX,
                  event.touches[0].clientY - event.touches[1].clientY
              );
              initialFov = this.camera.fov;
          }
      }, { passive: true });

      this.domElement.addEventListener("touchmove", (event) => {
          if (event.touches.length === 2) {
              const currentDistance = Math.hypot(
                  event.touches[0].clientX - event.touches[1].clientX,
                  event.touches[0].clientY - event.touches[1].clientY
              );
              this.camera.fov = THREE.MathUtils.clamp(initialFov + (pinchStartDistance - currentDistance) * 0.1, 30, 90);
              this.camera.updateProjectionMatrix();
          }
      }, { passive: true });
  }
}