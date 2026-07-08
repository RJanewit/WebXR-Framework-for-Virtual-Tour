import * as THREE from "three";
import { TourEngine } from "./shared/TourEngine.js";
import { UIManager } from "./ui/UIManager.js";
import { EventBus } from "./utils/EventBus.js";
import { TourMathUtils } from "./shared/TourMathUtils.js";

class TourApp {
  constructor() {
    this.engine = new TourEngine();
    this.ui = new UIManager();

    this.scenesData = [];
    this.hotspotsData = [];
    this.zonesData = [];
    this.visitedZones = new Set();

    this.navPoints = [];

    this.firstscene = "entrance1";

    this.init();
  }

  async init() {
    try {
      const [scenesRes, hotspotsRes, zonesRes] = await Promise.all([
        fetch("/api/scenes"),
        fetch("/api/hotspots"),
        fetch("/api/zones"),
      ]);

      if (!scenesRes.ok || !hotspotsRes.ok || !zonesRes.ok)
        throw new Error("หาไฟล์ JSON ไม่เจอ");

      this.scenesData = await scenesRes.json();
      this.hotspotsData = await hotspotsRes.json();
      this.zonesData = await zonesRes.json();

      this.createNavBarAndMap();
      this.engine.init();

      this.ui.initMediaModals();

      this.setupEvents();

      if (this.engine.audio) {
        this.engine.audio.play("assets/audio/factory-bgm.mp3");
      } else {
        console.error(
          "Failed to initialize AudioManager or play background music.",
        );
      }

      const firstScene =
        this.scenesData.find((z) => z.name === this.firstscene) ||
        this.scenesData[0];
      if (firstScene) {
        this.engine.sceneManager.loadPanorama(
          firstScene.image_path,
          firstScene.start_rotation,
        );
        this.loadScene(firstScene, 0);
      }

      this.ui.hideLoading();
    } catch (error) {
      console.error("Initialization error:", error);
      document.getElementById("loading-text").innerText =
        "โหลดข้อมูลล้มเหลว: " + error.message;
    }
  }

  createNavBarAndMap() {
    const navBar = document.getElementById("nav-bar");
    const mapContainer =
      document.querySelector("#map-overlay img")?.parentElement;

    if (navBar) navBar.innerHTML = "";
    if (mapContainer)
      mapContainer.querySelectorAll(".map-dot").forEach((dot) => dot.remove());

    this.zonesData.forEach((zone) => {
      const targetSceneId = zone.target_scene;
      const labelName = zone.name;

      this.navPoints.push({
        zoneName: labelName,
        htmlId: targetSceneId,
        targetId: targetSceneId,
        label: labelName,
      });

      if (navBar) {
        const dot = document.createElement("div");
        dot.className = "nav-dot";
        dot.id = `nav-${targetSceneId}`;
        dot.setAttribute("data-label", labelName);

        dot.addEventListener("click", () => {
          EventBus.emit("interaction:hotspotClick", {
            targetID: targetSceneId,
            angle: 0,
          });
        });
        navBar.appendChild(dot);
      }

      if (
        mapContainer &&
        zone.position &&
        zone.position.map_x &&
        zone.position.map_y
      ) {
        const mapPin = document.createElement("div");
        mapPin.className = "map-dot";
        mapPin.id = `map-pin-${targetSceneId}`;
        mapPin.title = labelName;
        mapPin.style.left = `${zone.position.map_x}%`;
        mapPin.style.top = `${zone.position.map_y}%`;

        mapPin.addEventListener("click", () => {
          EventBus.emit("interaction:hotspotClick", {
            targetID: targetSceneId,
            angle: 0,
          });

          const mapOverlay = document.getElementById("map-overlay");
          if (mapOverlay) {
            mapOverlay.style.opacity = "0";
            setTimeout(() => {
              mapOverlay.style.display = "none";
            }, 400);
          }
        });
        mapContainer.appendChild(mapPin);
      }
    });
  }

  updateMapActivePin(sceneData) {
    // 1. ล้างสถานะ active (ลบคลาส current-location) ออกจากทุกจุดบนแผนที่ก่อน
    const allPins = document.querySelectorAll(".map-dot");
    allPins.forEach((pin) => {
      pin.classList.remove("current-location");
    });

    // 2. หาว่า Scene ปัจจุบันอยู่ใน Zone อะไร
    const currentZone = this.zonesData.find((z) => z.name === sceneData.zone);

    // 3. ถ้าเจอโซน ให้เอาไปเทียบหาจุดบนแผนที่แล้วใส่คลาสกระพริบให้มัน
    if (currentZone) {
      const activePin = document.getElementById(
        `map-pin-${currentZone.target_scene}`,
      );
      if (activePin) {
        // ใช้คลาส current-location ที่คุณเขียน CSS เตรียมไว้แล้วใน tour.html
        activePin.classList.add("current-location");
      }
    }
  }

  setupEvents() {
    EventBus.on("interaction:hotspotClick", ({ targetID, angle }) => {
      const nextScene = this.scenesData.find((z) => z.name === targetID);
      if (nextScene) {
        this.engine.sceneManager.transitionTo(
          nextScene.image_path,
          nextScene.start_rotation,
          angle,
          () => this.loadScene(nextScene, angle),
        );
      }
    });

    EventBus.on("interaction:popupClick", ({ imageUrl }) =>
      this.ui.showImagePopup(imageUrl),
    );
    EventBus.on("interaction:videoPopupClick", ({ videoUrl }) =>
      this.ui.showVideoPopup(videoUrl),
    );
    EventBus.on("interaction:modelClick", ({ modelPath }) =>
      this.ui.showModelViewer(modelPath),
    );
  }

  loadScene(sceneData, angle) {
    this.visitedZones.add(sceneData.zone);
    this.ui.updateNavBarStatus(
      sceneData.zone,
      this.visitedZones,
      this.navPoints,
    );

    this.updateMapActivePin(sceneData);

    this.engine.hotspots.clearAll();

    const currentHotspots = this.hotspotsData.filter(
      (h) => h.scene_id === sceneData.name,
    );
    console.log(
      `Loading Scene: ${sceneData.name} with ${currentHotspots.length} hotspots.`,
    );

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
      }

      if (mesh) {
        mesh.userData.dbId = hs.id || hs._id;
        mesh.userData.type = hs.type;
        mesh.userData.unscaledPos = new THREE.Vector3(hs.x, hs.y, hs.z);
        mesh.userData.targetID = hs.target_scene_id || hs.id || hs._id;
        mesh.userData.path = hs.path;

        // 2. ผลักป้ายไปที่กำแพง (จัดพิกัด)
        if (
          typeof TourMathUtils !== "undefined" &&
          TourMathUtils.applyUnscaledPosToMesh
        ) {
          TourMathUtils.applyUnscaledPosToMesh(mesh, mesh.userData.unscaledPos);
        }

        // 3. ปรับขนาดสเกลตามฐานข้อมูล
        const savedScale = hs.scale !== undefined ? hs.scale : 1;
        mesh.scale.multiplyScalar(savedScale);
        mesh.userData.scale = savedScale;

        // 4. หมุนองศาให้ขนานกับผนัง (เฉพาะ Image/Video)
        mesh.userData.angle = hs.angle || 0;
        if (["image", "video"].includes(hs.type)) {
          mesh.rotation.y = THREE.MathUtils.degToRad(mesh.userData.angle);
        }

        // 5. ลงสีให้โมเดล
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
