import * as THREE from "three";
import { TransformControls } from "TransformControls";
import { EventBus } from "EventBus";

export class GizmoManager {
    constructor(scene, camera, domElement, desktopCtrl) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.desktopCtrl = desktopCtrl; 
        
        this.transformCtrl = null;
        this.activeEditObject = null;

        this.proxyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ visible: false, depthWrite: false })
        );
        this.scene.add(this.proxyMesh);
    }

    init() {
        this.transformCtrl = new TransformControls(this.camera, this.domElement);
        this.transformCtrl.setMode("translate");
        this.transformCtrl.size = 1.0; 
        this.scene.add(this.transformCtrl);

        this.transformCtrl.addEventListener('dragging-changed', (event) => {
            if (this.desktopCtrl && this.desktopCtrl.controls) {
                this.desktopCtrl.controls.enabled = !event.value;
            }
        });

        this.transformCtrl.addEventListener('change', () => {
            if (this.transformCtrl.object === this.proxyMesh && this.activeEditObject) {
                const pos = this.proxyMesh.position;
                
                EventBus.emit('admin:updateUIInputs', { x: pos.x, y: pos.y, z: pos.z });

                if (["door", "arrow", "ring"].includes(this.activeEditObject.userData.type)) {
                    EventBus.emit('ui:hotspotPositionChanged', { x: pos.x, y: pos.y, z: pos.z });
                } else {
                    EventBus.emit('ui:infoPositionChanged', { x: pos.x, y: pos.y, z: pos.z });
                }

                if (this.activeEditObject.userData) {
                    this.activeEditObject.userData.basePos = this.activeEditObject.position.clone();
                    if (this.activeEditObject.userData.type === 'arrow') {
                        this.activeEditObject.rotation.y = Math.atan2(pos.x, pos.z) + Math.PI;
                    }
                }
            }
        });

        EventBus.on('admin:attachGizmo', ({ mesh }) => {
            if (!mesh) return;

            if (this.activeEditObject && this.activeEditObject.userData) {
                this.activeEditObject.userData.isEditing = false;
            }
            
            this.activeEditObject = mesh;
            if (mesh.userData) mesh.userData.isEditing = true;

            if (mesh.userData && mesh.userData.unscaledPos) {
                this.proxyMesh.position.copy(mesh.userData.unscaledPos);
            } else {
                this.proxyMesh.position.copy(mesh.position);
            }
            
            if (this.transformCtrl.parent !== this.scene) {
                this.scene.add(this.transformCtrl);
            }

            this.transformCtrl.attach(this.proxyMesh);
        });

        EventBus.on('admin:detachGizmo', () => {
            if (this.activeEditObject && this.activeEditObject.userData) {
                this.activeEditObject.userData.isEditing = false;
            }
            this.transformCtrl.detach();
            this.activeEditObject = null;
        });
    }
}