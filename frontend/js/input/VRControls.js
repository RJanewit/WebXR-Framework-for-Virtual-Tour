import * as THREE from "three";
import { XRControllerModelFactory } from "XRControllerModelFactory";
import { XRHandModelFactory } from "XRHandModelFactory";
import { EventBus } from "../utils/EventBus.js";

export class VRControls {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controllers = [];
  }

  init() {
    this._setupControllers();
    this._setupHands();
  }

  _setupControllers() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry);
    line.scale.z = 5;

    // ลูปสร้าง Controller ทั้ง 2 ข้าง (0 = ซ้าย, 1 = ขวา)
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener("select", (e) => this._onSelect(e));

      // 🌟 เพิ่มโค้ดเช็ค: ถ้าเป็นมือซ้าย (i === 0) ให้เอาปุ่ม Smartwatch มาแปะ
      if (i === 0) {
        EventBus.emit("xr:setupWristUI", { controller: controller });
      }

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

  _setupHands() {
    const handModelFactory = new XRHandModelFactory();

    const hand0 = this.renderer.xr.getHand(0);
    hand0.add(handModelFactory.createHandModel(hand0));
    this.scene.add(hand0);

    const hand1 = this.renderer.xr.getHand(1);
    hand1.add(handModelFactory.createHandModel(hand1));
    this.scene.add(hand1);
  }

  _onSelect(event) {
    const raycaster = this._buildRay(event.target);

    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        console.log("🎯 VR ยิงโดนวัตถุชื่อ:", hitObject.name);
        console.log("📦 ข้อมูลที่ฝังไว้ (userData):", hitObject.userData);
    } else {
        console.log("💨 VR ยิงวืด (ไม่โดนอะไรเลย)");
    }

    EventBus.emit("input:select", { raycaster: raycaster });
  }

  _buildRay(controller) {
    this.scene.updateMatrixWorld(true);
    controller.updateMatrixWorld(true);

    if (this.camera) {
        this.camera.updateMatrixWorld(true);
    }

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    return raycaster;
  }

  _onSelect(event) {
    const raycaster = this._buildRay(event.target);
    EventBus.emit("input:select", { raycaster: raycaster });
  }

  _buildRay(controller) {
    this.scene.updateMatrixWorld(true);
    controller.updateMatrixWorld(true);

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const raycaster = new THREE.Raycaster();
    
    // 🌟 2. กำหนดกล้องให้กับ Raycaster! (เพื่อแก้ Error ของ Sprite)
    if (this.camera) {
        raycaster.camera = this.camera;
    }

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    return raycaster;
  }
}
