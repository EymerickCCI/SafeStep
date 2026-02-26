import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Shield, 
  AlertTriangle, 
  CloudRain, 
  Car, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Plus, 
  CheckCircle2,
  Settings,
  LogOut,
  Search,
  HardHat,
  X,
  Wind,
  Thermometer,
  Clock,
  MapPin,
  Package,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, type EPI } from './db';
import api, { getEndpoint } from './services/api';
import { addToSyncQueue, syncWithServer } from './services/sync';

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-[15%] max-w-lg mx-auto bg-white rounded-[32px] shadow-2xl z-[101] overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    'conforme': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'a_inspecter': 'bg-amber-100 text-amber-700 border-amber-200',
    'endommage': 'bg-rose-100 text-rose-700 border-rose-200',
    'en_maintenance': 'bg-blue-100 text-blue-700 border-blue-200'
  };
  const labels = {
    'conforme': 'Conforme',
    'a_inspecter': 'À inspecter',
    'endommage': 'Endommagé',
    'en_maintenance': 'Maintenance'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[status as keyof typeof colors]}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('safestep_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('safestep_user') || 'null'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [weather, setWeather] = useState<any>(null);
  const [traffic, setTraffic] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'settings'>('dashboard');
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showTrafficModal, setShowTrafficModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Backend settings
  const [backendMode, setBackendMode] = useState(localStorage.getItem('safestep_backend_mode') || 'node');
  const [phpUrl, setPhpUrl] = useState(localStorage.getItem('safestep_php_url') || '');

  // Form state for adding EPI
  const [newEpi, setNewEpi] = useState({
    tag_ref: '',
    category: 'casque' as EPI['category'],
    site_id: 1,
    status: 'conforme' as EPI['status'],
    quantity: 1
  });

  const rawEpiItems = useLiveQuery(
    () => db.epi.filter(item => {
      const tagRef = item.tag_ref || '';
      const category = item.category || '';
      const query = searchQuery.toLowerCase();
      return tagRef.toLowerCase().includes(query) || category.toLowerCase().includes(query);
    }).toArray(),
    [searchQuery]
  );

  const epiItems = useMemo(() => {
    if (!rawEpiItems) return [];
    const seen = new Set();
    return rawEpiItems.filter(item => {
      const id = Number(item.id);
      if (isNaN(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [rawEpiItems]);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    
    if (isLoggedIn) {
      fetchExternalData();
      initialSync();
    }

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, [isLoggedIn]);

  const isInitialSyncing = useRef(false);

  const initialSync = async () => {
    if (navigator.onLine && !isInitialSyncing.current) {
      isInitialSyncing.current = true;
      setIsSyncing(true);
      try {
        const res = await api.get(getEndpoint('/epi'));
        
        // Robust check for array data
        if (!res.data || !Array.isArray(res.data)) {
          console.warn("Initial sync: Expected array from server, got:", res.data);
          await syncWithServer();
          return;
        }

        const data = res.data;
        
        // Ensure every item has a unique numeric ID before putting into Dexie
        const seenIds = new Set();
        const validData = data
          .filter((item: any) => {
            if (item && (item.id !== undefined && item.id !== null)) {
              const id = Number(item.id);
              if (!isNaN(id) && !seenIds.has(id)) {
                seenIds.add(id);
                return true;
              }
            }
            return false;
          })
          .map((item: any) => ({ ...item, id: Number(item.id) }));
          
        if (validData.length > 0) {
          await db.epi.bulkPut(validData);
        }
        await syncWithServer();
      } catch (e) {
        console.error("Initial sync error:", e);
      } finally {
        setIsSyncing(false);
        isInitialSyncing.current = false;
      }
    }
  };

  const fetchExternalData = async () => {
    if (!navigator.onLine) return;
    try {
      const [wRes, tRes] = await Promise.all([
        api.get(getEndpoint('/meteo'), { params: { ville: 'Chamonix' } }),
        api.get(getEndpoint('/trafic'), { params: { origine: 'Chamonix', destination: 'Tunnel Mont-Blanc' } })
      ]);
      setWeather(wRes.data);
      setTraffic(tRes.data);
    } catch (e) {
      console.error("External data fetch failed:", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post(getEndpoint('/auth/login'), { email: username, password });
      localStorage.setItem('safestep_token', res.data.token);
      localStorage.setItem('safestep_user', JSON.stringify(res.data.user));
      setIsLoggedIn(true);
      setUser(res.data.user);
    } catch (err: any) {
      const message = err.response?.data?.error || "Erreur de connexion au serveur";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('safestep_token');
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const handleAddEpi = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.floor(Math.random() * 1000000);
    const item: EPI = {
      ...newEpi,
      id,
      available: newEpi.quantity,
      last_check: new Date().toISOString().split('T')[0],
      is_local_only: true
    };
    
    await db.epi.add(item);
    await addToSyncQueue('CREATE', 'epi', item);
    
    setNewEpi({ tag_ref: '', category: 'casque', site_id: 1, status: 'conforme', quantity: 1 });
    setActiveTab('dashboard');
  };

  const handleTakeEpi = async (id: number) => {
    const item = await db.epi.get(id);
    if (!item || item.available <= 0) return;
    
    const updated = { ...item, available: item.available - 1 };
    await db.epi.put(updated);
    await addToSyncQueue('UPDATE', 'epi', updated);
  };

  const updateEPIStatus = async (id: number, newStatus: EPI['status']) => {
    const item = await db.epi.get(id);
    if (!item) return;
    
    const updated = { ...item, status: newStatus, last_check: new Date().toISOString().split('T')[0] };
    await db.epi.put(updated);
    
    // For PHP backend, we use UPDATE action in sync
    await addToSyncQueue('UPDATE', 'epi', updated);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-black/5 relative overflow-hidden"
        >
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-black transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Shield className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-black">SafeStep</h1>
            <p className="text-zinc-500 text-sm mt-1">Sécurité BTP & Zones Blanches</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Utilisateur</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Mot de passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-zinc-800 transition-all active:scale-[0.98] mt-4"
            >
              Se connecter
            </button>
          </form>
        </motion.div>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 relative"
              >
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-black"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Configuration API
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Mode Backend</label>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                      <button 
                        onClick={() => {
                          setBackendMode('node');
                          localStorage.setItem('safestep_backend_mode', 'node');
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${backendMode === 'node' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                      >
                        Node.js
                      </button>
                      <button 
                        onClick={() => {
                          setBackendMode('php');
                          localStorage.setItem('safestep_backend_mode', 'php');
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${backendMode === 'php' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                      >
                        PHP
                      </button>
                    </div>
                  </div>

                  {backendMode === 'php' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">URL API PHP</label>
                      <input 
                        type="text" 
                        value={phpUrl}
                        onChange={(e) => {
                          setPhpUrl(e.target.value);
                          localStorage.setItem('safestep_php_url', e.target.value);
                        }}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        placeholder="https://votre-site.com/SafeStep-main"
                      />
                      <p className="text-[10px] text-zinc-400 italic">Ex: https://modestineeymerick.campuscci28.fr/safestep/SafeStep-main</p>
                    </motion.div>
                  )}

                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full bg-black text-white font-bold py-3 rounded-xl shadow-lg mt-4"
                  >
                    Terminer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">SafeStep</h2>
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  <Wifi className="w-3 h-3" /> Connecté
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  <WifiOff className="w-3 h-3" /> Hors-ligne
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={initialSync}
            disabled={!isOnline || isSyncing}
            className={`p-2 rounded-full hover:bg-zinc-100 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
      </header>

      <main className="px-6 pt-6 space-y-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Alerts Section */}
              <section className="grid grid-cols-2 gap-4">
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowWeatherModal(true)}
                  className={`p-4 rounded-3xl border cursor-pointer ${weather?.alert ? 'bg-rose-50 border-rose-100' : 'bg-white border-zinc-200'} shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <CloudRain className={`w-5 h-5 ${weather?.alert ? 'text-rose-500' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Météo</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold">{weather?.temp ?? '--'}°C</p>
                    <p className="text-xs text-zinc-500 font-medium truncate">{weather?.condition ?? 'Chargement...'}</p>
                    {weather?.alert && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase">
                        <AlertTriangle className="w-3 h-3" /> Alerte
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTrafficModal(true)}
                  className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-sm cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Car className="w-5 h-5 text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Trafic</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold">{traffic?.travel_time ?? '--'}</p>
                    <p className="text-xs text-zinc-500 font-medium truncate">{traffic?.status ?? 'Chargement...'}</p>
                    {traffic?.delay && (
                      <p className="text-[10px] font-bold text-amber-600 uppercase mt-2">{traffic.delay}</p>
                    )}
                  </div>
                </motion.div>
              </section>

              {/* Safety Check Card */}
              {weather?.can_work === false && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-rose-600 text-white p-5 rounded-3xl shadow-lg flex items-start gap-4"
                >
                  <div className="bg-white/20 p-2 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Accès Restreint</h3>
                    <p className="text-white/80 text-sm mt-1">Les conditions climatiques ne permettent pas l'intervention en toute sécurité.</p>
                  </div>
                </motion.div>
              )}

              {/* Inventory Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Inventaire EPI</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-zinc-100 border-none rounded-full py-1.5 pl-9 pr-4 text-xs focus:ring-2 focus:ring-black/5 w-32 focus:w-48 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {epiItems?.map((item) => (
                      <motion.div 
                        key={`epi-item-${item.id}`}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                            <HardHat className="w-6 h-6 text-zinc-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm">{item.tag_ref}</h4>
                            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{item.category} • Site {item.site_id}</p>
                            <div className="mt-1.5">
                              <StatusBadge status={item.status} />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-col items-end">
                            <p className="text-[9px] text-zinc-400 font-mono">Vérifié: {item.last_check}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Package className="w-3 h-3 text-zinc-400" />
                              <span className={`text-[10px] font-bold ${item.available <= 2 ? 'text-rose-500' : 'text-zinc-500'}`}>
                                {item.available} / {item.quantity}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleTakeEpi(item.id)}
                              disabled={item.available <= 0}
                              className="px-3 py-1.5 rounded-lg bg-black text-white text-[10px] font-bold hover:bg-zinc-800 disabled:opacity-30 transition-all flex items-center gap-1"
                            >
                              Prendre
                            </button>
                            <button 
                              onClick={() => updateEPIStatus(item.id, 'conforme')}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => updateEPIStatus(item.id, 'endommage')}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {epiItems?.length === 0 && (
                    <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                      <p className="text-zinc-400 text-sm">Aucun équipement trouvé</p>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Nouvel Équipement</h3>
                <form onSubmit={handleAddEpi} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Référence (Tag)</label>
                    <input 
                      type="text" 
                      required
                      value={newEpi.tag_ref}
                      onChange={(e) => setNewEpi({ ...newEpi, tag_ref: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      placeholder="ex: CASQ-001"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Catégorie</label>
                      <select 
                        value={newEpi.category}
                        onChange={(e) => setNewEpi({ ...newEpi, category: e.target.value as EPI['category'] })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      >
                        <option value="casque">Casque</option>
                        <option value="harnais">Harnais</option>
                        <option value="detecteur_gaz">Détecteur Gaz</option>
                        <option value="gants">Gants</option>
                        <option value="gilet">Gilet</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Quantité Initiale</label>
                      <input 
                        type="number" 
                        min="1"
                        value={newEpi.quantity}
                        onChange={(e) => setNewEpi({ ...newEpi, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Site</label>
                    <select 
                      value={newEpi.site_id}
                      onChange={(e) => setNewEpi({ ...newEpi, site_id: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    >
                      <option value="1">1 - Tunnel</option>
                      <option value="2">2 - Gare</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-zinc-800 transition-all active:scale-[0.98] mt-4"
                  >
                    Ajouter à l'inventaire
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-4 border-b border-zinc-100 pb-6">
                  <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                    <Shield className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Technicien SafeStep</h3>
                    <p className="text-zinc-400 text-sm">ID: #48291 • Rôle: Admin</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Configuration Backend</h4>
                  <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Source des données</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setBackendMode('node');
                            localStorage.setItem('safestep_backend_mode', 'node');
                          }}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${backendMode === 'node' ? 'bg-black text-white' : 'bg-white text-zinc-400 border border-zinc-200'}`}
                        >
                          Node.js (Local)
                        </button>
                        <button 
                          onClick={() => {
                            setBackendMode('php');
                            localStorage.setItem('safestep_backend_mode', 'php');
                          }}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${backendMode === 'php' ? 'bg-black text-white' : 'bg-white text-zinc-400 border border-zinc-200'}`}
                        >
                          PHP (Distant)
                        </button>
                      </div>
                    </div>
                    
                    {backendMode === 'php' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">URL de l'API PHP</label>
                        <input 
                          type="text"
                          value={phpUrl}
                          onChange={(e) => {
                            setPhpUrl(e.target.value);
                            localStorage.setItem('safestep_php_url', e.target.value);
                          }}
                          placeholder="https://votre-site.com/api"
                          className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                        <p className="text-[9px] text-zinc-400 mt-2 italic">Ex: http://localhost/safestep/api.php</p>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Système</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm font-medium">Synchronisation</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">À jour</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div className="flex items-center gap-3">
                        <Wifi className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm font-medium">Mode Hors-ligne</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Activé</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleLogout}
                  className="w-full bg-rose-50 text-rose-600 font-bold py-4 rounded-xl hover:bg-rose-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Déconnexion
                </button>
              </div>

              <div className="text-center">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">SafeStep v1.0.4 • 2026</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation / Action */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-zinc-200 px-8 py-4 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-black' : 'text-zinc-400'}`}
        >
          <Shield className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Dashboard</span>
        </button>
        <div className="relative -top-8">
          <button 
            onClick={() => setActiveTab('add')}
            className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all ${activeTab === 'add' ? 'bg-emerald-600 text-white' : 'bg-black text-white'}`}
          >
            <Plus className={`w-8 h-8 transition-transform ${activeTab === 'add' ? 'rotate-45' : ''}`} />
          </button>
        </div>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-black' : 'text-zinc-400'}`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Réglages</span>
        </button>
      </nav>

      {/* Modals */}
      <Modal 
        isOpen={showWeatherModal} 
        onClose={() => setShowWeatherModal(false)} 
        title="Détails Météo"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100">
                <CloudRain className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <p className="text-4xl font-bold">{weather?.temp ?? '--'}°C</p>
                <p className="text-sm text-zinc-500 font-medium">{weather?.condition ?? 'Chargement...'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Humidité</p>
              <p className="text-xl font-bold">65%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Vent</span>
              </div>
              <p className="text-lg font-bold">18 km/h</p>
            </div>
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ressenti</span>
              </div>
              <p className="text-lg font-bold">10°C</p>
            </div>
          </div>

          {weather?.alert && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Alerte Critique</span>
              </div>
              <p className="text-sm text-rose-700">{weather.alert}</p>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest">Données OpenWeatherMap • Mis à jour à {new Date(weather?.updated_at).toLocaleTimeString()}</p>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showTrafficModal} 
        onClose={() => setShowTrafficModal(false)} 
        title="État du Trafic"
      >
        <div className="space-y-6">
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-zinc-100">
                <MapPin className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold">Destination: {traffic?.site_id === 'S1' ? 'Tunnel Mont-Blanc' : 'Sous-sol Gare Lyon'}</p>
                <p className="text-xs text-zinc-500">Depuis votre position actuelle</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Temps estimé</p>
                <p className="text-2xl font-bold text-black">{traffic?.travel_time ?? '--'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Retard</p>
                <p className="text-2xl font-bold text-amber-600">{traffic?.delay ?? 'Aucun'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Itinéraire conseillé</h4>
            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-zinc-400" />
                <span className="text-sm font-medium">Via A40 (Le plus rapide)</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest">Données Trafic Temps Réel • Mis à jour à {new Date(traffic?.updated_at).toLocaleTimeString()}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
