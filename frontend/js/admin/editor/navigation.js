const mapBtn = document.getElementById("map-editor-btn");
const sceneBtn = document.getElementById("scene-editor-btn");
const accountBtn = document.getElementById("account-manager-btn");
const modeMap = document.getElementById("mode-map");
const modeScene = document.getElementById("mode-scene");
const modeAccount = document.getElementById("mode-account");

let isPanelOpen = true;

function clearActiveNavs() {
    mapBtn.classList.remove("nav-active");
    sceneBtn.classList.remove("nav-active");
    accountBtn.classList.remove("nav-active");
}

mapBtn.addEventListener("click", () => {
    clearActiveNavs();
    mapBtn.classList.add("nav-active");

    modeScene.classList.add("hidden");
    modeScene.classList.remove("flex");

    modeMap.classList.remove("hidden");
    modeMap.classList.add("flex");

    modeAccount.classList.add("hidden");
    modeAccount.classList.remove("flex");
    
    if (typeof renderZones === 'function') renderZones();
});

accountBtn.addEventListener("click", () => {
    clearActiveNavs();
    accountBtn.classList.add("nav-active");

    modeAccount.classList.remove("hidden");
    modeAccount.classList.add("flex");

    modeScene.classList.add("hidden");
    modeScene.classList.remove("flex");

    modeMap.classList.add("hidden");
    modeMap.classList.remove("flex");

    if (typeof renderAccounts === 'function') renderAccounts();
});

sceneBtn.addEventListener("click", () => {
    clearActiveNavs();
    sceneBtn.classList.add("nav-active");

    modeMap.classList.add("hidden");
    modeMap.classList.remove("flex");

    modeScene.classList.remove("hidden");
    modeScene.classList.add("flex");

    modeAccount.classList.add("hidden");
    modeAccount.classList.remove("flex");
    
    if (typeof loadScenesFromAPI === 'function') loadScenesFromAPI();
});

document.addEventListener("DOMContentLoaded", () => {
    mapBtn.click();
});