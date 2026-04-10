// js/UIManager.js

export class UIManager {
    constructor() {
        // --- ดึง Elements ทั้งหมด ---
        this.loadingScreen = document.getElementById('loading-screen');
        this.navBar = document.getElementById('nav-bar');
        
        // Popups
        this.popupOverlay = document.getElementById('popup-overlay');
        this.popupImage = document.getElementById('popup-image');
        this.videoPopupOverlay = document.getElementById('video-popup-overlay');
        this.popupVideo = document.getElementById('popup-video');
        this.modelOverlay = document.getElementById('model-overlay');
        
        // 🌟 แผนที่
        this.mapBtn = document.getElementById('map-button');
        this.mapOverlay = document.getElementById('map-overlay');
        this.closeMapBtn = document.getElementById('close-map');
        this.mapDots = document.querySelectorAll('.map-dot');

        // 🌟 เมนู & ทั่วไป
        this.soundBtn = document.getElementById('webSoundBtn');
        this.langEnBtn = document.getElementById('lang-en');
        this.langThBtn = document.getElementById('lang-th');
        this.menuBtn = document.getElementById('menuBtn');
        this.menuDropdown = document.getElementById('menuDropdown');
        this.showGuideBtn = document.getElementById('showGuideBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');

        this.bindEvents();
        this.checkInitialStates();
    }

    bindEvents() {
        // --- 1. Popups (รูป, วิดีโอ, โมเดล) ---
        document.querySelector('.close-btn')?.addEventListener('click', () => this.hideImagePopup());
        this.popupOverlay?.addEventListener('click', (e) => { if(e.target === this.popupOverlay) this.hideImagePopup(); });

        document.querySelector('.video-close-btn')?.addEventListener('click', () => this.hideVideoPopup());
        this.videoPopupOverlay?.addEventListener('click', (e) => { if(e.target === this.videoPopupOverlay) this.hideVideoPopup(); });

        document.querySelector('.model-close-btn')?.addEventListener('click', () => this.hideModelViewer());

        // --- 2. แผนที่ (Map) ---
        this.mapBtn?.addEventListener('click', () => {
            this.mapOverlay.style.display = 'flex';
            setTimeout(() => { this.mapOverlay.style.opacity = '1'; }, 10);
        });
        this.closeMapBtn?.addEventListener('click', () => this.hideMap());
        this.mapOverlay?.addEventListener('click', (e) => { if (e.target === this.mapOverlay) this.hideMap(); });

        // --- 3. ภาษา (Language) ---
        this.langEnBtn?.addEventListener('click', () => this.switchLanguage('en'));
        this.langThBtn?.addEventListener('click', () => this.switchLanguage('th'));

        // --- 4. เมนู (Menu) ---
        this.menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.menuDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => this.menuDropdown?.classList.add('hidden'));

        // --- 5. คู่มือ & เต็มจอ ---
        this.showGuideBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showImagePopup('assets/img/uxui/แนะนำการใช้งาน.png');
            if (window.tourEngine) window.tourEngine.isPaused = true;
            this.menuDropdown?.classList.add('hidden');
        });

        this.fullscreenBtn?.addEventListener('click', () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        });

        // --- 6. ปุ่มเสียง (Sound) ---
        this.soundBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.tourEngine) window.tourEngine.toggleSound();
        });
    }

    checkInitialStates() {
        if (localStorage.getItem('requestFullscreen') === 'true') {
            document.documentElement.requestFullscreen().catch(() => console.log("Auto-fullscreen blocked"));
        }
        
        const savedLang = localStorage.getItem('tourLang') || 'th';
        this.switchLanguage(savedLang);
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
        if (window.tourEngine && window.tourEngine.vrLangBtn) {
            window.tourEngine.currentLang = lang;
            window.tourEngine.vrLangBtn.material.map = window.tourEngine.createLanguageTexture(lang);
            window.tourEngine.vrLangBtn.material.needsUpdate = true;
        }
    }

    hideLoading() {
        if (!this.loadingScreen) return;
        this.loadingScreen.style.opacity = '0';
        setTimeout(() => { 
            this.loadingScreen.remove();
            if(this.navBar) this.navBar.classList.remove('hidden-nav');
        }, 500);
    }

    showImagePopup(imageUrl) {
        if (!this.popupImage || !this.popupOverlay) return;
        this.popupImage.src = imageUrl;
        this.popupOverlay.style.display = 'flex';
    }

    hideImagePopup() {
        if (!this.popupOverlay) return;
        this.popupOverlay.style.display = 'none';
        this.popupImage.src = "";
        if (window.tourEngine) window.tourEngine.isPaused = false;
    }

    showVideoPopup(videoUrl) {
        if (!this.popupVideo || !this.videoPopupOverlay) return;
        this.popupVideo.src = videoUrl;
        this.videoPopupOverlay.style.display = 'flex';
        this.popupVideo.play(); 
    }

    hideVideoPopup() {
        if (!this.videoPopupOverlay) return;
        this.videoPopupOverlay.style.display = 'none';
        this.popupVideo.pause(); 
        this.popupVideo.src = ""; 
    }

    showModelViewer() { if (this.modelOverlay) this.modelOverlay.style.display = 'flex'; }
    hideModelViewer() { if (this.modelOverlay) this.modelOverlay.style.display = 'none'; }

    updateNavBarStatus(currentZone, visitedZones, navPoints) {
        navPoints.forEach(point => {
            const dot = document.getElementById(`nav-${point.htmlId}`);
            if (!dot) return;

            dot.classList.remove('current');
            if (visitedZones.has(point.zoneName)) dot.classList.add('visited');
            if (point.zoneName === currentZone) dot.classList.add('current', 'visited');
        });
    }
}