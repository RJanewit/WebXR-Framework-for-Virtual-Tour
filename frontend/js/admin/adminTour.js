import * as THREE from "three";
import { TourEngine } from "../shared/TourEngine.js";
import { UIManager } from "/js/ui/UIManager.js";
import { EventBus } from "EventBus";
import { ApiService } from "../shared/ApiService.js";
import { HotspotEditorUI } from "./ui/HotspotEditorUI.js";
import { HotspotTooltipUI } from "./ui/HotspotTooltipUI.js";
import { TourMathUtils } from "../shared/TourMathUtils.js";
import { TourStateManager } from "../shared/TourStateManager.js";
import { InfoHotspotUI } from "./ui/InfoHotspotUI.js";
import { MapEditorUI } from "./ui/MapEditorUI.js";
import { ZoneEditorUI } from "./ui/ZoneEditorUI.js";
import { MediaUploadModalUI } from "./ui/MediaUploadModalUI.js";

class TourApp {
  constructor() {
    this.engine = new TourEngine();
    this.ui = new UIManager();
    this.api = new ApiService();
    this.hsEditor = new HotspotEditorUI();
    this.infoEditor = new InfoHotspotUI();
    this.tooltipUI = new HotspotTooltipUI();
    this.mapEditor = new MapEditorUI();
    this.zoneEditor = new ZoneEditorUI();

    this.infoEditor = new InfoHotspotUI();
    this.tempInfoData = null;

    this.state = new TourStateManager();

    this.selectedExistingHotspot = null;

    this.init();
  }

  async init() {
    try {
      this.hsEditor.init();
      this.infoEditor.init();
      this.zoneEditor.init();
      this.tooltipUI.init();
      this.mapEditor.init();

      const { scenesData, hotspotsData, zonesData } =
        await this.api.fetchInitialData();

      this.state.setInitialData(scenesData, hotspotsData, zonesData);

      this.zoneEditor.renderZoneList(this.state.zones);
      this.zoneEditor.renderZoneDropdowns(this.state.zones);
      this.mapEditor.renderPins(this.state.zones);

      this.engine.init();

      const style = document.createElement("style");
      style.innerHTML =
        "#VRButton, #vr-btn-container { display: none !important; pointer-events: none !important; }";
      document.head.appendChild(style);

      const guideModal = document.getElementById("showGuideBtn");
      if (guideModal)
        guideModal.style.setProperty("display", "none", "important");

      window.selectScene = (sceneName) => {
        if (!sceneName || sceneName === "undefined") {
          console.error(
            "❌ เจอบั๊ก: ค่า sceneName ที่ส่งมาเป็น undefined หรือข้อความว่างเปล่า!",
          );
          return;
        }

        const scenes = this.state?.scenes || window.scenesData || [];
        const targetScene = scenes.find((s) => s.name === sceneName);

        if (targetScene) {
          EventBus.emit("admin:detachGizmo");

          this.hsEditor.closePanel();
          this.infoEditor.closePanel();
          document.getElementById("tool-link")?.classList.remove("hidden");
          document.getElementById("tool-info")?.classList.remove("hidden");

          const imgPath = targetScene.image_path || targetScene.image_url;
          const startRot = targetScene.start_rotation || 0;

          this.engine.sceneManager.transitionTo(imgPath, startRot, 0, () => {
            this.loadScene(targetScene);
          });
          window.activeSceneId = targetScene.name;
          if (typeof window.renderSceneCards === "function") {
            window.renderSceneCards(scenes);
          }
        }
      };

      this.setupInteractionEvents();
      this.setupEditorEvents();
      this.setupZoneEvents();
      this.setupMapEvents();

      const firstScene = this.state.getFirstScene();
      if (firstScene) {
        this.engine.sceneManager.loadPanorama(
          firstScene.image_path,
          firstScene.start_rotation,
        );
        this.loadScene(firstScene, 0);
      }

      this.mediaModal.init();

      this.ui.hideLoading();

    } catch (error) {
      console.error("Initialization error:", error);
      const loadTextEl = document.getElementById("loading-text");
      if (loadTextEl) loadTextEl.innerText = "Error: " + error.message;
    }
  }

  setupInteractionEvents() {
    EventBus.on(
      "interaction:hotspotClick",
      ({ targetID, angle, originalEvent }) => {
        const panel = document.getElementById("link-to-hotspot-right-panel");
        const infoPanel = document.getElementById("info-hotspot-right-panel");
        const isPanelOpen =
          (panel && !panel.classList.contains("translate-x-full")) ||
          (infoPanel && !infoPanel.classList.contains("translate-x-full"));
        if (isPanelOpen) return;

        this.selectedExistingHotspot = { targetID, angle };

        const allMeshes = this.engine.hotspots.getAll();
        const clickedMesh = allMeshes.find(
          (m) => m.userData.targetID === targetID,
        );
        const btnGo = document.getElementById("btn-hs-go");
        if (clickedMesh && btnGo) {
          if (["door", "arrow", "ring"].includes(clickedMesh.userData.type)) {
            btnGo.style.display = "block";
          } else {
            btnGo.style.display = "none";
          }
        }

        if (originalEvent) {
          this.tooltipUI.show(originalEvent.clientX, originalEvent.clientY);
        } else {
          this.tooltipUI.show();
        }
      },
    );

    EventBus.on("interaction:popupClick", ({ imageUrl }) => {
      if (this.ui && this.ui.showImagePopup) {
        console.log("Show Image Popup:", imageUrl);
        this.ui.showImagePopup(imageUrl);
      }
    });

    EventBus.on("interaction:videoPopupClick", ({ videoUrl }) =>
      this.ui.showVideoPopup(videoUrl),
    );

    EventBus.on("interaction:modelClick", ({ modelPath }) =>
      this.ui.showModelViewer(modelPath),
    );
  }

  setupEditorEvents() {
    EventBus.on("ui:hotspotPositionChanged", ({ x, y, z }) => {
      const gizmo = this.engine.gizmo;
      // เช็คให้ชัวร์ว่ามีระบบ Gizmo และกำลังเลือกวัตถุอยู่จริงๆ
      if (!gizmo || !gizmo.activeEditObject) return;

      const activeObj = gizmo.activeEditObject;
      const proxyMesh = gizmo.proxyMesh;

      // 1. สร้างพิกัดใหม่จากที่พิมพ์ใน Input
      const newUnscaledPos = new THREE.Vector3(x, y, z);
      
      // 2. อัปเดตพิกัดให้ตัว Hotspot
      if (!activeObj.userData.unscaledPos) {
        activeObj.userData.unscaledPos = new THREE.Vector3();
      }
      activeObj.userData.unscaledPos.copy(newUnscaledPos);
      
      // เรียกใช้ฟังก์ชันคำนวณสเกลของระบบคุณ
      if (typeof TourMathUtils !== "undefined") {
          TourMathUtils.applyUnscaledPosToMesh(activeObj, newUnscaledPos);
      }

      // 3. 🌟 สั่งให้วัตถุล่องหน (proxyMesh) ขยับตามไปที่พิกัดใหม่
      if (proxyMesh) {
          proxyMesh.position.copy(newUnscaledPos);
      }

      // 4. 🌟 บังคับอัปเดตหน้าจอทันที (ป้องกัน Gizmo หายหรือค้าง)
      if (this.engine.sceneManager && this.engine.sceneManager.renderer) {
          this.engine.sceneManager.renderer.render(
              this.engine.sceneManager.scene, 
              this.engine.sceneManager.camera
          );
      }
    });

    EventBus.on("ui:infoPositionChanged", ({ x, y, z }) => {
      const gizmo = this.engine.gizmo;
      if (!gizmo || !gizmo.activeEditObject) return;

      const activeObj = gizmo.activeEditObject;
      const proxyMesh = gizmo.proxyMesh;

      const newUnscaledPos = new THREE.Vector3(x, y, z);
      
      if (!activeObj.userData.unscaledPos) {
        activeObj.userData.unscaledPos = new THREE.Vector3();
      }
      activeObj.userData.unscaledPos.copy(newUnscaledPos);
      
      if (typeof TourMathUtils !== "undefined") {
          TourMathUtils.applyUnscaledPosToMesh(activeObj, newUnscaledPos);
      }

      if (proxyMesh) {
          proxyMesh.position.copy(newUnscaledPos);
      }

      if (this.engine.sceneManager && this.engine.sceneManager.renderer) {
          this.engine.sceneManager.renderer.render(
              this.engine.sceneManager.scene, 
              this.engine.sceneManager.camera
          );
      }
    });

    EventBus.on("admin:updateUIInputs", ({ x, y, z }) => {
      const activeObj = this.engine.gizmo?.activeEditObject;
      if (!activeObj) return;

      if (["door", "arrow", "ring"].includes(activeObj.userData.type)) {
        this.hsEditor.updateXYZ(x, y, z);
      } else {
        this.infoEditor.updateXYZ(x, y, z);
      }
    });

    EventBus.on("ui:infoScaleChanged", (newScale) => {
      const activeObj = this.engine.gizmo?.activeEditObject;
      const proxyMesh = this.engine.gizmo?.proxyMesh;
      if (
        activeObj &&
        !["door", "arrow", "ring"].includes(activeObj.userData.type)
      ) {
        const cameraPos = new THREE.Vector3(0, 1.6, 0);
        let originalDistance = 1;
        if (proxyMesh) {
          originalDistance = proxyMesh.position.distanceTo(cameraPos) || 1;
        }
        const vrScale = 400 / originalDistance;
        const finalScale = vrScale * newScale;

        activeObj.scale.set(finalScale, finalScale, finalScale);

        activeObj.userData.scale = newScale;
      }
    });

    EventBus.on("ui:infoColorChanged", (newColor) => {
      console.log("🎨 ได้รับค่า Color ใหม่:", newColor);
      const activeObj = this.engine.gizmo?.activeEditObject;

      if (activeObj) {
        activeObj.traverse((child) => {
          // เช็คว่าชิ้นส่วนนี้เป็น Mesh และมี Material ให้เปลี่ยนสีได้
          if (child.isMesh && child.material) {
            // ถ้า Material เป็นแบบ Array (โมเดลบางตัวมีหลายสี)
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                if (mat.color) {
                  mat.color.set(newColor);
                  mat.needsUpdate = true;
                }
              });
            } else if (child.material.color) {
              child.material.color.set(newColor);
              child.material.needsUpdate = true;
            }
          }
        });
        activeObj.userData.color = newColor;
      }
    });

    EventBus.on("ui:linkColorChanged", (newColor) => {
      const activeObj = this.engine.gizmo?.activeEditObject;

      if (
        activeObj &&
        ["door", "arrow", "ring"].includes(activeObj.userData.type)
      ) {
        activeObj.traverse((child) => {
          if (child.isMesh && child.material && child.material.color) {
            child.material.color.set(newColor);
          }
        });

        activeObj.userData.color = newColor;
      }
    });

    EventBus.on("ui:infoAngleChanged", (newAngle) => {
      console.log("📐 ได้รับค่า Angle ใหม่:", newAngle);
      const activeObj = this.engine.gizmo?.activeEditObject;

      if (activeObj) {
        activeObj.rotation.y = THREE.MathUtils.degToRad(newAngle);
        activeObj.userData.angle = newAngle;
      }
    });

    EventBus.on("ui:infoMediaUpdated", ({ path, type }) => {
      const activeObj = this.engine.gizmo?.activeEditObject;
      if (!activeObj) return;

      activeObj.userData.path = path;

      if (type === "image") {
        this.engine.hotspots.textureLoader.load(path, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          activeObj.traverse((child) => {
            if (child.isMesh && child.geometry.type === "PlaneGeometry") {
              if (child.material.map) child.material.map.dispose();
              child.material.map = tex;
              child.material.color.setHex(0xffffff); // ล้างสีเทาออก
              child.material.needsUpdate = true;

              // 🌟 ปรับอัตราส่วนภาพ (Aspect Ratio) ให้สมจริงอัตโนมัติ ภาพไม่ยืดไม่หด!
              const aspect = tex.image.width / tex.image.height;
              child.scale.set(1, 1 / aspect, 1);
            }
          });
        });
      } else if (type === "video") {
        const video = document.createElement("video");
        video.src = path;
        video.crossOrigin = "anonymous";
        video.loop = true;
        video.muted = true;
        video.play().catch((e) => console.warn(e));

        const tex = new THREE.VideoTexture(video);
        tex.colorSpace = THREE.SRGBColorSpace;

        activeObj.traverse((child) => {
          if (child.isMesh && child.geometry.type === "PlaneGeometry") {
            if (child.material.map) child.material.map.dispose();
            child.material.map = tex;
            child.material.color.setHex(0xffffff);
            child.material.needsUpdate = true;
          }
        });
      }
    });

    document.getElementById("tool-link")?.addEventListener("click", () => {
      const camera = this.engine.sceneManager.camera;
      const unscaledPos = TourMathUtils.getSpawnPosition(camera, 2);
      const selectedType =
        document.getElementById("link-type-select")?.value || "arrow";

      let hotspot = null;
      if (selectedType === "door") {
        hotspot = this.engine.hotspots.addDoorHotspot(
          "",
          unscaledPos.x,
          unscaledPos.y,
          unscaledPos.z,
          "#20CDFA",
        );
      } else if (selectedType === "ring") {
        hotspot = this.engine.hotspots.addRingJumpHotspot(
          "",
          unscaledPos.x,
          unscaledPos.y,
          unscaledPos.z,
        );
      } else if (selectedType === "arrow") {
        hotspot = this.engine.hotspots.addArrowHotspot(
          "",
          unscaledPos.x,
          unscaledPos.y,
          unscaledPos.z,
          "#20CDFA",
        );
      }

      if (hotspot) {
        hotspot.userData.isNewAdminElement = true;
        hotspot.userData.type = selectedType;
        hotspot.userData.targetID = "new_link_" + Date.now();
        hotspot.userData.unscaledPos = unscaledPos.clone();
        TourMathUtils.applyUnscaledPosToMesh(hotspot, unscaledPos);

        this.hsEditor.fillData({
          x: unscaledPos.x,
          y: unscaledPos.y,
          z: unscaledPos.z,
          type: selectedType,
          color: "#20CDFA",
        });
        this.hsEditor.openPanel();
        EventBus.emit("admin:attachGizmo", { mesh: hotspot });
      }

      if (window.lockLeftPanel) window.lockLeftPanel();
    });

    document
      .getElementById("link-type-select")
      ?.addEventListener("change", (e) => {
        const newType = e.target.value;
        const currentActiveObj = this.engine.gizmo?.activeEditObject;

        if (currentActiveObj && currentActiveObj.userData.isNewAdminElement) {
          const unscaledPos =
            currentActiveObj.userData.unscaledPos || new THREE.Vector3();
          const currentTargetID =
            currentActiveObj.userData.targetID || "new_link_" + Date.now();
          EventBus.emit("admin:detachGizmo");
          this.engine.sceneManager.scene.remove(currentActiveObj);

          let newHotspot = null;
          if (newType === "door") {
            newHotspot = this.engine.hotspots.addDoorHotspot(
              "",
              unscaledPos.x,
              unscaledPos.y,
              unscaledPos.z,
              "#20CDFA",
            );
          } else if (newType === "ring") {
            newHotspot = this.engine.hotspots.addRingJumpHotspot(
              "",
              unscaledPos.x,
              unscaledPos.y,
              unscaledPos.z,
            );
          } else if (newType === "arrow") {
            newHotspot = this.engine.hotspots.addArrowHotspot(
              "",
              unscaledPos.x,
              unscaledPos.y,
              unscaledPos.z,
              "#20CDFA",
            );
          }

          if (newHotspot) {
            newHotspot.userData.isNewAdminElement = true;
            newHotspot.userData.type = newType;
            newHotspot.userData.targetID = currentTargetID;
            newHotspot.userData.unscaledPos = unscaledPos.clone();
            TourMathUtils.applyUnscaledPosToMesh(newHotspot, unscaledPos);
            EventBus.emit("admin:attachGizmo", { mesh: newHotspot });
          }
        }
      });

    document
      .getElementById("btn-save-link")
      ?.addEventListener("click", async () => {
        const targetId = window.selectedTargetSceneId;
        if (!targetId) {
          alert("กรุณาเลือก Scene ปลายทาง (Link To) ก่อนบันทึก");
          return;
        }

        const activeObj = this.engine.gizmo?.activeEditObject;
        if (!activeObj) return;

        const formData = this.hsEditor.getFormData();
        const payload = {
          scene_id: this.state.currentScene.name,
          target_scene_id: targetId,
          ...formData,
        };

        try {
          if (activeObj.userData.isNewAdminElement) {
            const savedData = await this.api.createHotspot(payload);
            payload.id = savedData.data ? savedData.data._id : savedData._id;
            activeObj.userData.isNewAdminElement = false;
            activeObj.userData.dbId = payload.id;
            activeObj.userData.targetID = targetId;
            this.state.addHotspot(payload);
          } else {
            const dbId = activeObj.userData.dbId;
            await this.api.updateHotspot(dbId, payload);
            this.state.updateHotspot(dbId, payload);
          }

          this.hsEditor.closePanel();
          EventBus.emit("admin:detachGizmo");
          window.selectedTargetSceneId = null;
        } catch (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาดในการบันทึก");
        }

        document.getElementById("tool-link")?.classList.remove("hidden");
        document.getElementById("tool-info")?.classList.remove("hidden");
        if (window.unlockLeftPanel) window.unlockLeftPanel();
      });

    document
      .getElementById("btn-cancel-link")
      ?.addEventListener("click", () => {
        this.hsEditor.closePanel();
        const activeObj = this.engine.gizmo?.activeEditObject;
        EventBus.emit("admin:detachGizmo");

        if (activeObj) {
          if (activeObj.userData.isNewAdminElement) {
            this.engine.sceneManager.scene.remove(activeObj);
          } else {
            const dbId = activeObj.userData.dbId;
            const originalData = this.state.getHotspotById(dbId);
            if (originalData) {
              const oldPos = new THREE.Vector3(
                originalData.x,
                originalData.y,
                originalData.z,
              );
              if (!activeObj.userData.unscaledPos)
                activeObj.userData.unscaledPos = new THREE.Vector3();
              activeObj.userData.unscaledPos.copy(oldPos);
              TourMathUtils.applyUnscaledPosToMesh(activeObj, oldPos);
            }
          }
        }

        document.getElementById("tool-link")?.classList.remove("hidden");
        document.getElementById("tool-info")?.classList.remove("hidden");
        window.selectedTargetSceneId = null;
        if (window.unlockLeftPanel) window.unlockLeftPanel();
      });

    const spawnInfoMesh = (type, pos) => {
      let hotspot = null;
      const dummyPath = ""; // ตอนสร้างครั้งแรกปล่อยว่างไปก่อน

      if (type === "image_popup")
        hotspot = this.engine.hotspots.addImagePopupHotspot(
          dummyPath,
          pos.x,
          pos.y,
          pos.z,
        );
      else if (type === "video_popup")
        hotspot = this.engine.hotspots.addVideoPopupHotspot(
          dummyPath,
          pos.x,
          pos.y,
          pos.z,
        );
      else if (type === "model_popup")
        hotspot = this.engine.hotspots.add3DModelHotspot(
          dummyPath,
          pos.x,
          pos.y,
          pos.z,
        );
      else if (type === "image")
        hotspot = this.engine.hotspots.addImageHotspot(
          dummyPath,
          pos.x,
          pos.y,
          pos.z,
          0,
          1.5,
          0.9,
        );
      else if (type === "video")
        hotspot = this.engine.hotspots.addVideoHotspot(
          dummyPath,
          pos.x,
          pos.y,
          pos.z,
          0,
          1.5,
          0.9,
        );

      return hotspot;
    };

    document.getElementById("tool-info")?.addEventListener("click", () => {
      const camera = this.engine.sceneManager.camera;
      const unscaledPos = TourMathUtils.getSpawnPosition(camera, 2);
      const selectedType =
        document.getElementById("info-type-select")?.value || "image_popup";

      let hotspot = spawnInfoMesh(selectedType, unscaledPos);

      if (hotspot) {
        hotspot.userData.isNewAdminElement = true;
        hotspot.userData.type = selectedType;
        hotspot.userData.targetID = "new_info_" + Date.now();
        hotspot.userData.unscaledPos = unscaledPos.clone();
        TourMathUtils.applyUnscaledPosToMesh(hotspot, unscaledPos);

        this.infoEditor.fillData(
          {
            x: unscaledPos.x,
            y: unscaledPos.y,
            z: unscaledPos.z,
            type: selectedType,
            color: "#ffffff",
            scale: 1,
            path: "",
            sceneName: this.state.currentScene.name,
          },
          this.state.currentScene.name,
        );

        this.infoEditor.openPanel();
        EventBus.emit("admin:attachGizmo", { mesh: hotspot });
      }
      if (window.lockLeftPanel) window.lockLeftPanel();
    });

    document
      .getElementById("info-type-select")
      ?.addEventListener("change", (e) => {
        const newType = e.target.value;
        const currentActiveObj = this.engine.gizmo?.activeEditObject;

        if (currentActiveObj && currentActiveObj.userData.isNewAdminElement) {
          const unscaledPos =
            currentActiveObj.userData.unscaledPos || new THREE.Vector3();
          const currentTargetID =
            currentActiveObj.userData.targetID || "new_info_" + Date.now();

          EventBus.emit("admin:detachGizmo");
          this.engine.sceneManager.scene.remove(currentActiveObj);

          let newHotspot = spawnInfoMesh(newType, unscaledPos);

          if (newHotspot) {
            newHotspot.userData.isNewAdminElement = true;
            newHotspot.userData.type = newType;
            newHotspot.userData.targetID = currentTargetID;
            newHotspot.userData.unscaledPos = unscaledPos.clone();
            TourMathUtils.applyUnscaledPosToMesh(newHotspot, unscaledPos);
            EventBus.emit("admin:attachGizmo", { mesh: newHotspot });
          }
        }
      });

    document
      .getElementById("btn-save-info")
      ?.addEventListener("click", async () => {
        const activeObj = this.engine.gizmo?.activeEditObject;
        if (!activeObj) return;

        const formData = this.infoEditor.getFormData();

        if (!formData.path) {
          alert("⚠️ กรุณาอัปโหลดไฟล์ Media (รูป/วิดีโอ/โมเดล) ก่อนบันทึกครับ");
          return;
        }

        const payload = {
          scene_id: this.state.currentScene.name,
          ...formData,
        };

        try {
          if (activeObj.userData.isNewAdminElement) {
            const savedData = await this.api.createHotspot(payload);
            payload.id = savedData.data ? savedData.data._id : savedData._id;
            activeObj.userData.isNewAdminElement = false;
            activeObj.userData.dbId = payload.id;
            this.state.addHotspot(payload);
          } else {
            const dbId = activeObj.userData.dbId;
            await this.api.updateHotspot(dbId, payload);
            this.state.updateHotspot(dbId, payload);
          }

          activeObj.userData.type = formData.type;
          activeObj.userData.path = formData.path;

          this.infoEditor.closePanel();
          EventBus.emit("admin:detachGizmo");
          document.getElementById("tool-link")?.classList.remove("hidden");
          document.getElementById("tool-info")?.classList.remove("hidden");

          if (window.unlockLeftPanel) window.unlockLeftPanel();
        } catch (error) {
          console.error("Save Hotspot Error:", error);
        }
      });

    EventBus.on("admin:cancelMediaModal", () => {
      const targetMesh = this.engine.gizmo?.activeEditObject;

      EventBus.emit("admin:detachGizmo");

      if (!this.selectedExistingHotspot && targetMesh) {
        this.engine.hotspots.scene.remove(targetMesh);
        this.engine.hotspots._hotspots.delete(targetMesh.uuid);
      }

      this.tempInfoData = null;
      this.selectedExistingHotspot = null;
    });

    document
      .getElementById("btn-cancel-info")
      ?.addEventListener("click", () => {
        this.infoEditor.closePanel();
        const activeObj = this.engine.gizmo?.activeEditObject;
        EventBus.emit("admin:detachGizmo");

        if (activeObj) {
          if (activeObj.userData.isNewAdminElement) {
            this.engine.sceneManager.scene.remove(activeObj);
          } else {
            const dbId = activeObj.userData.dbId;
            const originalData = this.state.getHotspotById(dbId);
            if (originalData) {
              const oldPos = new THREE.Vector3(
                originalData.x,
                originalData.y,
                originalData.z,
              );
              if (!activeObj.userData.unscaledPos)
                activeObj.userData.unscaledPos = new THREE.Vector3();
              activeObj.userData.unscaledPos.copy(oldPos);
              TourMathUtils.applyUnscaledPosToMesh(activeObj, oldPos);
            }
          }
        }

        document
          .getElementById("map-editor-btn")
          ?.addEventListener("click", () => {
            setTimeout(() => {
              if (this.mapEditor) {
                this.mapEditor.renderPins(this.state.zones);
              }
            }, 50);
          });

        document.getElementById("tool-link")?.classList.remove("hidden");
        document.getElementById("tool-info")?.classList.remove("hidden");
        if (window.unlockLeftPanel) window.unlockLeftPanel();
      });

    document
      .getElementById("btn-set-start-rotation")
      ?.addEventListener("click", async () => {
        if (!this.state.currentScene) return;
        const camera = this.engine.sceneManager.camera;
        const finalAngle = TourMathUtils.getCameraYawAngle(camera);

        const btn = document.getElementById("btn-set-start-rotation");
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        btn.disabled = true;

        try {
          await this.api.updateSceneStartRotation(
            this.state.currentScene.name,
            finalAngle,
          );
          this.state.updateSceneStartRotation(
            this.state.currentScene.name,
            finalAngle,
          );
          alert(`✅ ตั้งค่ามุมมองเริ่มต้นห้องนี้เป็น ${finalAngle}° สำเร็จ!`);
        } catch (error) {
          console.error("Save Start Rotation Error:", error);
          alert("Failed to save start rotation. Please try again.");
        } finally {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }
      });

    this.tooltipUI.onGo(() => {
      if (!this.selectedExistingHotspot) return;
      const nextScene = this.state.getScene(
        this.selectedExistingHotspot.targetID,
      );
      if (nextScene) {
        this.engine.sceneManager.transitionTo(
          nextScene.image_path,
          nextScene.start_rotation,
          this.selectedExistingHotspot.angle,
          () => this.loadScene(nextScene, this.selectedExistingHotspot.angle),
        );
      }
    });

    this.tooltipUI.onEdit(() => {
      if (!this.selectedExistingHotspot) return;
      const targetID = this.selectedExistingHotspot.targetID;
      const allMeshes = this.engine.hotspots.getAll();
      const mesh = allMeshes.find((m) => m.userData.targetID === targetID);

      if (!mesh) return;

      const isLink = ["door", "arrow", "ring"].includes(mesh.userData.type);

      let hsData = isLink
        ? this.state.getHotspot(this.state.currentScene.name, targetID)
        : this.state.getHotspotById(mesh.userData.dbId);

      if (hsData && mesh) {
        mesh.userData.isNewAdminElement = false;
        mesh.userData.dbId = hsData.id || hsData._id;
        mesh.userData.type = hsData.type;
        mesh.userData.unscaledPos = new THREE.Vector3(
          hsData.x,
          hsData.y,
          hsData.z,
        );

        if (isLink) {
          this.hsEditor.fillData(hsData);
          window.selectedTargetSceneId = hsData.target_scene_id;
          const container = document.getElementById("linkto-list-container");
          if (container) {
            const cards = container.querySelectorAll(".scene-card");
            cards.forEach((card) => {
              if (
                card
                  .getAttribute("onclick")
                  .includes(`'${hsData.target_scene_id}'`)
              ) {
                card.classList.remove("border-white/20", "bg-white/10");
                card.classList.add("bg-primary", "border-primary");
              } else {
                card.classList.remove(
                  "ring-4",
                  "ring-primary",
                  "border-transparent",
                );
                card.classList.add("border-white/20");
              }
            });
          }
          this.hsEditor.openPanel();
        } else {
          this.infoEditor.fillData(hsData);
          this.infoEditor.openPanel();
        }

        EventBus.emit("admin:attachGizmo", { mesh: mesh });

        document.getElementById("tool-link")?.classList.add("hidden");
        document.getElementById("tool-info")?.classList.add("hidden");
        if (window.lockLeftPanel) window.lockLeftPanel();
      }
    });

    this.tooltipUI.onDelete(async () => {
      if (!this.selectedExistingHotspot) return;
      const targetID = this.selectedExistingHotspot.targetID;
      const allMeshes = this.engine.hotspots.getAll();
      const mesh = allMeshes.find((m) => m.userData.targetID === targetID);

      if (!mesh) return;

      const isLink = ["door", "arrow", "ring"].includes(mesh.userData.type);
      let hsData = isLink
        ? this.state.getHotspot(this.state.currentScene.name, targetID)
        : this.state.getHotspotById(mesh.userData.dbId);

      if (hsData) {
        const dbId = hsData.id || hsData._id;
        try {
          if (dbId) await this.api.deleteHotspot(dbId);

          if (isLink) {
            this.state.deleteHotspot(this.state.currentScene.name, targetID);
          } else {
            const index = this.state.hotspots.findIndex(
              (h) => h.id === dbId || h._id === dbId,
            );
            if (index !== -1) this.state.hotspots.splice(index, 1);
          }

          this.engine.sceneManager.scene.remove(mesh);
          this.engine.hotspots._hotspots.delete(mesh.uuid);
        } catch (error) {
          console.error("Delete Error:", error);
          alert("เกิดข้อผิดพลาดในการลบ");
        }
      }
    });

    this.engine.sceneManager.renderer.domElement.addEventListener(
      "click",
      () => {
        this.tooltipUI.hide();
      },
    );
  }

  setupZoneEvents() {
    EventBus.on("admin:createZone", async (payload) => {
      console.log("Creating zone with payload:", payload);
      try {
        if (this.api.createZone) {
          const newZone = await this.api.createZone(payload);
          const zoneData = newZone.data || newZone;

          this.state.addZone(zoneData);
          this.zoneEditor.renderZoneList(this.state.zones);
          this.zoneEditor.renderZoneDropdowns(this.state.zones);
          this.mapEditor.renderPins(this.state.zones);
        }
      } catch (error) {
        console.error("Create Zone Error:", error);
        alert("Failed to create zone. Please try again.");
      }
    });

    EventBus.on("admin:deleteZone", async (zoneName) => {
      try {
        if (this.api.deleteZone) {
          await this.api.deleteZone(zoneName);

          this.state.deleteZone(zoneName);
          this.zoneEditor.renderZoneList(this.state.zones);
          this.zoneEditor.renderZoneDropdowns(this.state.zones);
          this.mapEditor.renderPins(this.state.zones);
        }
      } catch (error) {
        console.error("Delete Zone Error:", error);
        alert("Failed to delete zone. Please try again.");
      }
    });

    EventBus.on("ui:refreshZones", () => {
      this.zoneEditor.renderZoneList(this.state.zones);
    });

    EventBus.on("admin:updateZone", async ({ id, name }) => {
      try {
        if (this.api.updateZone) await this.api.updateZone(id, name);
        this.state.updateZone(id, name);
        this.zoneEditor.renderZoneList(this.state.zones);
        this.zoneEditor.renderZoneDropdowns(this.state.zones);

        if (this.state.currentScene) {
          this.ui.updateNavBarStatus(
            this.state.currentScene.zone,
            this.state.visitedZones,
            this.state.navPoints,
          );
        }
      } catch (error) {
        console.error(error);
        alert("อัปเดตชื่อโซนไม่สำเร็จ");
      }
    });

    EventBus.on("admin:reorderZones", async (orderedNames) => {
      try {
        if (this.api.reorderZones) await this.api.reorderZones(orderedNames);
        this.state.reorderZones(orderedNames);
        this.zoneEditor.renderZoneList(this.state.zones);
        this.zoneEditor.renderZoneDropdowns(this.state.zones);

        if (this.state.currentScene) {
          this.ui.updateNavBarStatus(
            this.state.currentScene.zone,
            this.state.visitedZones,
            this.state.navPoints,
          );
        }
      } catch (error) {
        console.error(error);
        alert("บันทึกลำดับไม่สำเร็จ");
      }
    });
  }

  setupMapEvents() {
    EventBus.on("map:pinMoved", async ({ zoneName, x, y }) => {
      try {
        const zone = this.state.getZoneById(zoneName);
        if (zone) {
          zone.position.map_x = x;
          zone.position.map_y = y;
        }

        if (this.api.updateZoneMapPosition) {
          await this.api.updateZoneMapPosition(zoneName, x, y);
        }
      } catch (error) {
        console.error("Failed to update map position:", error);
        alert("Failed to update map position. Please try again.");
      }
    });

    EventBus.on("map:pinDoubleClicked", ({ zoneName }) => {
      const targetZone = this.state.getZoneById(zoneName);
      if (targetZone) {
        document.getElementById("mode-map").classList.add("hidden");
        document.getElementById("mode-scene").classList.remove("hidden");

        this.engine.sceneManager.transitionTo(
          targetZone.image_path,
          targetZone.start_rotation,
          0,
          () => this.loadScene(targetZone, 0),
        );
      }
    });

    // 🌟 ระบบอัปโหลดแผนที่ใหม่
    const btnUploadMap = document.getElementById("btn-upload-map");
    const mapUploadInput = document.getElementById("map-upload-input");
    const mapImage = document.getElementById("map-image");

    btnUploadMap?.addEventListener("click", () => {
      mapUploadInput?.click(); // สั่งคลิก input ที่ซ่อนอยู่
    });

    mapUploadInput?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // เปลี่ยนหน้าตาปุ่มเป็นกำลังโหลด
      const originalHTML = btnUploadMap.innerHTML;
      btnUploadMap.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[18px]"></i><span class="font-semibold text-lg">Uploading...</span>`;
      btnUploadMap.disabled = true;

      try {
        const formData = new FormData();
        formData.append("sceneName", "map_background"); // หรือชื่อที่ API คุณตั้งไว้
        formData.append("media", file);

        // ใช้ API ยิงอัปโหลดแบบเดียวกับของ Hotspot (แก้ไข URL ให้ตรงกับเครื่องคุณ)
        const res = await fetch("https://localhost:3443/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        if (data.filePath) {
          // อัปเดตรูปแผนที่บนจอทันที
          if (mapImage) mapImage.src = data.filePath;
          alert("✅ เปลี่ยนรูปแผนที่สำเร็จ!");
        }
      } catch (error) {
        console.error("Map upload error:", error);
        alert("❌ เกิดข้อผิดพลาดในการอัปโหลดรูปแผนที่");
      } finally {
        // คืนค่าปุ่มกลับมาเหมือนเดิม
        btnUploadMap.innerHTML = originalHTML;
        btnUploadMap.disabled = false;
        mapUploadInput.value = "";
      }
    });
  }

  loadScene(sceneData, angle) {
    this.state.setCurrentScene(sceneData);
    this.ui.updateNavBarStatus(
      sceneData.zone,
      this.state.visitedZones,
      this.state.navPoints,
    );
    this.engine.hotspots.clearAll();

    const currentHotspots = this.state.getHotspotsForCurrentScene();

    currentHotspots.forEach((hs) => {
      let mesh = null;

      switch (hs.type) {
        case "door":
          mesh = this.engine.hotspots.addDoorHotspot(
            hs.target_scene_id,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "arrow":
          mesh = this.engine.hotspots.addArrowHotspot(
            hs.target_scene_id,
            hs.x,
            hs.y,
            hs.z,
          );
          break;
        case "ring":
          mesh = this.engine.hotspots.addRingJumpHotspot(
            hs.target_scene_id,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "image_popup":
          mesh = this.engine.hotspots.addImagePopupHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "video_popup":
          mesh = this.engine.hotspots.addVideoPopupHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "model_popup":
          mesh = this.engine.hotspots.add3DModelHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "image":
          mesh = this.engine.hotspots.addImageHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.angle,
            hs.width || 1.5,
            hs.height || 0.9,
          );
          break;
        case "video":
          mesh = this.engine.hotspots.addVideoHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.angle,
            hs.width || 1.5,
            hs.height || 0.9,
          );
          break;
      }

      if (mesh) {
        mesh.userData.dbId = hs.id || hs._id;
        mesh.userData.type = hs.type;
        mesh.userData.unscaledPos = new THREE.Vector3(hs.x, hs.y, hs.z);
        mesh.userData.targetID = hs.target_scene_id || hs.id || hs._id;
        mesh.userData.path = hs.path;

        if (
          typeof TourMathUtils !== "undefined" &&
          TourMathUtils.applyUnscaledPosToMesh
        ) {
          TourMathUtils.applyUnscaledPosToMesh(mesh, mesh.userData.unscaledPos);
        }

        const savedScale = hs.scale !== undefined ? hs.scale : 1;
        mesh.scale.multiplyScalar(savedScale);
        mesh.userData.scale = savedScale;

        mesh.userData.angle = hs.angle || 0;
        if (["image", "video"].includes(hs.type)) {
          mesh.rotation.y = THREE.MathUtils.degToRad(mesh.userData.angle);
        }

        if (hs.color) {
          mesh.traverse((c) => {
            if (c.isMesh && c.material) {
              if (Array.isArray(c.material)) {
                c.material.forEach((mat) => {
                  if (mat.color) mat.color.set(hs.color);
                });
              } else if (c.material.color) {
                c.material.color.set(hs.color);
              }
            }
          });
          mesh.userData.color = hs.color;
        }
      }
    });
  }
}

window.tourApp = new TourApp();
