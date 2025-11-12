import CCNAState from './state.js';
import { initRouter } from '../ui/router.js';
import { initAudioSystem } from './audio.js';
import { initAccessibility } from '../utils/accessibility.js';
import { initAnalytics } from '../utils/analytics.js';
import { checkForUpdates } from './updates.js';
import './offline-monitor.js';

export class CCNAMastery {
  constructor() {
    this.state = CCNAState;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    console.info('[APP] Initializing CCNA Mastery Platform...');
    
    // Initialize core systems
    await Promise.all([
      this.initSettings(),
      initAudioSystem(),
      initAccessibility(),
      initAnalytics()
    ]);
    
    // Initialize routing
    initRouter();
    
    // Setup PWA features
    this.setupPWA();
    
    // Check for content updates
    checkForUpdates();
    
    // Preload critical data
    this.preloadData();
    
    this.initialized = true;
    console.info('[APP] Initialization complete');
    
    // Fire custom event for analytics
    document.dispatchEvent(new CustomEvent('app:ready', { 
      detail: { version: '3.1.0', timestamp: Date.now() }
    }));
  }

  async initSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('ccna_settings') || '{}');
    this.state.setState({ settings: { ...this.state.state.settings, ...savedSettings } });
    
    // Apply saved theme preference
    if (savedSettings.darkMode !== undefined) {
      document.documentElement.classList.toggle('dark-mode', savedSettings.darkMode);
    }
  }

  setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.info('[PWA] Service worker registered:', registration.scope);
          
          // Setup install prompt
          let deferredPrompt;
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.state.setState({ installPrompt: deferredPrompt });
            document.dispatchEvent(new CustomEvent('app:installable'));
          });
          
          // Handle app update available
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;
            
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                document.dispatchEvent(new CustomEvent('app:update-available'));
              }
            };
          };
        })
        .catch(error => console.error('[PWA] Registration failed:', error));
    }
    
    // Handle offline status
    window.addEventListener('online', () => this.state.updateNetworkStatus(true));
    window.addEventListener('offline', () => this.state.updateNetworkStatus(false));
  }

  preloadData() {
    // Preload critical data in background
    const preloadTasks = [
      fetch('/data/questions.json').catch(() => null),
      fetch('/data/subnetting.json').catch(() => null),
      fetch('/data/labs.json').catch(() => null)
    ];
    
    Promise.all(preloadTasks).then(results => {
      console.info('[APP] Preloaded critical data:', 
        results.filter(r => r !== null).length, 
        'of', 
        results.length,
        'resources'
      );
    });
  }

  async trackProgress(module, itemId, status) {
    const progress = { ...this.state.state.progress };
    if (!progress[module]) progress[module] = {};
    
    progress[module][itemId] = {
      status,
      timestamp: Date.now(),
      attempts: (progress[module][itemId]?.attempts || 0) + 1
    };
    
    this.state.setState({ progress });
    
    // Sync if online
    if (!this.state.state.offline) {
      await this.syncProgress();
    }
  }

  async syncProgress() {
    if (this.state.state.offline) return;
    
    try {
      const response = await fetch('/api/sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state.state.progress)
      });
      
      if (response.ok) {
        console.info('[APP] Progress synced successfully');
        localStorage.setItem('lastSync', Date.now().toString());
      }
    } catch (error) {
      console.error('[APP] Progress sync failed:', error);
      // Schedule background sync
      if ('serviceWorker' in navigator && 'sync' in registration) {
        navigator.serviceWorker.ready.then(reg => reg.sync.register('background-sync'));
      }
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.ccnaApp = new CCNAMastery();
  window.ccnaApp.init().catch(console.error);
});
