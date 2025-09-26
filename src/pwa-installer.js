const SW_PATH = '/service-worker.js';
const INSTALL_BUTTON_ID = 'install-app-button';
const PWA_READY_KEY = 'genpwd-pro:pwa-ready';
const TOAST_CONTAINER_ID = 'pwa-toast-container';
const TOAST_DURATION = 4000;

let deferredPrompt = null;
let installButton = null;
let isControllerChanging = false;

function init() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers non supportés');
    return;
  }

  prepareInstallButton();
  registerServiceWorker();
  listenToBeforeInstallPrompt();
  listenToAppInstalled();
}

function showToast(message, type = 'info') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `pwa-toast pwa-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, TOAST_DURATION);
}

function getToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'pwa-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  return container;
}

function prepareInstallButton() {
  installButton = document.getElementById(INSTALL_BUTTON_ID);

  if (!installButton) {
    installButton = document.createElement('button');
    installButton.id = INSTALL_BUTTON_ID;
    installButton.type = 'button';
    installButton.className = 'btn ghost';
    installButton.style.display = 'none';
    installButton.innerText = '📥 Installer l\'app';

    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.appendChild(installButton);
    } else {
      document.body.appendChild(installButton);
    }
  }

  installButton.addEventListener('click', handleInstallClick);
}

function handleInstallClick() {
  if (!deferredPrompt) {
    showToast('Installation impossible pour le moment.', 'error');
    return;
  }

  installButton.disabled = true;

  deferredPrompt.prompt();
  deferredPrompt.userChoice
    .then(({ outcome }) => {
      if (outcome === 'accepted') {
        showToast('Installation de GenPwd Pro…', 'success');
        hideInstallButton();
      } else {
        showToast('Installation annulée.', 'info');
        // Autoriser un nouvel essai si un nouvel événement est déclenché
        installButton.style.display = 'inline-flex';
      }
    })
    .catch((error) => {
      console.error('[PWA] Erreur lors de l\'installation', error);
      showToast('Impossible de lancer l\'installation.', 'error');
    })
    .finally(() => {
      deferredPrompt = null;
      installButton.disabled = false;
    });
}

function listenToBeforeInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    if (!isStandalone()) {
      installButton.style.display = 'inline-flex';
      showToast('Installez GenPwd Pro pour un accès rapide hors ligne.', 'info');
    }
  });
}

function listenToAppInstalled() {
  window.addEventListener('appinstalled', () => {
    showToast('GenPwd Pro est installée sur cet appareil.', 'success');
    hideInstallButton();
  });
}

function hideInstallButton() {
  if (installButton) {
    installButton.style.display = 'none';
  }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    monitorServiceWorkerUpdates(registration);

    if (!localStorage.getItem(PWA_READY_KEY)) {
      showToast('Mode hors ligne prêt ✨', 'success');
      localStorage.setItem(PWA_READY_KEY, '1');
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isControllerChanging) {
        return;
      }
      isControllerChanging = true;
      showToast('Nouvelle version installée. Rechargement…', 'info');
      setTimeout(() => window.location.reload(), 800);
    });
  } catch (error) {
    console.error('[PWA] Enregistrement SW échoué', error);
    showToast('Mode hors ligne indisponible.', 'error');
  }
}

function monitorServiceWorkerUpdates(registration) {
  if (!registration) {
    return;
  }

  if (registration.waiting) {
    notifyAboutUpdate(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) {
      return;
    }

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          notifyAboutUpdate(registration.waiting || newWorker);
        } else {
          showToast('GenPwd Pro est prête à fonctionner hors ligne.', 'success');
        }
      }
    });
  });
}

function notifyAboutUpdate(worker) {
  if (!worker) {
    return;
  }

  const shouldUpdate = window.confirm('Une nouvelle version de GenPwd Pro est disponible. L\'installer maintenant ?');
  if (shouldUpdate) {
    worker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    showToast('Mise à jour reportée. Pensez à recharger plus tard.', 'info');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

