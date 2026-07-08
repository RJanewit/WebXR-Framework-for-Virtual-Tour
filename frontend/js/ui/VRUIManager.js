import * as THREE from "three";
import { EventBus } from "../utils/EventBus.js";

export class VRUIManager {
  constructor(renderer, camera) {
    this.camera = camera;
    this.renderer = null;

    this.vrSoundBtn = null;
    this.vrHomeBtn = null;
    this.vrLangBtn = null;
    this.guidePlaneVR = null;
    this.closeBtnVR = null;

    this.vrMenuPopup = null;
    this.menuInteractables = [];

    this.wristBtn = null;

    this.texSoundOn_Canvas = null;
    this.texSoundOff_Canvas = null;

    this.currentLang = localStorage.getItem("tourLang") || "th";
    this.isSoundMuted = localStorage.getItem("tourAudioMuted") === "true";

    this.vrOverlay = null;
    this.vrMediaPopup = null;
    this.vrMediaMesh = null; // แผ่นสำหรับแปะรูป/วิดีโอ
    this.vrVideoEl = null; // ตัวเล่นวิดีโอ
    this.isMediaPopupOpen = false;
    this.popupInteractables = []; // เก็บปุ่มปิด
  }

  init() {
    this._buildGuide();
    this._buildSoundBtn();
    this._buildHomeBtn();
    this._buildLangBtn();
    this._buildWristBtn();
    this._buildMainMenuPopup();
    this._buildMediaPopupVR();

    EventBus.on("xr:sessionStart", () => this._showButtons());
    EventBus.on("xr:sessionEnd", () => this._hideButtons());
    EventBus.on("audio:muteChanged", ({ muted }) =>
      this._updateSoundIcon(muted),
    );
    EventBus.on("ui:langChanged", ({ lang }) => this._updateLangIcon(lang));

    EventBus.on("ui:showGuide", () => this.showGuide());

    EventBus.on("ui:toggleMainMenu", ({ scene }) => this.toggleMainMenu(scene));
    EventBus.on("ui:closeMainMenu", () => {
      if (this.vrMenuPopup) this.vrMenuPopup.visible = false;
    });

    EventBus.on("interaction:popupClick", ({ imageUrl }) =>
      this.showMediaPopupVR(imageUrl, "image"),
    );
    EventBus.on("interaction:videoPopupClick", ({ videoUrl }) =>
      this.showMediaPopupVR(videoUrl, "video"),
    );
    EventBus.on("ui:closeMediaPopupVR", () => this.closeMediaPopupVR());

    EventBus.on("xr:setupWristUI", ({ controller }) => {
      controller.add(this.wristBtn);
    });
  }

  // 🌟 1. สร้างโครงสร้าง Popup
  _buildMediaPopupVR() {
    // A: สร้างฉากหลังมืด (Overlay) ทรงกลมครอบตัวผู้ใช้
    const overlayGeo = new THREE.SphereGeometry(50, 32, 32);
    const overlayMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.85,
      side: THREE.BackSide,
    });
    this.vrOverlay = new THREE.Mesh(overlayGeo, overlayMat);
    this.vrOverlay.visible = false;
    this.camera.parent.add(this.vrOverlay); // แปะไว้ที่ Scene

    this.vrMediaPopup = new THREE.Group();
    this.vrMediaPopup.visible = false;

    // B: กรอบสีส้ม (Background Frame)
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 1024;
    bgCanvas.height = 768;
    const bgCtx = bgCanvas.getContext("2d");
    bgCtx.fillStyle = "#E86C27"; // สีส้มตามรูป
    bgCtx.beginPath();
    bgCtx.roundRect(0, 0, 1024, 768, 40);
    bgCtx.fill();

    const bgTex = new THREE.CanvasTexture(bgCanvas);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.2),
      new THREE.MeshBasicMaterial({
        map: bgTex,
        transparent: true,
        depthTest: false,
      }),
    );
    bgMesh.renderOrder = 9998;
    this.vrMediaPopup.add(bgMesh);

    // C: แผ่นสีดำตรงกลางสำหรับโชว์รูป/วิดีโอ (Media Mesh)
    this.vrMediaMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.95), // ขนาดเล็กกว่ากรอบนิดนึง
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        depthTest: false,
      }),
    );
    this.vrMediaMesh.position.set(0, -0.05, 0.01); // ดันมาข้างหน้ากรอบส้ม
    this.vrMediaMesh.renderOrder = 9999;
    this.vrMediaPopup.add(this.vrMediaMesh);

    // D: ปุ่มกากบาทสีแดงมุมขวาบน
    const closeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      new THREE.MeshBasicMaterial({
        map: this._createCloseIconTex(),
        transparent: true,
        depthTest: false,
      }),
    );
    closeMesh.position.set(0.75, 0.55, 0.02); // มุมขวาบน
    closeMesh.renderOrder = 10000;
    closeMesh.userData = { isVRUI: true, action: "closeMediaPopup" };
    this.vrMediaPopup.add(closeMesh);

    this.popupInteractables.push(closeMesh);
    this.camera.parent.add(this.vrMediaPopup);
  }

  showMediaPopupVR(url, type) {
    // 🌟 2. ดักไว้เลยว่า "ถ้าไม่ได้อยู่ในโหมด VR" ให้หยุดการทำงาน (ปล่อยให้ HTML ทำงานไป)
    if (!this.renderer || !this.renderer.xr || !this.renderer.xr.isPresenting) return;

    this.isMediaPopupOpen = true;
    this.vrOverlay.visible = true;
    this.vrMediaPopup.visible = true;

    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    this.vrMediaPopup.position.copy(camPos).add(camDir.multiplyScalar(1.5));
    this.vrMediaPopup.position.y = camPos.y;
    this.vrMediaPopup.lookAt(camPos);

    if (this.vrMediaMesh.material.map) {
      this.vrMediaMesh.material.map.dispose();
      this.vrMediaMesh.material.map = null;
    }

    if (type === "image") {
      new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.vrMediaMesh.material.map = tex;
        // 🌟 3. เปลี่ยนสีแผ่นรองให้เป็นสีขาว ภาพจะได้ไม่เป็นสีดำ
        this.vrMediaMesh.material.color.setHex(0xffffff);
        this.vrMediaMesh.material.needsUpdate = true;
      });
    } else if (type === "video") {
      if (!this.vrVideoEl) {
        this.vrVideoEl = document.createElement("video");
        this.vrVideoEl.crossOrigin = "anonymous";
        this.vrVideoEl.loop = true;
      }
      this.vrVideoEl.src = url;
      this.vrVideoEl.play();

      const tex = new THREE.VideoTexture(this.vrVideoEl);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.vrMediaMesh.material.map = tex;
      // 🌟 4. เปลี่ยนสีแผ่นรองให้เป็นสีขาวเช่นกัน
      this.vrMediaMesh.material.color.setHex(0xffffff);
      this.vrMediaMesh.material.needsUpdate = true;
    }
  }

  closeMediaPopupVR() {
    this.isMediaPopupOpen = false;
    this.vrOverlay.visible = false;
    this.vrMediaPopup.visible = false;

    // 🌟 5. รีเซ็ตแผ่นกลับเป็นสีดำ เพื่อไม่ให้เห็นแผ่นสี่เหลี่ยมสีขาวแวบขึ้นมาตอนเปิดรอบหน้า
    if (this.vrMediaMesh) {
      this.vrMediaMesh.material.color.setHex(0x000000);
    }

    if (this.vrVideoEl) {
      this.vrVideoEl.pause();
      this.vrVideoEl.src = "";
    }
  }

  _showButtons() {
    if (this.vrSoundBtn) this.vrSoundBtn.visible = true;
    if (this.vrHomeBtn) this.vrHomeBtn.visible = true;
    if (this.vrLangBtn) this.vrLangBtn.visible = true;
  }

  _hideButtons() {
    if (this.vrSoundBtn) this.vrSoundBtn.visible = false;
    if (this.vrHomeBtn) this.vrHomeBtn.visible = false;
    if (this.vrLangBtn) this.vrLangBtn.visible = false;
  }

  _buildGuide() {
    const uiLoader = new THREE.TextureLoader();
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

      this.closeBtnVR.userData = { isVRUI: true, action: "hideGuide" };

      this.guidePlaneVR.add(this.closeBtnVR);
      this.closeBtnVR.position.set(0.82, 0.42, 0.02);
      this.closeBtnVR.renderOrder = 10000;

      if (this.camera) this.camera.add(this.guidePlaneVR);
    });

    setTimeout(() => this.hideGuide(), 7000);
  }

  hideGuide() {
    if (this.guidePlaneVR) this.guidePlaneVR.visible = false;
  }

  showGuide() {
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

  _buildSoundBtn() {
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

    this.vrSoundBtn.userData = { isVRUI: true, action: "toggleSound" };
    this.camera.add(this.vrSoundBtn);
  }

  _buildWristBtn() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // วาดวงกลมสีส้ม
    ctx.fillStyle = "#E86C27";
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();

    // ใส่คำว่า MENU
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MENU", 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    this.wristBtn = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.08), // ขนาด 8 เซนติเมตร (กำลังดีไม่บังตา)
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );

    // หมุนแกน X ให้ปุ่ม "หงายขึ้น" รับกับสายตาเวลาผู้ใช้ยกแขนขึ้นมาดูนาฬิกา
    this.wristBtn.rotation.x = -Math.PI / 2;

    // ขยับพิกัดให้อยู่ตรง "หลังมือ/ข้อมือ" พอดี (Z = ถอยมาที่ข้อมือ, Y = ลอยขึ้นมานิดนึง)
    this.wristBtn.position.set(0, 0.1, 0.05);
    this.wristBtn.renderOrder = 9999;

    // ฝัง Action ไว้ให้ Raycaster ยิงโดนแล้วสั่งเปิดเมนู
    this.wristBtn.userData = { isVRUI: true, action: "toggleMainMenu" };

  }

  // 🌟 5. อย่าลืมเพิ่มปุ่มข้อมือเข้าไปใน List ให้ Raycaster มองเห็นด้วยนะครับ!
  getInteractables() {
    const items = [
      this.vrSoundBtn,
      this.vrHomeBtn,
      this.vrLangBtn,
      this.wristBtn, // <--- แอบเพิ่มปุ่มข้อมือเข้าตรงนี้
      this.closeBtnVR && this.guidePlaneVR.visible ? this.closeBtnVR : null,
    ];

    if (this.vrMenuPopup && this.vrMenuPopup.visible) {
      items.push(...this.menuInteractables);
    }

    return items.filter(Boolean);
  }

  _buildHomeBtn() {
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

    this.vrHomeBtn.userData = { isVRUI: true, action: "goHome" };
    this.camera.add(this.vrHomeBtn);
  }

  _buildLangBtn() {
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

    this.vrLangBtn.userData = { isVRUI: true, action: "toggleLang" };
    this.camera.add(this.vrLangBtn);
  }

  _updateSoundIcon(isMuted) {
    this.isSoundMuted = isMuted;
    if (this.vrSoundBtn) {
      this.vrSoundBtn.material.map = isMuted
        ? this.texSoundOff_Canvas
        : this.texSoundOn_Canvas;
      this.vrSoundBtn.material.needsUpdate = true;
    }
  }

  _updateLangIcon(lang) {
    this.currentLang = lang;
    if (this.vrLangBtn) {
      this.vrLangBtn.material.map = this.createLanguageTexture(lang);
      this.vrLangBtn.material.needsUpdate = true;
    }
  }

  getInteractables() {
    return [
      this.vrSoundBtn,
      this.vrHomeBtn,
      this.vrLangBtn,
      this.closeBtnVR && this.guidePlaneVR.visible ? this.closeBtnVR : null,
    ].filter(Boolean);
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

  _buildMainMenuPopup() {
    this.vrMenuPopup = new THREE.Group();
    this.vrMenuPopup.visible = false;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 800;
    bgCanvas.height = 600;
    const bgCtx = bgCanvas.getContext("2d");
    bgCtx.fillStyle = "#E86C27";
    bgCtx.beginPath();
    bgCtx.roundRect(0, 0, 800, 600, 40);
    bgCtx.fill();

    bgCtx.fillStyle = "white";
    bgCtx.font = 'bold 80px "Prompt", sans-serif';
    bgCtx.textAlign = "center";
    bgCtx.fillText("เมนู", 400, 120);

    const bgTex = new THREE.CanvasTexture(bgCanvas);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.9),
      new THREE.MeshBasicMaterial({
        map: bgTex,
        transparent: true,
        depthTest: false,
      }),
    );
    bgMesh.renderOrder = 9998;
    this.vrMenuPopup.add(bgMesh);

    const createBtn = (iconText, x, y, bgCol, textCol, action) => {
      const btnCanvas = document.createElement("canvas");
      btnCanvas.width = 140;
      btnCanvas.height = 140;
      const ctx = btnCanvas.getContext("2d");
      ctx.fillStyle = bgCol;
      ctx.beginPath();
      ctx.roundRect(0, 0, 140, 140, 20);
      ctx.fill();

      ctx.fillStyle = textCol;
      ctx.font = "70px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(iconText, 70, 75);

      const btnTex = new THREE.CanvasTexture(btnCanvas);
      btnTex.colorSpace = THREE.SRGBColorSpace;
      const btnMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.2),
        new THREE.MeshBasicMaterial({
          map: btnTex,
          transparent: true,
          depthTest: false,
        }),
      );

      btnMesh.position.set(x, y, 0.01);
      btnMesh.renderOrder = 9999;

      btnMesh.userData = { isVRUI: true, action: action };

      this.vrMenuPopup.add(btnMesh);
      this.menuInteractables.push(btnMesh);
    };

    createBtn("🗺️", -0.3, 0.05, "#E0E0E0", "black", "openMap");
    createBtn("🏠", 0, 0.05, "#E0E0E0", "black", "goHome");
    createBtn("🔊", 0.3, 0.05, "#E0E0E0", "black", "toggleSound");
    createBtn("🚪", 0, -0.25, "#B00000", "white", "exitVR");

    const closeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshBasicMaterial({
        map: this._createCloseIconTex(),
        transparent: true,
        depthTest: false,
      }),
    );
    closeMesh.position.set(0.5, 0.35, 0.01);
    closeMesh.renderOrder = 9999;
    closeMesh.userData = { isVRUI: true, action: "closeMainMenu" };
    this.vrMenuPopup.add(closeMesh);
    this.menuInteractables.push(closeMesh);
  }

  _createCloseIconTex() {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#C00000";
    ctx.beginPath();
    ctx.arc(40, 40, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "bold 50px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", 40, 45);
    return new THREE.CanvasTexture(canvas);
  }

  toggleMainMenu(scene) {
    if (!this.vrMenuPopup) return;

    this.vrMenuPopup.visible = !this.vrMenuPopup.visible;
    console.log("📢 สั่งเปิด/ปิดเมนู! สถานะ:", this.vrMenuPopup.visible);

    if (this.vrMenuPopup.visible) {
      // 1. ดึงตำแหน่งที่แท้จริงของหัวผู้ใช้ในโลก 3D (World Space)
      const camPos = new THREE.Vector3();
      this.camera.getWorldPosition(camPos);

      // 2. ดึงทิศทางที่ผู้ใช้กำลังหันหน้าไป
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      // 🌟 3. ป้องกันเมนูจมพื้น! บังคับให้แกน Y (ความสูง) เป็น 0 เพื่อให้เมนูพุ่งไปข้างหน้าตรงๆ ขนานกับพื้น
      camDir.y = 0;
      camDir.normalize();

      this.vrMenuPopup.position.copy(camPos).add(camDir.multiplyScalar(1.2));

      this.vrMenuPopup.position.y = camPos.y - 0.2;

      this.vrMenuPopup.lookAt(camPos);

      if (this.vrMenuPopup.parent !== scene) {
        scene.add(this.vrMenuPopup);
        console.log(
          "✅ เพิ่มเมนูเข้าไปใน Scene แล้วที่พิกัด:",
          this.vrMenuPopup.position,
        );
      }
    }
  }

  getInteractables() {
    const items = [
      this.vrSoundBtn,
      this.vrHomeBtn,
      this.vrLangBtn,
      this.closeBtnVR && this.guidePlaneVR.visible ? this.closeBtnVR : null,
    ];

    if (this.vrMenuPopup && this.vrMenuPopup.visible) {
      items.push(...this.menuInteractables);
    }

    return items.filter(Boolean);
  }
}
