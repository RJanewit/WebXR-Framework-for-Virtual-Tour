import * as THREE from "three";
import { EventBus } from "../utils/EventBus.js";

export class AudioManager {
  constructor() {
    this.listener = null;
    this.bgMusic = null;
    this.isMuted = localStorage.getItem("tourAudioMuted") === "true";
  }

  init(camera) {
    if (!this.listener) {
      this.listener = new THREE.AudioListener();
      camera.add(this.listener);
    }

    EventBus.on("ui:toggleSound", (data) => {
        if (data && data.isMuted !== undefined) {
            this.setMute(data.isMuted);
        } else {
            this.toggle();
        }
    });
  }

  play(audioPath) {
    if (this.bgMusic && this.bgMusic.isPlaying) return;

    if (!this.listener) {
      return;
    }

    this.bgMusic = new THREE.Audio(this.listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(audioPath, (buffer) => {
      this.bgMusic.setBuffer(buffer);
      this.bgMusic.setLoop(true);

      this.bgMusic.setVolume(this.isMuted ? 0 : 0.3);
      this.bgMusic.play();
    });
  }

setMute(isMuted) {
    this.isMuted = isMuted; 
    localStorage.setItem("tourAudioMuted", isMuted);

    const audioCtx = THREE.AudioContext.getContext();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    if (this.bgMusic) {
      if (!this.bgMusic.isPlaying) {
        this.bgMusic.play();
      }
      this.bgMusic.setVolume(isMuted ? 0 : 0.3);
    }

    if (this.vrSoundBtn) {
      this.vrSoundBtn.material.map = isMuted ? this.texSoundOff_Canvas : this.texSoundOn_Canvas;
      this.vrSoundBtn.material.needsUpdate = true;
    }

    EventBus.emit("audio:muteChanged", { muted: isMuted });
  }

  toggle() {
    this.setMute(!this.isMuted);
  }
}