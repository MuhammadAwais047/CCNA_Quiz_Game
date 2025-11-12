// Remove inline manifest registration
// Remove service worker registration from inline script

// Properly load data from data.json
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Failed to load data');
    return await response.json();
  } catch (error) {
    console.error('Error loading data:', error);
    // Fallback to hardcoded data if fetch fails
    return {
      questions: questionBank,
      subnetting: subnetProblems,
      labs: labScenarios
    };
  }
}
// Initialize audio context on user interaction
document.addEventListener('click', () => {
  // Create audio context
  if (typeof AudioContext !== 'undefined') {
    window.audioContext = new AudioContext();
  }
  
  // Load all audio files
  document.querySelectorAll('audio').forEach(audio => {
    audio.load();
  });
  
  // Remove the event listener after first click
  document.removeEventListener('click', arguments.callee);
});
// Initialize app after DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  // Load data first
  const data = await loadData();
  window.appData = data;
  
  // Register service worker properly
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  
  // Initialize app with loaded data
  initApp();
});
