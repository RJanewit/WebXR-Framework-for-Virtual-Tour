export class HotspotTooltipUI {
    constructor() {

    }

    init() {
        this.tooltip = document.getElementById("link-hotspot-action-tooltip");
        this.btnEdit = document.getElementById("btn-hs-edit");
        this.btnDelete = document.getElementById("btn-hs-delete");
        this.btnGo = document.getElementById("btn-hs-go");
    }

    show(clientX, clientY) {
        if (!this.tooltip) return;
        
        if (clientX !== undefined && clientY !== undefined) {
            this.tooltip.style.left = `${clientX}px`;
            this.tooltip.style.top = `${clientY}px`;
        } else {
            this.tooltip.style.left = `50%`;
            this.tooltip.style.top = `50%`;
        }
        this.tooltip.classList.remove("hidden");
    }

    hide() {
        this.tooltip?.classList.add("hidden");
    }

    onEdit(callback) {
        this.btnEdit?.addEventListener("click", () => {
            callback();
            this.hide();
        });
    }

    onDelete(callback) {
        this.btnDelete?.addEventListener("click", () => {
            callback();
            this.hide();
        });
    }

    onGo(callback) {
        this.btnGo?.addEventListener("click", () => {
            callback();
            this.hide();
        });
    }
}