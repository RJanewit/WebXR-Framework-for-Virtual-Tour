import { EventBus } from "EventBus";

export class MediaUploadModalUI {
    constructor() {}

    init() {
        this.modal = document.getElementById("media-upload-modal");
        this.previewText = document.getElementById("media-preview-text");
        this.previewImg = document.getElementById("media-preview-img");
        this.previewVideo = document.getElementById("media-preview-video");
        this.previewModel = document.getElementById("media-preview-model");

        this.btnUpload = document.getElementById("btn-modal-upload");
        this.fileInput = document.getElementById("modal-file-input");
        this.btnSave = document.getElementById("btn-modal-save");
        this.btnCancel = document.getElementById("btn-modal-cancel");

        this.uploadedFilePath = "";
        this.hotspotType = "image_popup";

        this.setupEvents();
    }

    setupEvents() {
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
                    this.btnUpload.innerHTML = `Change Media`;
                    this.updatePreview();
                }
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to upload media. Please try again.");
                this.btnUpload.innerHTML = originalText;
            } finally {
                this.btnUpload.disabled = false;
            }
        });

        this.btnSave?.addEventListener("click", () => {
            EventBus.emit("admin:saveMediaModal", { path: this.uploadedFilePath });
        });

        this.btnCancel?.addEventListener("click", () => {
            EventBus.emit("admin:cancelMediaModal");
            this.hide();
        });
    }

    show(existingPath = "", type = "image_popup", sceneName = "default") {
        this.uploadedFilePath = existingPath;
        this.hotspotType = type;
        this.sceneName = sceneName;
        this.updatePreview();
        this.modal?.classList.remove("hidden");
    }

    hide() {
        this.modal?.classList.add("hidden");
        if (this.fileInput) this.fileInput.value = "";
        if (this.previewVideo) {
            this.previewVideo.pause();
            this.previewVideo.src = "";
        }
    }

    updatePreview() {
        this.previewText?.classList.add("hidden");
        this.previewImg?.classList.add("hidden");
        this.previewVideo?.classList.add("hidden");
        this.previewModel?.classList.add("hidden");

        if (!this.uploadedFilePath) {
            this.previewText?.classList.remove("hidden");
            this.btnUpload.innerHTML = `Upload Media`;
            return;
        }

        this.btnUpload.innerHTML = `Change Media`;

        if (this.hotspotType === "image_popup") {
            this.previewImg.src = this.uploadedFilePath;
            this.previewImg?.classList.remove("hidden");
        } else if (this.hotspotType === "video_popup") {
            this.previewVideo.src = this.uploadedFilePath;
            this.previewVideo?.classList.remove("hidden");
        } else if (this.hotspotType === "model_popup" || this.hotspotType === "model_3d") {
            this.previewModel.src = this.uploadedFilePath;
            this.previewModel?.classList.remove("hidden");
        } else {
            this.previewImg.src = this.uploadedFilePath;
            this.previewImg?.classList.remove("hidden");
        }
    }
}