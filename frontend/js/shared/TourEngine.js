import * as THREE from "three";
import { SceneManager } from './SceneManager.js';
import { AudioManager } from './AudioManager.js';
import { HotspotManager } from '../entities/HotspotManager.js';
import { DesktopControls } from '../input/DesktopControls.js';
import { VRControls } from '../input/VRControls.js';
import { InteractionManager } from '../input/InteractionManager.js';
import { VRUIManager } from '../ui/VRUIManager.js';
import { VRButton } from "VRButton";
import { GizmoManager } from '../editor/GizmoManager.js';

export class TourEngine {
    constructor() {
        this.sceneManager = new SceneManager();
        this.audio = new AudioManager();
        this.hotspots = new HotspotManager(this.sceneManager.scene, new THREE.TextureLoader());
        
        this.desktopCtrl = new DesktopControls(this.sceneManager.camera, null); 
        this.vrCtrl = new VRControls(this.sceneManager.renderer, this.sceneManager.scene, this.sceneManager.camera);
        
        this.interaction = new InteractionManager(this.sceneManager, this.hotspots); 
        this.vrUI = new VRUIManager(this.sceneManager.renderer, this.sceneManager.camera);
        
        this.interaction.vrUI = this.vrUI; 
        
        this.gizmo = null;
    }

    init() {
        this.sceneManager.init();

        this.sceneManager.renderer.xr.enabled = true;
        const vrButton = VRButton.createButton(this.sceneManager.renderer);
        document.body.appendChild(vrButton);

        this.desktopCtrl.domElement = this.sceneManager.renderer.domElement;
        this.desktopCtrl.init();
        
        this.gizmo = new GizmoManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            this.desktopCtrl
        );
        this.gizmo.init();

        this.vrUI.renderer = this.sceneManager.renderer;
        this.vrUI.init();

        this.vrCtrl.renderer = this.sceneManager.renderer;
        this.vrCtrl.init();
        this.audio.init(this.sceneManager.camera);
        this.interaction.init();
        
        this.sceneManager.renderer.setAnimationLoop((t) => this._animate(t));
    }

    _animate() {
        const time = this.sceneManager.clock.getElapsedTime();
        if (!this.sceneManager.renderer.xr.isPresenting) {
            this.desktopCtrl.update();
        }
        this.hotspots.update(time, this.sceneManager.camera);
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }
}