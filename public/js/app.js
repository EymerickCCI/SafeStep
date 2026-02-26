const API_BASE = 'http://localhost:8888/SafeStep';

// --- Auth ---
const getToken = () => localStorage.getItem('token');
const setToken = t => localStorage.setItem('token', t);
const clearToken = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');

// --- Appel API générique ---
async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// --- Affichage sections ---
function showLogin() {
  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('app-section').style.display  = 'none';
}

function showApp() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';
  const user = getUser();
  if (user) document.getElementById('user-name').textContent = `${user.first_name} ${user.last_name}`;
  loadEpis();
  loadMeteo();
  loadTrafic();
}

// --- Login ---
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errEl    = document.getElementById('login-error');

  const { status, data } = await api('/api/auth/login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (status === 200) {
    setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showApp();
  } else {
    errEl.textContent = data.error || 'Erreur de connexion';
  }
});

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  showLogin();
});

// --- Charger les EPIs ---
async function loadEpis() {
  const list = document.getElementById('epis-list');
  list.innerHTML = '<p>Chargement...</p>';

  let epis = [];

  if (navigator.onLine) {
    const { status, data } = await api('/api/epis/index.php');
    if (status === 200) {
      epis = data;
      await saveEpisLocally(epis);
    }
  } else {
    epis = await getEpisLocally();
  }

  renderEpis(epis);
}

function renderEpis(epis) {
  const list = document.getElementById('epis-list');
  if (!epis.length) { list.innerHTML = '<p>Aucun EPI enregistré.</p>'; return; }

  list.innerHTML = epis.map(e => `
    <div class="epi-card">
      <span class="tag">${e.tag_ref}</span>
      <span class="category">${e.category}</span>
      <span class="status status-${e.status}">${e.status.replace('_', ' ')}</span>
      <button onclick="deleteEpi(${e.id})" class="btn-delete">Supprimer</button>
    </div>
  `).join('');
}

// --- Ajouter un EPI ---
document.getElementById('epi-form').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    tag_ref:  document.getElementById('tag_ref').value,
    status:   document.getElementById('status').value,
    category: document.getElementById('category').value,
  };

  if (navigator.onLine) {
    const { status, data } = await api('/api/epis/index.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (status === 201) {
      document.getElementById('epi-form').reset();
      loadEpis();
    } else {
      alert(data.error || 'Erreur lors de la création');
    }
  } else {
    // Offline : stockage local + file d'attente sync
    await db.epis.add({ ...payload, synced: false });
    await queueAction('CREATE', 'epi', payload);
    document.getElementById('epi-form').reset();
    loadEpis();
    showSyncBadge();
  }
});

// --- Supprimer un EPI ---
async function deleteEpi(id) {
  if (!confirm('Supprimer cet EPI ?')) return;

  const { status } = await api(`/api/epis/item.php?id=${id}`, { method: 'DELETE' });
  if (status === 200) loadEpis();
}

// --- Météo ---
async function loadMeteo() {
  const el = document.getElementById('meteo-block');
  const ville = document.getElementById('meteo-ville').value || 'Paris';

  const { status, data } = await api(`/api/external/meteo.php?ville=${encodeURIComponent(ville)}`);

  if (status === 200) {
    el.innerHTML = `
      <strong>${data.ville}</strong> — ${data.temperature}°C, ${data.description}<br>
      Vent : ${data.wind_speed} m/s | Humidité : ${data.humidity}%
      ${data.alerte ? `<p class="alerte">⚠️ ${data.alerte}</p>` : ''}
    `;
  } else {
    el.textContent = 'Données météo indisponibles.';
  }
}

document.getElementById('meteo-form').addEventListener('submit', e => {
  e.preventDefault();
  loadMeteo();
});

// --- Trafic ---
async function loadTrafic() {
  const el     = document.getElementById('trafic-block');
  const orig   = document.getElementById('trafic-origine').value || 'Paris';
  const dest   = document.getElementById('trafic-destination').value || 'Lyon';

  const { status, data } = await api(
    `/api/external/trafic.php?origine=${encodeURIComponent(orig)}&destination=${encodeURIComponent(dest)}`
  );

  if (status === 200) {
    el.innerHTML = `
      <strong>${data.origine} → ${data.destination}</strong><br>
      Durée : ${data.duree_minutes} min | Distance : ${data.distance_km} km
      ${data.note ? `<p class="note">${data.note}</p>` : ''}
    `;
  } else {
    el.textContent = 'Données trafic indisponibles.';
  }
}

document.getElementById('trafic-form').addEventListener('submit', e => {
  e.preventDefault();
  loadTrafic();
});

// --- Indicateur Online / Offline ---
function updateOnlineStatus() {
  const badge = document.getElementById('online-badge');
  if (navigator.onLine) {
    badge.textContent = '🟢 En ligne';
    badge.className = 'badge online';
    flushSyncQueue(getToken()); // rejoue la file au retour en ligne
  } else {
    badge.textContent = '🔴 Hors ligne';
    badge.className = 'badge offline';
  }
}

function showSyncBadge() {
  document.getElementById('sync-badge').style.display = 'inline';
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/SafeStep/public/sw.js')
    .then(() => console.log('[SW] Enregistré'))
    .catch(err => console.error('[SW] Erreur:', err));
}

// --- Init ---
if (getToken()) {
  showApp();
} else {
  showLogin();
}
updateOnlineStatus();
