import * as THREE from "three";
 export class TourMathUtils {

    static getCameraYawAngle(camera) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        let radians = Math.atan2(-direction.x, -direction.z);
        let degrees = radians * (180 / Math.PI);
        if (degrees < 0) degrees += 360;
        return Math.round(degrees);
    }

    static getSpawnPosition(camera, distance = 2) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        return new THREE.Vector3().copy(camera.position).add(direction.multiplyScalar(distance));
    }

    static applyUnscaledPosToMesh(mesh, unscaledPos) {
        const cameraPos = new THREE.Vector3(0, 1.6, 0);
        const dir = new THREE.Vector3().subVectors(unscaledPos, cameraPos);
        const originalDistance = dir.length() || 1;
        const targetDistance = 400;

        dir.normalize().multiplyScalar(targetDistance);
        const renderPos = new THREE.Vector3().addVectors(cameraPos, dir);

        mesh.position.copy(renderPos);
        const scaleFactor = targetDistance / originalDistance;
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

        if (mesh.userData.basePos) {
            mesh.userData.basePos.copy(renderPos);
            if (mesh.userData.type === "arrow") {
                mesh.userData.floatAmp = 0.25 * scaleFactor;
            }

        }
    }

    static updateUnscaledPosFromGizmo(mesh, renderX, renderY, renderZ) {
        const cameraPos = new THREE.Vector3(0, 1.6, 0);
        const renderPos = new THREE.Vector3(renderX, renderY, renderZ);
        const dir = new THREE.Vector3().subVectors(renderPos, cameraPos).normalize();

        let unscaledDist = 15;
        if (mesh.userData.unscaledPos) {
            unscaledDist = mesh.userData.unscaledPos.distanceTo(cameraPos);
        } else {
            unscaledDist = 400 / mesh.scale.x;
        }

        const unscaledPos = cameraPos.clone().add(dir.multiplyScalar(unscaledDist));

        if (!mesh.userData.unscaledPos) {
            mesh.userData.unscaledPos = new THREE.Vector3();
        }
        mesh.userData.unscaledPos.copy(unscaledPos);

        if (mesh.userData.basePos) {
            mesh.userData.basePos.copy(renderPos);
        }
        return unscaledPos;
    }
}