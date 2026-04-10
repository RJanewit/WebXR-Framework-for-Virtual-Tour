// js/tourMain.js
import * as THREE from "three";
import { TourEngine } from "./TourEngine.js";
import { GLTFLoader } from "GLTFLoader";
import { OrbitControls } from "OrbitControls";
import { UIManager } from "./UIManager.js";

class TourApp {
  constructor() {
    this.engine = new TourEngine();
    this.ui = new UIManager();

    this.scenesData = [];
    this.hotspotsData = [];
    this.visitedZones = new Set();
    this.preloadedImages = new Set();


    // ข้อมูลจุด Navbar (ย้ายมาจากหน้า HTML)
    this.navPoints = [
      {
        zoneName: "ECE Department",
        htmlId: "ECE_Department",
        targetId: "zone1",
        label: "ECE Department",
      },
      {
        zoneName: "ECE Laboratory",
        htmlId: "ECE_Laboratory",
        targetId: "zone2",
        label: "ECE Laboratory",
      },
            {
        zoneName: "Electronics Laboratory",
        htmlId: "Electronics_Laboratory",
        targetId: "zone3",
        label: "Electronics Laboratory",
      },
            {
        zoneName: "Fundamental Laboratory",
        htmlId: "Fundamental_Laboratory",
        targetId: "zone5",
        label: "Fundamental Laboratory",
      },
    ];

    this.init();
  }

  async init() {
    try {
      // โหลดข้อมูล JSON
      const [scenesRes, hotspotsRes] = await Promise.all([
        fetch("/api/scenes"),
        fetch("/api/hotspots"),
      ]);

      if (!scenesRes.ok || !hotspotsRes.ok)
        throw new Error("หาไฟล์ JSON ไม่เจอ");

      this.scenesData = await scenesRes.json();
      this.hotspotsData = await hotspotsRes.json();

      this.createNavBar();
      this.engine.init(); // เริ่ม 3D Engine
      this.setupEngineEvents();

      // โหลดฉากแรก
      const firstScene =
        this.scenesData.find((z) => z._id === "zone3") ||
        this.scenesData[0];
      if (firstScene) {
        this.engine.loadPanorama(
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

  

  createNavBar() {
    const navBar = document.getElementById("nav-bar");
    navBar.innerHTML = "";
    this.navPoints.forEach((point) => {
      const dot = document.createElement("div");
      dot.className = "nav-dot";
      dot.id = `nav-${point.htmlId}`;
      dot.setAttribute("data-label", point.label);

      dot.addEventListener("click", () => {
        const targetZone = this.scenesData.find(
          (z) => z._id === point.targetId,
        );
        if (targetZone && this.engine)
          this.engine.onHotspotClick(point.targetId, 0);
      });
      navBar.appendChild(dot);
    });
  }

  setupEngineEvents() {
    // วาร์ปเปลี่ยนฉาก
    this.engine.onHotspotClick = (targetID, angle) => {
      const nextScene = this.scenesData.find((z) => z._id === targetID);
      if (nextScene) {
        this.engine.transitionTo(
          nextScene.image_path,
          nextScene.start_rotation,
          angle,
          () => {
            this.loadScene(nextScene, angle);
          },
        );
      }
    };

    // กดดูรูป / วิดีโอ
    this.engine.onImagePopupClick = (imageUrl) =>
      this.ui.showImagePopup(imageUrl);
    this.engine.onVideoPopupClick = (videoUrl) =>
      this.ui.showVideoPopup(videoUrl);

    // กดดูโมเดล 3D
    this.engine.onModelHotspotClick = (modelPath) => {
      // ถ้าน้องมีฟังก์ชัน showModelViewer ของเดิม ย้ายมาใส่ในนี้ได้เลย
      this.ui.showModelViewer();
      console.log("Viewing model:", modelPath);
    };
  }

  loadScene(sceneData, angle) {
    // อัปเดต Nav Bar
    this.visitedZones.add(sceneData.zone);
    this.ui.updateNavBarStatus(
      sceneData.zone,
      this.visitedZones,
      this.navPoints,
    );

    // วาด Hotspot ใหม่
    const currentHotspots = this.hotspotsData.filter(
      (h) => h.scene_id === sceneData._id,
    );
    currentHotspots.forEach((hs) => {
      switch (hs.type) {
        case "door":
          this.engine.addDoorHotspot(
            hs.target_scene_id,
            hs.x,
            hs.y,
            hs.z,
            hs.color,
          );
          break;
        case "arrow":
          this.engine.addHotspot(
            hs.target_scene_id,
            hs.angle,
            hs.radius || 1.5,
          );
          console.log("Adding arrow hotspot to", hs.target_scene_id, "at angle", hs.angle);
          break;
        case "ring":
          this.engine.addRingJumpHotspot(hs.target_scene_id, hs.x, hs.z);
          break;
        case "image":
          const w = hs.width || 1.5;
          const h = hs.height || 0.9;
          this.engine.addImageHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.angle,
            w,
            h,
          );
          break;
        case "image_popup":
          this.engine.addImagePopupHotspot(hs.path, hs.x, hs.y, hs.z);
          break;
        case "video_popup":
          this.engine.addVideoPopupHotspot(hs.path, hs.x, hs.y, hs.z);
          break;
        case "model_popup":
          this.engine.addModelHotspot(hs.path, hs.x, hs.y, hs.z);
          break;
        case "video":
          this.engine.addVideoHotspot(
            hs.path,
            hs.x,
            hs.y,
            hs.z,
            hs.angle,
            hs.width,
            hs.height,
          );
          break;
      }
    });
  }
}

window.tourApp = new TourApp();
