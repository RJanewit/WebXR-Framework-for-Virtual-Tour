import { EventBus } from "EventBus";

export class ZoneEditorUI {
    constructor() {
        this.editingZoneId = null;
    }

    init() {
        this.zoneListContainer = document.getElementById("zone-list-container");
        this.addZoneBtn = document.getElementById("btn-add-zone");
        this.sceneZoneInput = document.getElementById("scene-zone-input");
        this.editSceneZoneInput = document.getElementById("edit-scene-zone");

        this.setupEvents();
        this.initSortable();
    }

    initSortable() {
        if (this.zoneListContainer && typeof Sortable !== 'undefined') {
            Sortable.create(this.zoneListContainer, {
                handle: '.cursor-move',
                animation: 150,
                onEnd: () => {
                    const zoneElements = Array.from(this.zoneListContainer.children);
                    const newOrderNames = zoneElements.map(el => el.dataset.zoneName);
                    EventBus.emit("admin:reorderZones", newOrderNames);
                }
            });
        }
    }

    setupEvents() {
        this.addZoneBtn?.addEventListener("click", () => {
            const zoneName = prompt("ตั้งชื่อ Zone ใหม่ (เช่น: Meeting Room):");
            if (zoneName && zoneName.trim() !== "") {
                EventBus.emit("admin:createZone", { name: zoneName.trim(), order: 999, position: { map_x: 50, map_y: 50 } }); 
            }
        });

        this.zoneListContainer?.addEventListener("click", (e) => {
            const btnEdit = e.target.closest('.btn-edit-zone');
            const btnDelete = e.target.closest('.btn-delete-zone');
            const btnSave = e.target.closest('.btn-save-zone');
            const btnCancel = e.target.closest('.btn-cancel-zone');

            if (btnEdit) {
                this.editingZoneId = btnEdit.dataset.id;
                EventBus.emit("ui:refreshZones"); 
            }
            if (btnCancel) {
                this.editingZoneId = null;
                EventBus.emit("ui:refreshZones");
            }
            if (btnDelete) {
                const name = btnDelete.closest('[data-zone-name]').dataset.zoneName;
                if(confirm(`คุณแน่ใจหรือไม่ที่จะลบโซน "${name}"? \n(การลบโซนอาจทำให้ห้องที่อยู่ในโซนนี้ไม่มีจุดเชื่อมต่อบนแผนที่)`)) {
                    EventBus.emit("admin:deleteZone", name);
                }
            }
            if (btnSave) {
                const id = btnSave.dataset.id;
                const input = document.getElementById(`edit-input-${id}`);
                if (input && input.value.trim() !== "") {
                    EventBus.emit("admin:updateZone", { id, name: input.value.trim() });
                    this.editingZoneId = null;
                }
            }
        });

        this.zoneListContainer?.addEventListener("keypress", (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                const id = e.target.dataset.id;
                if (e.target.value.trim() !== "") {
                    EventBus.emit("admin:updateZone", { id, name: e.target.value.trim() });
                    this.editingZoneId = null;
                }
            }
        });
    }

    renderZoneList(zones) {
        if (!this.zoneListContainer) return;
        this.zoneListContainer.innerHTML = "";

        const sortedZones = [...zones].sort((a, b) => (a.order || 0) - (b.order || 0));

        sortedZones.forEach(zone => {
            const zoneId = zone.id || zone._id;
            const isEditing = this.editingZoneId === zoneId;
            const el = document.createElement("div");
            el.dataset.zoneId = zoneId; 
            el.dataset.zoneName = zone.name;

            if (isEditing) {
                el.innerHTML = `
                    <div class="flex items-center bg-theme-bg rounded-xl overflow-hidden shadow-sm mb-3 border border-primary/50">
                        <div class="w-10 min-w-[40px] self-stretch min-h-[56px] bg-primary flex items-center justify-center text-white shrink-0">
                            <i class="fa-solid fa-grip-vertical text-[18px]"></i>
                        </div>
                        <div class="flex-1 px-2 flex flex-col justify-center py-1.5">
                            <input type="text" id="edit-input-${zoneId}" data-id="${zoneId}" value="${zone.name}" 
                                class="w-full bg-theme-bg border border-gray-600 text-primary font-bold text-[15px] px-2 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300"
                                placeholder="Enter zone name..." autofocus>
                        </div>
                        <div class="flex items-center gap-1.5 pr-1 shrink-0">
                            <button class="btn-save-zone w-8 h-8 shrink-0 bg-saved text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-sm" data-id="${zoneId}" title="Save">
                                <i class="fa-solid fa-check text-[14px]"></i>
                            </button>
                        </div>
                        <div class="flex items-center gap-1.5 pr-3 shrink-0">
                            <button class="btn-cancel-zone w-8 h-8 shrink-0 bg-danger text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm" data-id="${zoneId}" title="Cancel">
                                <i class="fa-solid fa-xmark text-[14px]"></i>
                            </button>
                        </div>
                    </div>`;
            } else {
                el.innerHTML = `
                    <div class="flex items-center bg-[#f0f4f8] rounded-xl overflow-hidden shadow-sm mb-3">
                        <div class="cursor-move w-10 min-w-[40px] h-14 bg-primary flex items-center justify-center text-white shrink-0">
                            <i class="fa-solid fa-grip-vertical text-[18px]"></i>
                        </div>
                        <div class="flex-1 text-left font-bold text-primary text-[15px] px-3 truncate">
                            ${zone.name}
                        </div>
                        <div class="flex items-center gap-1.5 pr-3 shrink-0">
                            <button class="btn-edit-zone w-8 h-8 shrink-0 bg-primary text-white rounded-full flex items-center justify-center hover:bg-blue-800 transition-colors shadow-sm" data-id="${zoneId}" title="Edit">
                                <i class="fa-solid fa-pen-to-square text-[13px]"></i>
                            </button>
                            <button class="btn-delete-zone w-8 h-8 shrink-0 bg-primary text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm" data-id="${zoneId}" title="Delete">
                                <i class="fa-solid fa-trash-can text-[13px]"></i>
                            </button>
                        </div>
                    </div>`;
            }
            this.zoneListContainer.appendChild(el);
        });
    }

    renderZoneDropdowns(zones) {
        const sortedZones = [...zones].sort((a, b) => (a.order || 0) - (b.order || 0));
        const optionsHTML = sortedZones.map(z => `<option value="${z.name}">${z.name}</option>`).join("");
        if (this.sceneZoneInput) this.sceneZoneInput.innerHTML = optionsHTML;
        if (this.editSceneZoneInput) this.editSceneZoneInput.innerHTML = optionsHTML;
    }
}