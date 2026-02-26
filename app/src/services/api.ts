import axios from 'axios';

const api = axios.create();

// Dynamic base URL and path helper
api.interceptors.request.use((config) => {
  const backendMode = localStorage.getItem('safestep_backend_mode') || 'node';
  const phpUrl = localStorage.getItem('safestep_php_url') || '';
  
  // If PHP mode, we use the provided URL
  if (backendMode === 'php' && phpUrl) {
    config.baseURL = phpUrl;
  } else {
    // For Node mode, we don't set a baseURL here to avoid slash resolution issues
    // Instead, getEndpoint will provide the full path starting with /api
    config.baseURL = '';
  }

  const token = localStorage.getItem('safestep_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Helper to get the correct endpoint path based on backend mode
 */
export const getEndpoint = (path: string) => {
  const backendMode = localStorage.getItem('safestep_backend_mode') || 'node';
  
  if (backendMode === 'node') {
    // On s'assure qu'il n'y a pas de slash au début pour rester relatif au dossier courant
    return 'api' + (path.startsWith('/') ? path : '/' + path);
  }

  // Mapping for PHP endpoints in SafeStep-main structure
  const mapping: Record<string, string> = {
    '/auth/login': '/api/auth/login.php',
    '/epi': '/api/epis/index.php',
    '/sync': '/api/sync/index.php',
    '/meteo': '/api/external/meteo.php',
    '/trafic': '/api/external/trafic.php',
    '/sites': '/api/sites/index.php'
  };

  return mapping[path] || path;
};

export default api;
