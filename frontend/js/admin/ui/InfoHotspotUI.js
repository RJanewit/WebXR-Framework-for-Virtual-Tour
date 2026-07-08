import { EventBus } from "EventBus";

export class InfoHotspotUI {
    constructor() {}

    init() {
        this.panel = document.getElementById("info-hotspot-right-panel");
        this.typeSelect = document.getElementById("info-type-select");
        this.inputX = document.getElementById("info-x");
        this.inputY = document.getElementById("info-y");
        this.inputZ = document.getElementById("info-z");
        this.inputScale = document.getElementById("info-scale");
        this.colorPicker = document.getElementById("info-color-picker");
        this.colorHex = document.getElementById("info-color-hex");
        this.inputAngle = document.getElementById("info-angle");

        this.previewText = document.getElementById("info-preview-text");
        this.previewImg = document.getElementById("info-preview-img");
        this.previewVideo = document.getElementById("info-preview-video");
        this.previewModel = document.getElementById("info-preview-model");
        this.btnUpload = document.getElementById("btn-upload-info");
        this.fileInput = document.getElementById("info-file-input");

        this.uploadedFilePath = "";
        this.sceneName = "default";

        this.setupColorPicker();
        this.setupInputListeners();
        this.setupMediaEvents();
    }

    setupColorPicker() {
        if (this.colorPicker && this.colorHex) {
            this.colorPicker.addEventListener("input", (e) => {
                const hexValue = e.target.value.toUpperCase();
                this.colorHex.value = hexValue;

                EventBus.emit("ui:infoColorChanged", hexValue); 
            });
            this.colorHex.addEventListener("input", (e) => {
                let val = e.target.value;
                if (!val.startsWith("#")) val = "#" + val;
                if (val.length === 7) {
                    this.colorPicker.value = val;

                    EventBus.emit("ui:infoColorChanged", val); 
                }
            });
        }
    }

    setupInputListeners() {
        [this.inputX, this.inputY, this.inputZ].forEach(input => {
            input?.addEventListener("input", () => {
                const newPos = {
                    x: parseFloat(this.inputX?.value) || 0,
                    y: parseFloat(this.inputY?.value) || 0,
                    z: parseFloat(this.inputZ?.value) || 0,
                };
                EventBus.emit("ui:infoPositionChanged", newPos);
            });
        });
        
        this.inputScale?.addEventListener("input", () => {
            EventBus.emit("ui:infoScaleChanged", parseFloat(this.inputScale?.value) || 1);
        });

        this.inputAngle?.addEventListener("input", () => {
            EventBus.emit("ui:infoAngleChanged", parseFloat(this.inputAngle?.value) || 0);
        });
    }

    setupMediaEvents() {
        this.btnUpload?.addEventListener("click", () => this.fileInput?.click());

        this.fileInput?.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const originalText = this.btnUpload.innerHTML;
            this.btnUpload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
            this.btnUpload.disabled = true;

            try {
                const formData = new FormData();
                formData.append("sceneName", this.sceneName);
                formData.append("media", file);

                const res = await fetch("https://localhost:3443/api/upload", { method: "POST", body: formData });
                if (!res.ok) throw new Error("Upload failed");
                
                const data = await res.json();
                if(data.filePath) {
                    this.uploadedFilePath = data.filePath;
                    this.updatePreview();
                }

                EventBus.emit("ui:infoMediaUpdated", { 
                    path: data.filePath, 
                    type: this.typeSelect?.value 
                });

            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to upload media.");
            } finally {
                this.btnUpload.innerHTML = `Change Media`;
                this.btnUpload.disabled = false;
            }
        });

        this.typeSelect?.addEventListener("change", () => this.updatePreview());
    }

    updatePreview() {
        this.previewText?.classList.add("hidden");
        this.previewImg?.classList.add("hidden");
        this.previewVideo?.classList.add("hidden");
        this.previewModel?.classList.add("hidden");

        if (!this.uploadedFilePath) {
            this.previewText?.classList.remove("hidden");
            if(this.btnUpload) this.btnUpload.innerHTML = `Upload Media`;
            return;
        }

        if(this.btnUpload) this.btnUpload.innerHTML = `Change Media`;
        const type = this.typeSelect?.value || "image_popup";

        if (type === "image_popup" || type === "image") {
            if(this.previewImg) {
                this.previewImg.src = this.uploadedFilePath;
                this.previewImg.classList.remove("hidden");
            }
        } else if (type === "video_popup" || type === "video") {
            if(this.previewVideo) {
                this.previewVideo.src = this.uploadedFilePath;
                this.previewVideo.classList.remove("hidden");
            }
        } else if (type === "model_popup") {
            if(this.previewModel) {
                this.previewModel.src = this.uploadedFilePath;
                this.previewModel.classList.remove("hidden");
            }
        }
    }

    updateXYZ(x, y, z) {
        if (this.inputX) this.inputX.value = x.toFixed(2);
        if (this.inputY) this.inputY.value = y.toFixed(2);
        if (this.inputZ) this.inputZ.value = z.toFixed(2);
    }

    getFormData() {
        return {
            type: this.typeSelect?.value || "image_popup",
            x: parseFloat(this.inputX?.value) || 0,
            y: parseFloat(this.inputY?.value) || 0,
            z: parseFloat(this.inputZ?.value) || 0,
            scale: parseFloat(this.inputScale?.value) || 1,
            color: this.colorPicker?.value || "#ffffff",
            path: this.uploadedFilePath,
            angle: parseFloat(this.inputAngle?.value) || 0,
            path: this.uploadedFilePath
        };
    }

    fillData(data, currentSceneName = "default") {
        this.sceneName = currentSceneName;
        if (this.typeSelect) this.typeSelect.value = data.type;
        if (this.inputX) this.inputX.value = data.x.toFixed(2);
        if (this.inputY) this.inputY.value = data.y.toFixed(2);
        if (this.inputZ) this.inputZ.value = data.z.toFixed(2);
        if (this.inputScale) this.inputScale.value = data.scale || 1;
        if (this.colorPicker && data.color) {
            this.colorPicker.value = data.color;
            this.colorHex.value = data.color.toUpperCase();
        }
        if (this.inputAngle) this.inputAngle.value = data.angle || 0;
        
        this.uploadedFilePath = data.path || "";
        this.updatePreview();
    }

    openPanel(sceneName) { 
        if(sceneName) this.sceneName = sceneName;
        this.panel?.classList.remove("translate-x-full"); 
    }
    
    closePanel() { 
        this.panel?.classList.add("translate-x-full"); 
        this.uploadedFilePath = "";
        if(this.fileInput) this.fileInput.value = "";
        if(this.previewVideo) {
            this.previewVideo.pause();
            this.previewVideo.src = "";
        }
    }
}