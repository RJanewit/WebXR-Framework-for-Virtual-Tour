import { EventBus } from '../utils/EventBus.js';

export class UIManager {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.navBar = document.getElementById('nav-bar');

        // IDs เก่า (เผื่อในไฟล์ tour.html ยังใช้ HTML แบบเก่า)
        this.popupOverlay = document.getElementById('popup-overlay');
        this.popupImage = document.getElementById('popup-image');
        this.videoPopupOverlay = document.getElementById('video-popup-overlay');
        this.popupVideo = document.getElementById('popup-video');
        this.modelOverlay = document.getElementById('model-overlay');
        
        this.mapBtn = document.getElementById('map-button');
        this.mapOverlay = document.getElementById('map-overlay');
        this.closeMapBtn = document.getElementById('close-map');
        this.mapDots = document.querySelectorAll('.map-dot');

        this.langEnBtn = document.getElementById('lang-en');
        this.langThBtn = document.getElementById('lang-th');
        this.menuBtn = document.getElementById('menuBtn');
        this.menuDropdown = document.getElementById('menuDropdown');
        this.showGuideBtn = document.getElementById('showGuideBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');

        this.soundBtn = document.getElementById('webSoundBtn');
        this.iconOn = document.getElementById('webIconOn');
        this.iconOff = document.getElementById('webIconOff');
        this.isMuted = localStorage.getItem('tourAudioMuted') === 'true';

        this.bindEvents();
        this.checkInitialStates();
    }

    initMediaModals() {
        // IDs ใหม่ (จากหน้า Admin)
        this.imageModal = document.getElementById("image-modal");
        this.imgContent = document.getElementById("modal-image-content");
        
        this.videoModal = document.getElementById("video-modal");
        this.videoContent = document.getElementById("modal-video-content");
        
        this.modelModal = document.getElementById("model-modal");
        this.modelContent = document.getElementById("modal-model-content");
        this.modelContainer = document.getElementById("modal-model-container");

        document.getElementById("btn-close-image")?.addEventListener("click", () => this.hideImagePopup());
        document.getElementById("btn-close-video")?.addEventListener("click", () => this.hideVideoPopup());
        document.getElementById("btn-close-model")?.addEventListener("click", () => this.hideModelViewer());

        this.imageModal?.addEventListener("click", (e) => { if(e.target === this.imageModal) this.hideImagePopup() });
        this.videoModal?.addEventListener("click", (e) => { if(e.target === this.videoModal) this.hideVideoPopup() });
        this.modelModal?.addEventListener("click", (e) => { if(e.target === this.modelModal) this.hideModelViewer() });
    }

    showImagePopup(imageUrl) {
        if (this.imageModal && this.imgContent) {
            this.imgContent.src = imageUrl; 
            this.imageModal.classList.remove("hidden");
            setTimeout(() => {
                this.imageModal.classList.remove("opacity-0");
                this.imgContent.classList.remove("scale-95");
            }, 10);
        } else if (this.popupOverlay && this.popupImage) { // Fallback ของเก่า
            this.popupImage.src = imageUrl;
            this.popupOverlay.style.display = 'flex';
        }
    }

    hideImagePopup() {
        if (this.imageModal) {
            this.imageModal.classList.add("opacity-0");
            this.imgContent?.classList.add("scale-95");
            setTimeout(() => {
                this.imageModal.classList.add("hidden");
                if(this.imgContent) this.imgContent.src = "";
            }, 300);
        } else if (this.popupOverlay) {
            this.popupOverlay.style.display = 'none';
            if(this.popupImage) this.popupImage.src = "";
        }
        EventBus.emit('ui:setPaused', { paused: false });
    }

    showVideoPopup(videoUrl) {
        if (this.videoModal && this.videoContent) {
            this.videoContent.src = videoUrl;
            this.videoModal.classList.remove("hidden");
            setTimeout(() => {
                this.videoModal.classList.remove("opacity-0");
                this.videoContent.classList.remove("scale-95");
                this.videoContent.play().catch(e => console.warn("Autoplay blocked by browser:", e));
            }, 10);
        } else if (this.videoPopupOverlay && this.popupVideo) {
            this.popupVideo.src = videoUrl;
            this.videoPopupOverlay.style.display = 'flex';
            this.popupVideo.play().catch(e => console.warn(e));
        }
    }

    hideVideoPopup() {
        if (this.videoModal) {
            this.videoModal.classList.add("opacity-0");
            this.videoContent?.classList.add("scale-95");
            setTimeout(() => {
                this.videoModal.classList.add("hidden");
                if(this.videoContent) {
                    this.videoContent.pause();
                    this.videoContent.currentTime = 0;
                    this.videoContent.src = "";
                }
            }, 300);
        } else if (this.videoPopupOverlay) {
            this.videoPopupOverlay.style.display = 'none';
            if(this.popupVideo) {
                this.popupVideo.pause(); 
                this.popupVideo.src = ""; 
            }
        }
    }

    showModelViewer(modelPath) {
        if (this.modelModal && this.modelContent) {
            this.modelContent.src = modelPath;
            this.modelModal.classList.remove("hidden");
            setTimeout(() => {
                this.modelModal.classList.remove("opacity-0");
                this.modelContainer?.classList.remove("scale-95");
            }, 10);
        } else if (this.modelOverlay) {
            const iframe = this.modelOverlay.querySelector('iframe');
            if(iframe) iframe.src = modelPath;
            this.modelOverlay.style.display = 'flex';
        }
    }

    hideModelViewer() {
        if (this.modelModal) {
            this.modelModal.classList.add("opacity-0");
            this.modelContainer?.classList.add("scale-95");
            setTimeout(() => {
                this.modelModal.classList.add("hidden");
                if(this.modelContent) this.modelContent.src = "";
            }, 300);
        } else if (this.modelOverlay) {
            this.modelOverlay.style.display = 'none';
            const iframe = this.modelOverlay.querySelector('iframe');
            if(iframe) iframe.src = "";
        }
    }

    bindEvents() {
        document.querySelector('.close-btn')?.addEventListener('click', () => this.hideImagePopup());
        this.popupOverlay?.addEventListener('click', (e) => { if(e.target === this.popupOverlay) this.hideImagePopup(); });

        document.querySelector('.video-close-btn')?.addEventListener('click', () => this.hideVideoPopup());
        this.videoPopupOverlay?.addEventListener('click', (e) => { if(e.target === this.videoPopupOverlay) this.hideVideoPopup(); });

        document.querySelector('.model-close-btn')?.addEventListener('click', () => this.hideModelViewer());

        this.mapBtn?.addEventListener('click', () => {
            this.mapOverlay.style.display = 'flex';
            setTimeout(() => { this.mapOverlay.style.opacity = '1'; }, 10);
        });
        this.closeMapBtn?.addEventListener('click', () => this.hideMap());
        this.mapOverlay?.addEventListener('click', (e) => { if (e.target === this.mapOverlay) this.hideMap(); });

        this.langEnBtn?.addEventListener('click', () => this.switchLanguage('en'));
        this.langThBtn?.addEventListener('click', () => this.switchLanguage('th'));

        this.menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.menuDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => this.menuDropdown?.classList.add('hidden'));

        this.showGuideBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showImagePopup('assets/img/uxui/guide.png');
            EventBus.emit('ui:setPaused', { paused: true });
            this.menuDropdown?.classList.add('hidden');
        });

        this.fullscreenBtn?.addEventListener('click', () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        });

        this.soundBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleSound();
        });
    }

    checkInitialStates() {
        if (localStorage.getItem('requestFullscreen') === 'true') {
            document.documentElement.requestFullscreen().catch(() => console.log("Auto-fullscreen blocked"));
        }
        
        const savedLang = localStorage.getItem('tourLang') || 'th';
        this.switchLanguage(savedLang);
        this.updateSoundUI();
    }

    hideMap() {
        if (!this.mapOverlay) return;
        this.mapOverlay.style.opacity = '0';
        setTimeout(() => { this.mapOverlay.style.display = 'none'; }, 400);
    }

    switchLanguage(lang) {
        if (!this.langEnBtn || !this.langThBtn) return;
        
        const activeClass = 'text-[#20CDFA]';
        const inactiveClass = 'opacity-50';

        if (lang === 'en') {
            this.langEnBtn.classList.add(activeClass); this.langEnBtn.classList.remove(inactiveClass);
            this.langThBtn.classList.remove(activeClass); this.langThBtn.classList.add(inactiveClass);
        } else {
            this.langThBtn.classList.add(activeClass); this.langThBtn.classList.remove(inactiveClass);
            this.langEnBtn.classList.remove(activeClass); this.langEnBtn.classList.add(inactiveClass);
        }
        
        localStorage.setItem('tourLang', lang);
        EventBus.emit('ui:langChanged', { lang });
    }

    hideLoading() {
        if (!this.loadingScreen) return;
        this.loadingScreen.style.opacity = '0';
        setTimeout(() => { 
            this.loadingScreen.remove();
            if(this.navBar) this.navBar.classList.remove('hidden-nav');
        }, 500);
    }

    updateNavBarStatus(currentZone, visitedZones, navPoints) {
        navPoints.forEach(point => {
            const dot = document.getElementById(`nav-${point.htmlId}`);
            if (!dot) return;

            dot.classList.remove('current');
            if (visitedZones.has(point.zoneName)) dot.classList.add('visited');
            if (point.zoneName === currentZone) dot.classList.add('current', 'visited');
        });
    }

    toggleSound() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('tourAudioMuted', this.isMuted);
        this.updateSoundUI();
        EventBus.emit('ui:toggleSound', { isMuted: this.isMuted });
    }

    updateSoundUI() {
        if (!this.iconOn || !this.iconOff) return;
        if (this.isMuted) {
            this.iconOn.classList.add('hidden');
            this.iconOff.classList.remove('hidden');
        } else {
            this.iconOn.classList.remove('hidden');
            this.iconOff.classList.add('hidden');
        }
    }
}