import * as THREE from "three";

export class Hotspot {
    constructor(scene, textureLoader) {
        this.scene = scene;
        this.textureLoader = textureLoader || new THREE.TextureLoader();
        this.hotspots = [];
    }

    // 🌟 ฟังก์ชันพระเอก: แก้ไขการดัน Hotspot ให้พุ่งออกจาก "ระดับสายตา (กล้อง)"
    _applyVRDistance(mesh, x, y, z, faceCamera = false) {
        const originalPos = new THREE.Vector3(x, y, z);
        
        // 🌟 ตั้งค่าพิกัดอ้างอิงเป็นตำแหน่งกล้อง (ระดับสายตาที่ y=1.6)
        const cameraPos = new THREE.Vector3(0, 1.6, 0); 

        // 1. หาระยะห่างและทิศทางจาก "กล้อง" พุ่งไปยัง "ปุ่มเดิม"
        const dir = new THREE.Vector3().subVectors(originalPos, cameraPos);
        const originalDistance = dir.length() || 1; 

        // 2. ระยะเป้าหมายที่จะดันไปชิดกำแพง 360 องศา
        const targetDistance = 400; 

        // 3. ดันตำแหน่งออกไปตาม "ทิศทางสายตา" 
        dir.normalize().multiplyScalar(targetDistance);
        
        // 4. เอาทิศทางที่ขยายแล้ว ไปบวกกลับเข้ากับตำแหน่งกล้อง
        const newPos = new THREE.Vector3().addVectors(cameraPos, dir);

        // อัปเดตพิกัดใหม่
        mesh.position.copy(newPos);
        
        // 5. ขยายขนาดชดเชยระยะทางที่โดนดันออกไป
        const scaleFactor = targetDistance / originalDistance;
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // 6. หันหน้าเข้าหากล้องตรงๆ (สำหรับปุ่ม Pop-up)
        if (faceCamera) {
            mesh.lookAt(cameraPos);
        }

        return { pos: newPos, scale: scaleFactor };
    }
    
    // 1. ฟังก์ชันเพิ่ม Hotspot แบบลูกศร (Arrow)
    addHotspot(targetURL, phiDeg = 0) {
        const rho = 190;
        const y = -70;
        const iconPath = "/assets/img/uxui/blueArrow.webp"; 
        const size = 50;
        const floatAmp = 5;
        const floatSpeed = 2.2;
        const phase = Math.random() * Math.PI * 2;
        const angleOffsetDeg = 180;
        const phi = THREE.MathUtils.degToRad(phiDeg + 180);
        
        const x = rho * Math.sin(phi);
        const z = rho * Math.cos(phi);
        
        const geometry = new THREE.PlaneGeometry(size, size);
        geometry.rotateX(-Math.PI / 2);
        
        this.textureLoader.load(iconPath, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            
            const material = new THREE.MeshBasicMaterial({ 
                map: tex, transparent: true, opacity: 1.0, 
                side: THREE.DoubleSide, depthWrite: false, toneMapped: false 
            });
            
            const hotspot = new THREE.Mesh(geometry, material);
            
            // 🌟 เรียกใช้ระบบดันไปติดกำแพง (ลูกศรบนพื้น ไม่ต้อง lookAt กล้อง)
            const transform = this._applyVRDistance(hotspot, x, y, z, false);
            
            hotspot.renderOrder = 999; 
            hotspot.rotation.y = THREE.MathUtils.degToRad(phiDeg + angleOffsetDeg + 180);
            
            hotspot.userData = {
                type: 'arrow',
                yawRad: hotspot.rotation.y,
                targetID: targetURL,
                angle: phiDeg,
                basePos: transform.pos.clone(), // ใช้ตำแหน่งใหม่
                floatAmp: floatAmp * transform.scale, // ขยายระยะลอยขึ้นลงด้วย
                floatSpeed: floatSpeed,
                phase: phase
            };
            
            hotspot.name = "Hotspot_Jump";
            this.scene.add(hotspot);
            this.hotspots.push(hotspot);
        });
    }

    // 2. ฟังก์ชันเพิ่ม Hotspot วงแหวนแบบมี Animation ซับซ้อน (Ring Jump)
    addRingJumpHotspot(targetID, x, z) {
        const group = new THREE.Group();
        group.name = targetID;
        const color = 0xffffff;

        const ringGeo = new THREE.RingGeometry(0.2, 0.25, 32);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 1});

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

        const hitGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16);
        const hitMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, depthWrite: false });
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        hitMesh.name = "HitBox"; 
        hitMesh.position.y = 0; 
        group.add(hitMesh);

        // 🌟 ดันไปติดขอบโลก
        this._applyVRDistance(group, x, 0, z, false);

        group.userData = { type: 'ring_jump', targetID: targetID, cycleDuration: 2.0 };

        this.scene.add(group);
        this.hotspots.push(group);
    }

    // 3. ฟังก์ชันเพิ่มรูปภาพนิ่ง (Static Image)
    addImageHotspot(imagePath, x, y, z, angle = 0, width = 30, height = 30) {
        this.textureLoader.load(imagePath, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;

            const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
            const geometry = new THREE.PlaneGeometry(width, height);
            const mesh = new THREE.Mesh(geometry, material);
            
            // 🌟 ดันพิกัดและขยายขนาด
            this._applyVRDistance(mesh, x, y, z, false);
            mesh.rotation.y = THREE.MathUtils.degToRad(angle); // คงมุมเดิมที่ตั้งไว้
            mesh.renderOrder = 999;

            mesh.userData = { type: 'static_image' }; 
            
            this.scene.add(mesh);
            this.hotspots.push(mesh);
        });
    }

    // 4. Popup Image / Video Hotspot (วงแหวนกระพริบ)
    addVideoPopupHotspot(targetImagePath, x, y, z) { this._createPopupHotspot(targetImagePath, x, y, z, 'video_popup'); }
    addImagePopupHotspot(targetImagePath, x, y, z) { this._createPopupHotspot(targetImagePath, x, y, z, 'pulse_ring'); }

    _createPopupHotspot(target, x, y, z, type) {
        const group = new THREE.Group();
        const radiusInner = 0.08, radiusOuter = 0.1, color = 0xffffff;

        const ringGeo = new THREE.RingGeometry(radiusInner, radiusOuter, 32);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

        const ringBreath = new THREE.Mesh(ringGeo, baseMaterial.clone());
        ringBreath.rotation.x = -Math.PI / 2;
        ringBreath.name = "RingPopupBreath";
        group.add(ringBreath);

        const ringRipple = new THREE.Mesh(ringGeo, baseMaterial.clone());
        ringRipple.rotation.x = -Math.PI / 2;
        ringRipple.name = "RingPopupRipple";
        group.add(ringRipple);
        
        const hitGeometry = new THREE.CylinderGeometry(radiusOuter, radiusOuter, 0.2, 16);
        const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        hitMesh.name = "HitBox"; 
        hitMesh.position.y = 0; 
        group.add(hitMesh);

        // 🌟 ดันไปติดขอบโลกและหันหน้าเข้ากล้องเสมอ
        this._applyVRDistance(group, x, y, z, true);

        group.userData = { type: type, targetImage: target, cycleDuration: 2.0 };
        this.scene.add(group);
        this.hotspots.push(group);
    }

    // 5. ฟังก์ชันเพิ่ม Hotspot ประตูบานพับ
    addDoorHotspot(targetID, x, y, z, color = "#ffffff") {
        const group = new THREE.Group();
        group.name = "Hotspot_Door"; 
        
        const doorHeight = 0.35, doorWidth = 0.2, thickness = 0.025;
        const doorMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 1 });

        const doorIconGroup = new THREE.Group();
        doorIconGroup.position.y = 0.5; 
        doorIconGroup.name = "DoorIconGroup";

        const shape = new THREE.Shape();
        const hf = doorHeight / 2, hw = doorWidth / 2;
        shape.moveTo(-hw, -hf); shape.lineTo(hw, -hf); shape.lineTo(hw, hf); shape.lineTo(-hw, hf); shape.lineTo(-hw, -hf);

        const holePath = new THREE.Path();
        const ih = hf - thickness, iw = hw - thickness;
        holePath.moveTo(-iw, -ih); holePath.lineTo(iw, -ih); holePath.lineTo(iw, ih); holePath.lineTo(-iw, ih); holePath.lineTo(-iw, -ih);
        shape.holes.push(holePath);

        const doorFrame = new THREE.Mesh(new THREE.ShapeGeometry(shape), doorMat);
        doorFrame.name = "FrameMesh";

        const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.175, 0.2, 32), doorMat);
        pulseRing.name = "PulseRing";

        const frameGroup = new THREE.Group();
        frameGroup.name = "FrameGroup";
        frameGroup.add(doorFrame); frameGroup.add(pulseRing);
        doorIconGroup.add(frameGroup);

        const hinge = new THREE.Group();
        hinge.position.x = doorWidth / 2 - (thickness/2); 
        hinge.name = "Hinge";

        const doorPanel = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth, doorHeight), doorMat);
        doorPanel.position.x = -(doorWidth - thickness*2) / 2; 
        hinge.add(doorPanel); doorIconGroup.add(hinge);
        group.add(doorIconGroup);

        const hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16), new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.name = "HitBox"; 
        hitMesh.position.y = 0; // แก้บั๊กพิกัดซ้อนกัน
        group.add(hitMesh);

        // 🌟 ดันระยะ 400 เมตร
        this._applyVRDistance(group, x, y, z, false);

        group.userData = { type: 'door', targetID: targetID };
        this.scene.add(group);
        this.hotspots.push(group);
    }

    // 6. Video Hotspot
    addVideoHotspot(videoPath, x, y, z, angle = 0, width = 40, height = 22.5) {
        const video = document.createElement('video');
        video.src = videoPath; video.crossOrigin = "anonymous"; video.loop = true; video.muted = true; video.playsInline = true;
        video.play().catch(e => console.warn("Video autoplay blocked", e));

        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width || 1, height || 0.56), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));

        // 🌟 ดันระยะ 400 เมตร
        this._applyVRDistance(mesh, x, y, z, false);
        mesh.rotation.y = THREE.MathUtils.degToRad(angle);

        mesh.userData = { type: 'video_plane', videoElement: video };
        this.scene.add(mesh);
        this.hotspots.push(mesh);
    }

    // 7. 3D Model Hotspot
    add3DModelHotspot(modelPath, x, y, z, scale = 1.0) {
        const group = new THREE.Group();
        const radiusInner = 0.08, radiusOuter = 0.1, color = 0xffffff;

        const ringGeo = new THREE.RingGeometry(radiusInner, radiusOuter, 32);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

        const ringBreath = new THREE.Mesh(ringGeo, baseMaterial.clone());
        ringBreath.rotation.x = -Math.PI / 2; ringBreath.name = "RingPopupBreath";
        group.add(ringBreath);

        const ringRipple = new THREE.Mesh(ringGeo, baseMaterial.clone());
        ringRipple.rotation.x = -Math.PI / 2; ringRipple.name = "RingPopupRipple";
        group.add(ringRipple);
        
        const hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusOuter, radiusOuter, 0.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.name = "HitBox"; hitMesh.position.y = 0; 
        
        const userData = { type: 'model_3d', modelPath: modelPath, cycleDuration: 2.0 };
        hitMesh.userData = userData; group.userData = userData;
        group.add(hitMesh);

        // 🌟 ดันระยะ 400 เมตรและหันหน้าเข้ากล้อง
        this._applyVRDistance(group, x, y, z, true);

        this.scene.add(group);
        this.hotspots.push(group);
    }

    // ✅ Main Update Function 
    updateHotspots(timeSec, camera) {
        if (!this.hotspots?.length) return;

        for (const hs of this.hotspots) {
            if (!hs.userData) continue;

            if (hs.userData.type === 'door') {
                const iconGroup = hs.getObjectByName("DoorIconGroup");
                if (!iconGroup) continue;

                const frameGroup = iconGroup.getObjectByName("FrameGroup");
                const pulseRing = frameGroup ? frameGroup.getObjectByName("PulseRing") : null;
                const hinge = iconGroup.getObjectByName("Hinge");

                if (pulseRing) {
                    const ringScale = 1.5 + (Math.sin(timeSec * 1.5) + 1) / 4;
                    pulseRing.scale.set(ringScale, ringScale, 1);
                }
                if (hinge) {
                    hinge.rotation.y = ((Math.sin(timeSec * 1.5) + 1) / 2) * 1.05; 
                }
                if (camera) iconGroup.lookAt(camera.position);
            }
            
            else if (hs.userData.type === 'arrow') {
                const b = hs.userData.basePos;
                const d = Math.sin(timeSec * hs.userData.floatSpeed + hs.userData.phase) * hs.userData.floatAmp;
                const dirX = Math.sin(hs.userData.yawRad);
                const dirZ = Math.cos(hs.userData.yawRad);
                hs.position.set(b.x + dirX * d, b.y, b.z + dirZ * d);
            }

            else if (hs.userData.type === 'ring_jump') {
                const duration = hs.userData.cycleDuration || 2.0;
                const localT = (timeSec % duration) / duration; 

                const rBreath = hs.getObjectByName("RingBreath");
                if (rBreath) {
                    const scaleBase = 1 + Math.sin(localT * Math.PI * 2) * 0.2;
                    rBreath.scale.set(scaleBase, scaleBase, 1);
                }

                const rRipple = hs.getObjectByName("RingRipple");
                if (rRipple) {
                    const scaleRipple = (1 + (localT * 1.5))*0.8;
                    rRipple.scale.set(scaleRipple, scaleRipple, 1);
                    rRipple.material.opacity = 0.6 * (1 - localT);
                }

                const rFloat = hs.getObjectByName("RingFloat");
                if (rFloat) {
                    rFloat.position.y = localT * 0.5;
                    const floatScale = 1 - (localT * 0.3);
                    rFloat.scale.set(floatScale, floatScale, 1);
                    rFloat.material.opacity = 0.8 * (1 - Math.pow(localT, 2));
                }
            }

            else if (hs.userData.type === 'pulse_ring' || hs.userData.type === 'model_3d' || hs.userData.type === 'video_popup') {
                const duration = hs.userData.cycleDuration || 2.0;
                const localT = (timeSec % duration) / duration;

                const breath = hs.getObjectByName("RingPopupBreath");
                const ripple = hs.getObjectByName("RingPopupRipple");
                
                if (breath) {
                    const scaleBase = 1 + Math.sin(localT * Math.PI * 2) * 0.2;
                    breath.scale.set(scaleBase, scaleBase, scaleBase);
                }
                if (ripple) {
                    const scaleRipple = (1 + (localT * 1.5))*0.8;
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