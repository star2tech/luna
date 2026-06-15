/**
 * Electron Bridge — Connects Luna's web app with Electron desktop features.
 * This file is a no-op when running in a regular browser.
 */
(function () {
  const isElectron = window.electronAPI && window.electronAPI.isElectron;

  if (!isElectron) {
    console.log('Running in browser mode (no Electron features)');
    return;
  }

  console.log('Running in Electron desktop mode');

  // Notify main process when a clap is detected (to show window from tray)
  const originalShowListening = Luna.ui.showListening;
  Luna.ui.showListening = function () {
    window.electronAPI.notifyClapDetected();
    originalShowListening.call(Luna.ui);
  };

  const originalShowUrgent = Luna.ui.showUrgent;
  Luna.ui.showUrgent = function () {
    window.electronAPI.notifyClapDetected();
    originalShowUrgent.call(Luna.ui);
  };

  // Handle toggle-listening from tray menu
  window.electronAPI.onToggleListening((enabled) => {
    const statusText = document.getElementById('standby-status-text');
    if (enabled) {
      if (statusText) statusText.textContent = 'Listening for claps\u2026';
      // Resume clap detection if in standby
      if (Luna.state.phase === 'standby') {
        document.querySelector('.status-dot').style.background = 'var(--success)';
      }
    } else {
      if (statusText) statusText.textContent = 'Paused \u2014 clap detection disabled';
      document.querySelector('.status-dot').style.background = 'var(--text-dim)';
    }
    Luna.state.listeningEnabled = enabled;
  });

  // Add platform-specific styling
  window.electronAPI.getPlatform().then((platform) => {
    document.body.classList.add(`platform-${platform}`);

    // Add draggable titlebar region for frameless window
    if (platform === 'darwin' || platform === 'win32' || platform === 'linux') {
      const style = document.createElement('style');
      style.textContent = `
        body { padding-top: 36px; }
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          -webkit-app-region: drag;
          z-index: 9999;
        }
        button, input, select, a, .settings-btn, .close-btn, .btn-primary, .btn-secondary, .btn-dismiss {
          -webkit-app-region: no-drag;
        }
      `;
      document.head.appendChild(style);
    }
  });
})();
