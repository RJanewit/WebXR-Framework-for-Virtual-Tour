window.activeSceneId = null; 
let isActive = false;
window.scenesData = null;

const addLinkBtn = document.getElementById("tool-link");
const addInfoBtn = document.getElementById("tool-info");
const togglePanelBtn = document.getElementById("toggle-panel-btn");
const addSceneModal = document.getElementById("add-scene-modal");
const btnOpenAddScene = document.getElementById("btn-open-add-scene");
const btnCloseSceneModal = document.getElementById("btn-close-scene-modal");
const btnSubmitScene = document.getElementById("btn-submit-scene");
const linkPanel = document.getElementById("link-to-hotspot-right-panel");
const infoPanel = document.getElementById("info-hotspot-right-panel");  
const btnCancelLink = document.getElementById("btn-cancel-link");
const btnNextInfo = document.getElementById("btn-next-info");
const btnCancelInfo = document.getElementById("btn-cancel-info");
const editorPanel = document.getElementById("editor-left-panel");
const collapseIcon = document.getElementById("collapse-icon");

window.selectTargetScene = null;
window.selectLinkToScene = function (cardElement, sceneName) {
  const container = document.getElementById("linkto-list-container");
  const cards = container.querySelectorAll(".scene-card");
  cards.forEach((card) => {
    card.classList.remove("ring-4", "ring-primary", "border-transparent");
    card.classList.add("border-white/20");
  });

  cardElement.classList.remove("border-white/20");
  cardElement.classList.add("ring-4", "ring-primary", "border-transparent");

  window.selectedTargetSceneId = sceneName;
};

window.renderSceneCards = function (scenesData) {
  window.scenesData = scenesData; 
  const container = document.getElementById("scene-list-container");
  if (!container) return;

  container.innerHTML = scenesData
    .map((scene) => {
      // 🌟 เช็คสถานะ Active ด้วย scene.name
      isActive = scene.name === window.activeSceneId;
      const imgPath = scene.image_path || scene.image_url || "";
      const thumbPath = imgPath ? imgPath.replace("panorama", "thumbnails").replace(/\.[^/.]+$/, ".webp") : "";

      return `
        <div class="relative cursor-pointer ${isActive ? "bg-primary border-2 border-primary rounded-xl overflow-hidden shadow-lg p-0.5" : "bg-white/10 border border-white/20 rounded-xl overflow-hidden hover:bg-white/20 transition-colors"}"
             onclick="window.selectScene('${scene.name}')">
             
            <div class="text-white text-sm font-medium px-3 py-1.5 flex justify-between items-center pointer-events-none">
                <span>Zone: ${scene.zone}</span>
            </div>
            <div class="relative bg-black aspect-[21/9] overflow-hidden rounded-b-lg pointer-events-none">
                <img src="${thumbPath}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <span class="absolute bottom-2 left-3 text-white text-sm font-medium">${scene.name}</span>
            </div>
            
            <div class="absolute bottom-2 right-2 flex gap-1 z-10">
                <button class="w-8 h-8 bg-primary hover:bg-blue-600 shadow-md text-white rounded flex items-center justify-center transition-colors cursor-pointer" 
                        onclick="event.stopPropagation(); editScene('${scene.name}')">
                    <i class="fa-solid fa-pen-to-square text-[14px]"></i>
                </button>
            </div>
        </div>`;
    })
    .join("");
};

window.renderLinkToCards = function (scenesData) {
  const container = document.getElementById("linkto-list-container");
  if (!container) return;

  container.innerHTML = scenesData
    .map((scene) => {
      const imgPath = scene.image_path || scene.image_url || "";
      const thumbPath = imgPath
        ? imgPath
            .replace("panorama", "thumbnails")
            .replace(/\.[^/.]+$/, ".webp")
        : "";

      return `
        <div 
          class="m-2 scene-card bg-white/10 border-2 border-white/20 rounded-xl overflow-hidden hover:bg-white/20 transition-colors cursor-pointer" onclick="selectLinkToScene(this, '${scene.name}')">
            <div class="text-white text-sm font-medium px-3 py-1.5 flex justify-between items-center pointer-events-none">
                <span>Zone: ${scene.zone}</span>
            </div>
            <div class="relative bg-black aspect-[21/9] overflow-hidden rounded-b-lg pointer-events-none">
                <img src="${thumbPath}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <span class="absolute bottom-2 left-3 text-white text-sm font-medium">${scene.name}</span>
            </div>
        </div>`;
    })
    .join("");
};

window.loadScenesFromAPI = async function () {
  const container = document.getElementById("scene-list-container");
  if (!container) return;
  container.innerHTML = `<div class="text-center text-white/50 py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading...</div>`;
  try {
    const response = await fetch("/api/scenes");
    scenesData = await response.json();
    
    if (scenesData.length > 0 && !window.activeSceneId)
      window.activeSceneId = scenesData[0].name;
      
    renderSceneCards(scenesData);
    renderLinkToCards(scenesData);
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="text-center text-red-400 py-4">Failed to load scenes</div>`;
  }
};

function togglePanel() {
  if (togglePanelBtn && editorPanel && collapseIcon) {
    togglePanelBtn.addEventListener("click", () => {
      isPanelOpen = !isPanelOpen;
      if (isPanelOpen) {
        editorPanel.style.marginLeft = "0px";
        collapseIcon.classList.remove("rotate-180");
      } else {
        editorPanel.style.marginLeft = "-340px";
        collapseIcon.classList.add("rotate-180");
      }
    });
  }
}
togglePanel();

window.selectScene = (id) => {
  activeSceneId = id;

  if (scenesData) {
    renderSceneCards(scenesData);

    const selected = scenesData.find((s) => s._id === id);

    if (selected && window.tourApp && window.tourApp.engine) {
      window.tourApp.engine.sceneManager.transitionTo(
        selected.image_path || selected.image_url,
        selected.start_rotation || 0,
        0,
        () => window.tourApp.loadScene(selected, 0),
      );
    }
  }
};

window.loadScenesFromAPI();

function closeAllPanels() {
  linkPanel.classList.add("translate-x-full");
  infoPanel.classList.add("translate-x-full");
}

function closeAllBtn() {
  addLinkBtn.classList.add("hidden");
  addInfoBtn.classList.add("hidden");
}

function openAllBtn() {
  addLinkBtn.classList.remove("hidden");
  addInfoBtn.classList.remove("hidden");
}

addLinkBtn.addEventListener("click", () => {
  closeAllBtn();
  linkPanel.classList.remove("translate-x-full");
});

addInfoBtn.addEventListener("click", () => {
  closeAllBtn();
  infoPanel.classList.remove("translate-x-full");
});

btnCancelLink.addEventListener("click", () => {
  closeAllPanels();
  openAllBtn();
});
btnCancelInfo.addEventListener("click", () => {
  closeAllPanels();
  openAllBtn();
});

btnNextInfo?.addEventListener("click", () => {
  try {
    const payload = {
      type: "info_hotspot",
    };
    closeAllPanels();
    openAllBtn();
  } catch (error) {
    console.error("Error:", error);
  }
});

if (btnOpenAddScene) {
  btnOpenAddScene.addEventListener("click", () => {
    document.getElementById("scene-name-input").value = "";
    document.getElementById("scene-zone-input").selectedIndex = 0;
    document.getElementById("scene-image-file").value = "";
    addSceneModal.classList.remove("hidden");
  });
}

if (btnCloseSceneModal) {
  btnCloseSceneModal.addEventListener("click", () => {
    addSceneModal.classList.add("hidden");
  });
}

if (btnSubmitScene) {
  btnSubmitScene.addEventListener("click", async () => {
    const name = document.getElementById("scene-name-input").value.trim();
    const zone = document.getElementById("scene-zone-input").value;
    const fileInput = document.getElementById("scene-image-file");

    const file = fileInput.files[0];

    if (!name || !file) {
      alert("Please enter a scene name and select an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("zone", zone);
    formData.append("image", file);

    const originalText = btnSubmitScene.innerHTML;
    btnSubmitScene.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    btnSubmitScene.disabled = true;

    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload scene");

      alert("Scene uploaded and added successfully!");
      addSceneModal.classList.add("hidden");
      window.loadScenesFromAPI();
    } catch (error) {
      console.error("Error saving scene:", error);
      alert("Failed to save scene. Please try again.");
    } finally {
      btnSubmitScene.innerHTML = originalText;
      btnSubmitScene.disabled = false;
    }
  });
}

document
  .getElementById("btn-delete-edit-scene")
  ?.addEventListener("click", async () => {
    const oldName = document.getElementById("edit-scene-old-name").value;
    if (!oldName) return;

    const btn = document.getElementById("btn-delete-edit-scene");
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    btn.disabled = true;

    try {
      const response = await fetch(
        `/api/scenes/${oldName}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error("Failed to delete scene");

      alert("✅ ลบ Scene สำเร็จ!");
      document.getElementById("edit-scene-modal").classList.add("hidden");
      window.loadScenesFromAPI();
    } catch (error) {
      console.error("Delete Error:", error);
      alert("❌ เกิดข้อผิดพลาดในการลบ Scene");
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });

window.editScene = (name) => {
  console.log("Edit Scene Name:", name);
  const scene = scenesData.find((s) => s.name === name);
  if (!scene) return;

  document.getElementById("edit-scene-old-name").value = scene.name;
  document.getElementById("edit-scene-name").value = scene.name;

  const zoneSelect = document.getElementById("edit-scene-zone");
  const optionExists = Array.from(zoneSelect.options).some(
    (opt) => opt.value === scene.zone,
  );
  zoneSelect.value = optionExists ? scene.zone : "Other";

  document.getElementById("edit-scene-modal").classList.remove("hidden");
};


document
  .getElementById("btn-submit-edit-scene")
  ?.addEventListener("click", async () => {
    const oldName = document.getElementById("edit-scene-old-name").value;
    const newName = document.getElementById("edit-scene-name").value.trim();
    const newZone = document.getElementById("edit-scene-zone").value;

    if (!newName) {
      alert("⚠️ กรุณากรอกชื่อ Scene");
      return;
    }

    const btn = document.getElementById("btn-submit-edit-scene");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;
    btn.disabled = true;

    try {
      const response = await fetch(
        `/api/scenes/${oldName}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, zone: newZone }),
        },
      );

      if (!response.ok) throw new Error("Failed to update scene");

      alert("✅ อัปเดตข้อมูล Scene สำเร็จ!");
      document.getElementById("edit-scene-modal").classList.add("hidden");

      window.loadScenesFromAPI();
    } catch (error) {
      console.error("Edit Error:", error);
      alert("❌ เกิดข้อผิดพลาดในการอัปเดต");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
