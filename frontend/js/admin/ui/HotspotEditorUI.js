import { EventBus } from "EventBus";

export class HotspotEditorUI {
    constructor() {

    }

    init() {
        this.panel = document.getElementById("link-to-hotspot-right-panel");
        this.inputX = document.getElementById("link-x");
        this.inputY = document.getElementById("link-y");
        this.inputZ = document.getElementById("link-z");
        this.typeSelect = document.getElementById("link-type-select");
        this.colorPicker = document.getElementById("link-color-picker");
        this.colorHex = document.getElementById("link-color-hex");

        this.setupColorPicker();

        this.setupInputListeners();
    }

    setupColorPicker() {
        if (this.colorPicker && this.colorHex) {
            this.colorPicker.addEventListener("input", (e) => {
                const hexValue = e.target.value.toUpperCase();
                this.colorHex.value = hexValue;
                EventBus.emit("ui:linkColorChanged", hexValue); 
            });

            this.colorHex.addEventListener("input", (e) => {
                let val = e.target.value;
                if (!val.startsWith("#")) val = "#" + val;
                if (val.length === 7) {
                    this.colorPicker.value = val;
                    EventBus.emit("ui:linkColorChanged", val); 
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
                EventBus.emit("ui:hotspotPositionChanged", newPos); 
            });
        });
    }

    fillData(hsData) {
        if (this.typeSelect) this.typeSelect.value = hsData.type;
        if (this.inputX) this.inputX.value = hsData.x.toFixed(2);
        if (this.inputY) this.inputY.value = hsData.y.toFixed(2);
        if (this.inputZ) this.inputZ.value = hsData.z.toFixed(2);
        if (this.colorPicker && hsData.color) {
            this.colorPicker.value = hsData.color;
            this.colorHex.value = hsData.color.toUpperCase();
        }
    }

    getFormData() {
        return {
            type: this.typeSelect?.value || "arrow",
            x: parseFloat(this.inputX?.value) || 0,
            y: parseFloat(this.inputY?.value) || 0,
            z: parseFloat(this.inputZ?.value) || 0,
            color: this.colorPicker?.value || "#ffffff"
        };
    }

    updateXYZ(x, y, z) {
        if (this.inputX) this.inputX.value = x.toFixed(2);
        if (this.inputY) this.inputY.value = y.toFixed(2);
        if (this.inputZ) this.inputZ.value = z.toFixed(2);
    }

    openPanel() {
        this.panel?.classList.remove("translate-x-full");
    }
    
    closePanel() {
        this.panel?.classList.add("translate-x-full");
    }
}