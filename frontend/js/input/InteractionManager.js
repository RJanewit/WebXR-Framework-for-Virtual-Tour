import * as THREE from "three";
import { EventBus } from "../utils/EventBus.js";

export class InteractionManager {
  constructor(sceneManager, hotspotManager) {
    this.sceneManager = sceneManager;
    this.hotspots = hotspotManager;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.vrUI = null;
  }

  init() {
    window.addEventListener("click", (e) => this._onDesktopClick(e));
    EventBus.on("input:select", ({ raycaster }) => this._handleRay(raycaster));
  }

  _getPointer(event) {
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return this.pointer;
  }

  _onDesktopClick(event) {
    if (this.sceneManager.isTransitioning) return;
    if (event.target.tagName !== "CANVAS") return;

    this.raycaster.setFromCamera(
      this._getPointer(event),
      this.sceneManager.camera,
    );
    this._handleRay(this.raycaster, event);
  }

  _handleRay(raycaster, originalEvent) {
    console.log("🔫 เหนี่ยวไกแล้ว! กำลังเช็คการชน...");

    if (this.vrUI && this.vrUI.isMediaPopupOpen) {
      const hits = raycaster.intersectObjects(
        this.vrUI.popupInteractables,
        true,
      );
      if (hits.length > 0) {
        let hitObj = hits[0].object;
        if (hitObj.userData && hitObj.userData.action === "closeMediaPopup") {
          EventBus.emit("ui:closeMediaPopupVR");
        }
      }
      return; // 🛑 จบฟังก์ชันตรงนี้เลย เลเซอร์จะทะลุไปกด Hotspot อื่นไม่ได้!
    }

    if (this.vrUI) {
      const vrUiObjects = this.vrUI.getInteractables
        ? this.vrUI.getInteractables()
        : [];
      if (vrUiObjects.length > 0) {
        const uiIntersects = raycaster.intersectObjects(vrUiObjects, false);
        if (uiIntersects.length > 0) {
          const action = uiIntersects[0].object.userData?.action;
          if (action === "toggleSound") EventBus.emit("ui:toggleSound");
          if (action === "goHome") window.location.href = "index.html";
          if (action === "hideGuide") this.vrUI.hideGuide();
          if (action === "toggleLang") {
            const newLang = this.vrUI.currentLang === "th" ? "en" : "th";
            EventBus.emit("ui:langChanged", { lang: newLang });
          }
          return;
        }
      }
    }

    const hotspotsArray =
      typeof this.hotspots.getAll === "function"
        ? this.hotspots.getAll()
        : this.hotspots.hotspots || [];

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
        if (hitObject === this.sceneManager.scene || !hitObject.parent) break;
        hitObject = hitObject.parent;
      }

      if (foundUserData) {
        const ud = foundUserData;
        const targetID = ud.targetID || ud.id || hitObject.name;

        EventBus.emit("interaction:hotspotClick", {
          targetID: targetID,
          angle: ud.angle || 0,
          type: ud.type,
          originalEvent: originalEvent,
        });

        if (ud.type === "image_popup") {
          EventBus.emit("interaction:popupClick", { imageUrl: ud.targetImage });
        } else if (ud.type === "video_popup") {
          EventBus.emit("interaction:videoPopupClick", {
            videoUrl: ud.targetImage,
          });
        } else if (ud.type === "model_3d" || ud.type === "model_popup") {
          EventBus.emit("interaction:modelClick", { modelPath: ud.modelPath });
        }
      }
    }
  }
}
