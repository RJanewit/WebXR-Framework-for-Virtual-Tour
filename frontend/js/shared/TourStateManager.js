export class TourStateManager {
    constructor() {
        this.scenes = [];
        this.hotspots = [];
        this.zones = [];
        this.visitedZones = new Set();
        this.currentScene = null;
        this.firstSceneName = "entrance1";
        this.navPoints = [];
    }

    setInitialData(scenes, hotspots, zones) {
        this.scenes = scenes;
        this.hotspots = hotspots;
        this.zones = zones;

        this.generateNavPoints();
    }

    generateNavPoints() {
        this.firstSceneName = this.zones.find(z => z.order === 1)?.target_scene;
        this.navPoints = this.zones.map(zone => {
            const firstScene = this.zones.find(s => s.zone === zone.name);
            return {
                zoneName: zone.name,
                htmlId: zone.name.toLowerCase().replace(/\s+/g, '-'),
                targetId: zone.target_scene,
                label: zone.name
            };
            }).filter(nav => nav.targetId !== null);
    }

    addZone(zoneData) {
        this.zones.push(zoneData);
        this.generateNavPoints();
    }

    deleteZone(zoneId) {
        this.zones = this.zones.filter(z => z.id !== zoneId && z._id !== zoneId);
        this.generateNavPoints();
    }

    getScene(name) {
        return this.scenes.find(s => s.name === name);
    }

    getZoneById(zoneName) {
        return this.zones.find(z => z.name === zoneName);
    }
    getFirstScene() {
        return this.getScene(this.firstSceneName) || this.scenes[0];
    }

    updateSceneStartRotation(sceneName, angle) {
        if (this.currentScene && this.currentScene.name === sceneName) {
            this.currentScene.start_rotation = angle;
        }
        const scene = this.getScene(sceneName);
        if (scene) scene.start_rotation = angle;
    }

    getHotspot(sceneName, targetId) {
        return this.hotspots.find(h => h.scene_id === sceneName && h.target_scene_id === targetId);
    }

    getHotspotById(dbId) {
        return this.hotspots.find(h => h.id === dbId || h._id === dbId);
    }

    getHotspotsForCurrentScene() {
        if (!this.currentScene) return [];
        return this.hotspots.filter(h => h.scene_id === this.currentScene.name);
    }

    addHotspot(payload) {
        this.hotspots.push(payload);
    }

    updateHotspot(dbId, payload) {
        const index = this.hotspots.findIndex(h => h.id === dbId || h._id === dbId);
        if (index !== -1) {
            this.hotspots[index] = { ...this.hotspots[index], ...payload };
        }
    }

    deleteHotspot(sceneName, targetId) {
        const index = this.hotspots.findIndex(h => h.scene_id === sceneName && h.target_scene_id === targetId);
        if (index !== -1) {
            this.hotspots.splice(index, 1);
        }
    }


    setCurrentScene(sceneData) {
        this.currentScene = sceneData;
        this.visitedZones.add(sceneData.zone);
    }

    generateNavPoints() {
        const sortedZones = [...this.zones].sort((a, b) => (a.order || 0) - (b.order || 0));
        
        this.navPoints = sortedZones.map(zone => {
            const firstScene = this.scenes.find(s => s.zone === zone.name);
            return {
                zoneName: zone.name,
                htmlId: zone.name.toLowerCase().replace(/\s+/g, '_'),
                targetId: firstScene ? firstScene.name : null,
                label: zone.name
            };
        }).filter(nav => nav.targetId !== null);
    }

    updateZone(id, newName) {
        const zone = this.zones.find(z => (z.id || z._id) === id);
        if (zone) zone.name = newName;
        this.generateNavPoints();
    }

    reorderZones(orderedIds) {
        this.zones.forEach(zone => {
            const id = zone.id || zone._id;
            const newIndex = orderedIds.indexOf(id);
            if (newIndex !== -1) {
                zone.order = newIndex;
            }
        });
        this.generateNavPoints();
    }
}