import * as THREE from "three";

export class HotspotManager {
  constructor(scene, textureLoader) {
    this.scene = scene;
    this.textureLoader = textureLoader || new THREE.TextureLoader();
    this._hotspots = new Map();
  }

  _applyVRDistance(mesh, x, y, z, faceCamera = false) {
    const originalPos = new THREE.Vector3(x, y, z);
    const cameraPos = new THREE.Vector3(0, 1.6, 0);
    const dir = new THREE.Vector3().subVectors(originalPos, cameraPos);
    const originalDistance = dir.length() || 1;
    const targetDistance = 400;

    dir.normalize().multiplyScalar(targetDistance);
    const newPos = new THREE.Vector3().addVectors(cameraPos, dir);
    mesh.position.copy(newPos);

    const scaleFactor = targetDistance / originalDistance;
    mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    if (faceCamera) {
      mesh.lookAt(cameraPos);
    }

    return { pos: newPos, scale: scaleFactor };
  }

  clearAll() {
    for (const object of this._hotspots.values()) {
      this.scene.remove(object);

      object.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    this._hotspots.clear();
  }

  getAll() {
    return Array.from(this._hotspots.values());
  }

addArrowHotspot(targetURL, x, y, z) {
    const size = 1;
    const iconPath = "/assets/img/uxui/orangeArrow.png";
    const floatAmp = 0.25;
    const floatSpeed = 2.2;
    const phase = Math.random() * Math.PI * 2;

    const geometry = new THREE.PlaneGeometry(size, size);
    // จับให้นอนราบกับพื้น
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    const hotspot = new THREE.Mesh(geometry, material);
    
    // ดันออกไปที่ระยะ VR (ฟังก์ชันเดิมของคุณ)
    const transform = this._applyVRDistance(hotspot, x, y, z, false);

    hotspot.renderOrder = 999;
    
    // 🌟 1. คำนวณองศาการหันหน้าให้พุ่งออกไปจากจุดศูนย์กลาง (0,0,0)
    // หมายเหตุ: ถ้าไอคอนลูกศรของคุณหันหัวกลับทิศ ให้เอา "+ Math.PI" ด้านหลังออกครับ
    const yawRad = Math.atan2(x, z) + Math.PI;
    hotspot.rotation.y = yawRad;

    // 🌟 2. คำนวณเวกเตอร์ 2D (X, Z) สำหรับแอนิเมชันให้ลอยเข้า-ออกตรงๆ ไม่เบี้ยว
    const length = Math.sqrt(x * x + z * z) || 1;
    const dirX = x / length;
    const dirZ = z / length;

    hotspot.userData = {
      type: "arrow",
      targetID: targetURL,
      basePos: transform.pos.clone(),
      dirX: dirX, // ส่งทิศทางแนวแกน X 
      dirZ: dirZ, // ส่งทิศทางแนวแกน Z
      floatAmp: floatAmp * transform.scale,
      floatSpeed: floatSpeed,
      phase: phase,
      isEditing: false
    };
    hotspot.name = "Hotspot_Jump";

    this.scene.add(hotspot);
    this._hotspots.set(hotspot.uuid, hotspot);

    this.textureLoader.load(iconPath, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;

      hotspot.material.map = tex;
      hotspot.material.opacity = 1.0;
      hotspot.material.needsUpdate = true;
    });

    return hotspot;
  }

  addRingJumpHotspot(targetID, x, y, z) {
    const group = new THREE.Group();
    group.name = targetID;
    const color = 0xffffff;
    const ringGeo = new THREE.RingGeometry(0.2, 0.25, 32);
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    const ringBreath = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringBreath.rotation.x = -Math.PI / 2;
    ringBreath.name = "RingBreath";
    group.add(ringBreath);
    const ringRipple = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringRipple.rotation.x = -Math.PI / 2;
    ringRipple.name = "RingRipple";
    group.add(ringRipple);
    const ringFloat = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringFloat.rotation.x = -Math.PI / 2;
    ringFloat.name = "RingFloat";
    group.add(ringFloat);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitMesh.name = "HitBox";
    hitMesh.position.y = 0;
    group.add(hitMesh);

    this._applyVRDistance(group, x, 0, z, false);

    const userData = {
      type: "ring", 
      targetID: targetID,
      cycleDuration: 2.0,
    };
    
    group.userData = userData;
    hitMesh.userData = userData;

    this.scene.add(group);
    this._hotspots.set(group.uuid, group);

    return group;
  }

  addImageHotspot(imagePath, x, y, z, angle = 0, width = 30, height = 30, scale = 1.0) {
    
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
      color: 0x888888
    });
    const mesh = new THREE.Mesh(geometry, material);

    this._applyVRDistance(mesh, x, y, z, false);
    mesh.rotation.y = THREE.MathUtils.degToRad(angle);
    mesh.scale.set(scale, scale, scale);
    mesh.renderOrder = 999;
    mesh.userData = { type: "image" };

    this.scene.add(mesh);
    this._hotspots.set(mesh.uuid, mesh);

    if (imagePath) {
        this.textureLoader.load(imagePath, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          mesh.material.map = tex;
          mesh.material.color.setHex(0xffffff); 
          mesh.material.needsUpdate = true;
        });
    }

    return mesh;
  }

  addVideoHotspot(videoPath, x, y, z, angle = 0, width = 40, height = 22.5, scale = 1.0) {

    const geometry = new THREE.PlaneGeometry(width || 1, height || 0.56);
    const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        toneMapped: false,
        color: 0x888888
    });
    const mesh = new THREE.Mesh(geometry, material);

    this._applyVRDistance(mesh, x, y, z, false);
    mesh.rotation.y = THREE.MathUtils.degToRad(angle);
    mesh.scale.set(scale, scale, scale);
    this.scene.add(mesh);
    this._hotspots.set(mesh.uuid, mesh);

    if (videoPath) {
        const video = document.createElement("video");
        video.src = videoPath;
        video.crossOrigin = "anonymous";
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch((e) => console.warn("Video autoplay blocked", e));
        
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        mesh.material.map = texture;
        mesh.material.color.setHex(0xffffff);
        mesh.userData = { type: "video", videoElement: video };
    } else {
        mesh.userData = { type: "video" };
    }

    return mesh;
  }

  addVideoPopupHotspot(targetImagePath, x, y, z) {
    return this._createPopupHotspot(targetImagePath, x, y, z, "video_popup");
  }
  addImagePopupHotspot(targetImagePath, x, y, z) {
    return this._createPopupHotspot(targetImagePath, x, y, z, "image_popup");
  }

  _createPopupHotspot(target, x, y, z, type) {
    const group = new THREE.Group();
    const radiusInner = 0.08,
      radiusOuter = 0.1,
      color = 0xffffff;
    const ringGeo = new THREE.RingGeometry(radiusInner, radiusOuter, 32);
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    const ringBreath = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringBreath.rotation.x = -Math.PI / 2;
    ringBreath.name = "RingPopupBreath";
    group.add(ringBreath);
    const ringRipple = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringRipple.rotation.x = -Math.PI / 2;
    ringRipple.name = "RingPopupRipple";
    group.add(ringRipple);

    this._applyVRDistance(group, x, y, z, true);
    
    const userData = { type: type, targetImage: target, cycleDuration: 2.0 };
    group.userData = userData;

    const hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitMesh.name = "HitBox";
    group.add(hitMesh);

    group.children.forEach(child => {
        if (child.isMesh) child.userData = userData;
    });

    this.scene.add(group);
    this._hotspots.set(group.uuid, group);
    
    return group;
  }

  addDoorHotspot(targetID, x, y, z, color = "#ffffff") {
    const group = new THREE.Group();
    group.name = "Hotspot_Door";
    const doorHeight = 0.35,
      doorWidth = 0.2,
      thickness = 0.025;
    const doorMat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    const doorIconGroup = new THREE.Group();
    doorIconGroup.position.y = 0.5;
    doorIconGroup.name = "DoorIconGroup";

    const shape = new THREE.Shape();
    const hf = doorHeight / 2,
      hw = doorWidth / 2;
    shape.moveTo(-hw, -hf);
    shape.lineTo(hw, -hf);
    shape.lineTo(hw, hf);
    shape.lineTo(-hw, hf);
    shape.lineTo(-hw, -hf);

    const holePath = new THREE.Path();
    const ih = hf - thickness,
      iw = hw - thickness;
    holePath.moveTo(-iw, -ih);
    holePath.lineTo(iw, -ih);
    holePath.lineTo(iw, ih);
    holePath.lineTo(-iw, ih);
    holePath.lineTo(-iw, -ih);
    shape.holes.push(holePath);

    const doorFrame = new THREE.Mesh(new THREE.ShapeGeometry(shape), doorMat);
    doorFrame.name = "FrameMesh";
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.175, 0.2, 32),
      doorMat,
    );
    pulseRing.name = "PulseRing";

    const frameGroup = new THREE.Group();
    frameGroup.name = "FrameGroup";
    frameGroup.add(doorFrame);
    frameGroup.add(pulseRing);
    doorIconGroup.add(frameGroup);

    const hinge = new THREE.Group();
    hinge.position.x = doorWidth / 2 - thickness / 2;
    hinge.name = "Hinge";
    const doorPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth, doorHeight),
      doorMat,
    );
    doorPanel.position.x = -(doorWidth - thickness * 2) / 2;
    hinge.add(doorPanel);
    doorIconGroup.add(hinge);
    group.add(doorIconGroup);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.name = "HitBox";
    hitMesh.position.y = 0;
    group.add(hitMesh);

    this._applyVRDistance(group, x, y, z, false);
    group.userData = { type: "door", targetID: targetID };
    this.scene.add(group);
    this._hotspots.set(group.uuid, group);

    return group;
  }

  add3DModelHotspot(modelPath, x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    const radiusInner = 0.08,
      radiusOuter = 0.1,
      color = 0xffffff;
    const ringGeo = new THREE.RingGeometry(radiusInner, radiusOuter, 32);
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    const ringBreath = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringBreath.rotation.x = -Math.PI / 2;
    ringBreath.name = "RingPopupBreath";
    group.add(ringBreath);
    const ringRipple = new THREE.Mesh(ringGeo, baseMaterial.clone());
    ringRipple.rotation.x = -Math.PI / 2;
    ringRipple.name = "RingPopupRipple";
    group.add(ringRipple);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusOuter, radiusOuter, 0.2, 16),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.name = "HitBox";
    hitMesh.position.y = 0;

    const userData = {
      type: "model_3d",
      modelPath: modelPath,
      cycleDuration: 2.0,
    };
    hitMesh.userData = userData;
    group.userData = userData;
    group.add(hitMesh);

    this._applyVRDistance(group, x, y, z, true);
    this.scene.add(group);
    this._hotspots.set(group.uuid, group);

    return group;
  }

update(timeSec, camera) {
    if (this._hotspots.size === 0) return;
    for (const hs of this._hotspots.values()) {
      if (!hs.userData) continue;

      if (hs.userData.type === "door") {
        const iconGroup = hs.getObjectByName("DoorIconGroup");
        if (!iconGroup) continue;
        const frameGroup = iconGroup.getObjectByName("FrameGroup");
        const pulseRing = frameGroup ? frameGroup.getObjectByName("PulseRing") : null;
        const hinge = iconGroup.getObjectByName("Hinge");

        if (pulseRing) {
          const ringScale = 1.5 + (Math.sin(timeSec * 1.5) + 1) / 4;
          pulseRing.scale.set(ringScale, ringScale, 1);
        }
        if (hinge) hinge.rotation.y = ((Math.sin(timeSec * 1.5) + 1) / 2) * 1.05;
        if (camera) iconGroup.lookAt(camera.position);

      } else if (hs.userData.type === "arrow") {
        const b = hs.userData.basePos;
        
        if (hs.userData.isEditing) {
          hs.position.copy(b);
          continue;
        }

        const d = Math.sin(timeSec * hs.userData.floatSpeed + hs.userData.phase) * hs.userData.floatAmp;
        hs.position.set(b.x + (hs.userData.dirX * d), b.y, b.z + (hs.userData.dirZ * d));

      } else if (hs.userData.type === "ring_jump" || hs.userData.type === "ring") {
        const duration = hs.userData.cycleDuration || 2.0;
        const localT = (timeSec % duration) / duration;

        const rBreath = hs.getObjectByName("RingBreath");
        if (rBreath) {
          const scaleBase = 1 + Math.sin(localT * Math.PI * 2) * 0.2;
          rBreath.scale.set(scaleBase, scaleBase, 1);
        }
        const rRipple = hs.getObjectByName("RingRipple");
        if (rRipple) {
          const scaleRipple = (1 + localT * 1.5) * 0.8;
          rRipple.scale.set(scaleRipple, scaleRipple, 1);
          rRipple.material.opacity = 0.6 * (1 - localT);
        }
        const rFloat = hs.getObjectByName("RingFloat");
        if (rFloat) {
          rFloat.position.y = localT * 0.5;
          const floatScale = 1 - localT * 0.3;
          rFloat.scale.set(floatScale, floatScale, 1);
          rFloat.material.opacity = 0.8 * (1 - Math.pow(localT, 2));
        }

      } else if (
        hs.userData.type === "image_popup" ||
        hs.userData.type === "model_popup" ||
        hs.userData.type === "video_popup" ||
        hs.userData.type === "pulse_ring"
      ) {
        const duration = hs.userData.cycleDuration || 2.0;
        const localT = (timeSec % duration) / duration;
        const breath = hs.getObjectByName("RingPopupBreath");
        const ripple = hs.getObjectByName("RingPopupRipple");

        if (breath) {
          const scaleBase = 1 + Math.sin(localT * Math.PI * 2) * 0.2;
          breath.scale.set(scaleBase, scaleBase, scaleBase);
        }
        if (ripple) {
          const scaleRipple = (1 + localT * 1.5) * 0.8;
          ripple.scale.set(scaleRipple, scaleRipple, scaleRipple);
          ripple.material.opacity = 1.0 - localT;
        }
        if (camera) {
          breath.lookAt(camera.position);
          ripple.lookAt(camera.position);
        }
      }
    }
  }
}
