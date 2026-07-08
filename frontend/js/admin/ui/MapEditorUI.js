import { EventBus } from "EventBus";

export class MapEditorUI {
    constructor() {}

    init() {
        this.mapWrapper = document.getElementById("map-wrapper");
        this.isDragging = false;
        this.draggedPin = null;
        
        this.setupDragEvents();
    }

    renderPins(zones) {
        if (!this.mapWrapper) return;
        
        this.mapWrapper.querySelectorAll(".map-dot").forEach(dot => dot.remove());

        zones.forEach(zone => {

            const x = zone.position && zone.position.map_x !== undefined ? zone.position.map_x : 50;
            const y = zone.position && zone.position.map_y !== undefined ? zone.position.map_y : 50;

            const pin = document.createElement("div");
            pin.className = "map-dot";
            pin.id = `map-pin-${zone.name}`;
            pin.title = zone.name;
            pin.style.left = `${x}%`;
            pin.style.top = `${y}%`;
            pin.dataset.zoneName = zone.name;
            
            this.mapWrapper.appendChild(pin);
        });
    }

    setupDragEvents() {
        if (!this.mapWrapper) return;

        this.mapWrapper.addEventListener("mousedown", (e) => {
            if (e.target.classList.contains("map-dot")) {
                this.isDragging = true;
                this.draggedPin = e.target;
                this.draggedPin.style.cursor = "grabbing";
                e.stopPropagation();
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (!this.isDragging || !this.draggedPin) return;

            const rect = this.mapWrapper.getBoundingClientRect();
            
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;

            x = Math.max(0, Math.min(x, rect.width));
            y = Math.max(0, Math.min(y, rect.height));

            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;

            this.draggedPin.style.left = `${xPercent}%`;
            this.draggedPin.style.top = `${yPercent}%`;
        });

        document.addEventListener("mouseup", () => {
            if (this.isDragging && this.draggedPin) {
                this.draggedPin.style.cursor = "pointer";
                
                const newX = parseFloat(this.draggedPin.style.left);
                const newY = parseFloat(this.draggedPin.style.top);
                const zoneName = this.draggedPin.dataset.zoneName;

                EventBus.emit("map:pinMoved", { zoneName, x: newX, y: newY });

                this.isDragging = false;
                this.draggedPin = null;
            }
        });
    }
}