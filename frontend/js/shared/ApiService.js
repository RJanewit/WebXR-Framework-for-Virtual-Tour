export class ApiService {
    constructor() {
        const currentHost = window.location.hostname;

        if (currentHost === "localhost" || currentHost === "127.0.0.1") {
            this.baseUrl = "https://localhost:3443/api";
        } else {
            this.baseUrl = "/api";
        }
    }

    async fetchInitialData() {
        try {
            const [scenesRes, hotspotsRes, zonesRes] = await Promise.all([
                fetch(`${this.baseUrl}/scenes`),
                fetch(`${this.baseUrl}/hotspots`),
                fetch(`${this.baseUrl}/zones`)
            ]);

            if (!scenesRes.ok || !hotspotsRes.ok || !zonesRes.ok) {
                throw new Error("Failed to fetch initial data");
            }

            const scenesData = await scenesRes.json();
            const hotspotsData = await hotspotsRes.json();
            const zonesData = await zonesRes.json();

            return { scenesData, hotspotsData, zonesData };

        } catch (error) {
            console.error("Error fetching initial data:", error);
            throw error;
        }
    }

    async updateSceneStartRotation(sceneName, angle) {
        const response = await fetch(`${this.baseUrl}/scenes/${sceneName}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_rotation: angle })
        });
        if (!response.ok) throw new Error("Failed to update scene start rotation");
        return await response.json();
    }

    async createHotspot(payload) {
        const response = await fetch(`${this.baseUrl}/hotspots`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to create hotspot");
        return await response.json();
    }

    async updateHotspot(id, payload) {
        const response = await fetch(`${this.baseUrl}/hotspots/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to update hotspot");
        return await response.json();
    }

    async deleteHotspot(id) {
        const response = await fetch(`${this.baseUrl}/hotspots/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) throw new Error("Failed to delete hotspot");
        return await response.json();
    }

    async updateZoneMapPosition(zoneName, mapX, mapY) {
        const response = await fetch(`${this.baseUrl}/zones/${zoneName}/map`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ map_x: mapX, map_y: mapY })
        });
        if (!response.ok) throw new Error("Failed to update map position");
        return await response.json();
    }

    async createZone(payload) {
        const response = await fetch(`${this.baseUrl}/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to create zone");
        return await response.json();
    }

    async deleteZone(id) {
        const response = await fetch(`${this.baseUrl}/zones/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Failed to delete zone");
        return await response.json();
    }

    async updateZone(id, name) {
        const response = await fetch(`${this.baseUrl}/zones/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error("Failed to update zone");
        return await response.json();
    }

    async reorderZones(orderedNames) {
        const response = await fetch(`${this.baseUrl}/zones/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedNames })
        });
        if (!response.ok) throw new Error("Failed to reorder zones");
        return await response.json();
    }
}