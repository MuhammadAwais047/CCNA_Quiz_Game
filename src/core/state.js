class CCNAState {
  constructor() {
    this.state = {
      user: { id: null, preferences: {} },
      progress: this.loadProgress(),
      session: {
        startTime: Date.now(),
        mode: null,
        streak: 0,
        score: 0
      },
      settings: {
        soundEnabled: true,
        hintsEnabled: true,
        darkMode: true,
        animationsEnabled: true
      },
      offline: !navigator.onLine
    };
    
    this.listeners = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => this.updateNetworkStatus(true));
    window.addEventListener('offline', () => this.updateNetworkStatus(false));
    window.addEventListener('beforeunload', () => this.persistState());
  }

  updateNetworkStatus(isOnline) {
    this.setState({ offline: !isOnline });
    this.syncWhenOnline();
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
    this.persistState();
  }

  subscribe(componentName, callback) {
    this.listeners.set(componentName, callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.state));
  }

  loadProgress() {
    return JSON.parse(localStorage.getItem('ccna_progress')) || {
      quizzes: {},
      labs: {},
      subnetting: {},
      lastSync: Date.now()
    };
  }

  persistState() {
    localStorage.setItem('ccna_progress', JSON.stringify(this.state.progress));
    localStorage.setItem('ccna_settings', JSON.stringify(this.state.settings));
  }

  syncWhenOnline() {
    if (this.state.offline) return;
    // Implement background sync logic
  }
}

// Singleton instance
export default new CCNAState();
