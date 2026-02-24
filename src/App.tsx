/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Heart, 
  Search, 
  Menu, 
  Radio, 
  History, 
  Settings,
  Share2,
  Crown,
  Info,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface RadioStation {
  id: string;
  name: string;
  frequency?: string;
  url: string;
  logo: string;
  category: string;
  location: string;
}

export default function App() {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'stations' | 'favorites' | 'recent' | 'admin'>('stations');
  const [recentStations, setRecentStations] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [editingStation, setEditingStation] = useState<Partial<RadioStation> | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      setStations(data);
      if (data.length > 0 && !currentStation) {
        setCurrentStation(data[0]);
      }
    } catch (e) {
      console.error("Failed to fetch stations", e);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (!currentStation || !audioRef.current) return;

    const audio = audioRef.current;
    const url = currentStation.url;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(audio);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying) audio.play().catch(e => console.error("HLS Playback error", e));
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        audio.src = url;
        if (isPlaying) audio.play().catch(e => console.error("Native HLS Playback error", e));
      }
    } else {
      // Standard audio stream
      audio.src = url;
      if (isPlaying) audio.play().catch(e => console.error("Standard Playback error", e));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentStation]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleStationSelect = (station: RadioStation) => {
    setCurrentStation(station);
    setIsPlaying(true);
    if (!recentStations.includes(station.id)) {
      setRecentStations(prev => [station.id, ...prev.slice(0, 4)]);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminLoggedIn(true);
        setAdminError('');
      } else {
        setAdminError('Invalid credentials');
      }
    } catch (e) {
      setAdminError('Login failed');
    }
  };

  const handleSaveStation = async () => {
    if (!editingStation?.name || !editingStation?.url) return;
    const method = editingStation.id ? 'PUT' : 'POST';
    const url = editingStation.id ? `/api/stations/${editingStation.id}` : '/api/stations';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingStation)
    });
    setEditingStation(null);
    fetchStations();
  };

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/stations/${id}`, { method: 'DELETE' });
    fetchStations();
  };

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedStations = activeTab === 'stations' 
    ? filteredStations 
    : activeTab === 'favorites'
    ? stations.filter(s => favorites.includes(s.id))
    : activeTab === 'recent'
    ? stations.filter(s => recentStations.includes(s.id))
    : [];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-brand-bg overflow-hidden shadow-2xl relative">
      {currentStation && (
        <audio 
          ref={audioRef} 
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md p-8 flex flex-col"
          >
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-2xl font-bold">Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 bg-white/10 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Audio Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Low', 'Normal', 'High'].map(q => (
                    <button key={q} className={`py-3 rounded-xl text-sm font-medium border ${q === 'High' ? 'bg-brand-primary border-brand-primary' : 'bg-white/5 border-white/10'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <button 
                  onClick={() => { setActiveTab('admin'); setIsSettingsOpen(false); }}
                  className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-brand-primary" />
                    <span className="font-medium">Admin Panel</span>
                  </div>
                  <Settings className="w-4 h-4 text-white/20" />
                </button>
                <button className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">Manage Subscription</span>
                  </div>
                  <Settings className="w-4 h-4 text-white/20" />
                </button>
              </div>
            </div>

            <div className="mt-auto text-center space-y-2">
              <p className="text-xs text-white/20">TUNE.AL Version 1.0.0</p>
              <p className="text-[10px] text-white/10">© 2024 ICREO Albania. All rights reserved.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">TUNE.AL</h1>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Content */}
      {activeTab === 'admin' ? (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Admin Panel</h2>
            <button onClick={() => setActiveTab('stations')} className="text-xs text-white/40">Back to App</button>
          </div>

          {!isAdminLoggedIn ? (
            <form onSubmit={handleAdminLogin} className="space-y-4 bg-brand-surface p-6 rounded-2xl border border-brand-border">
              <div className="space-y-2">
                <label className="text-xs text-white/40">Username</label>
                <input 
                  type="text" 
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40">Password</label>
                <input 
                  type="password" 
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              {adminError && <p className="text-xs text-red-500">{adminError}</p>}
              <button type="submit" className="w-full py-3 bg-brand-primary rounded-xl font-bold text-sm">LOGIN</button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Manage Stations</h3>
                <button 
                  onClick={() => setEditingStation({})}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-black text-[10px] font-bold rounded-lg"
                >
                  <Plus className="w-3 h-3" /> ADD NEW
                </button>
              </div>

              <div className="space-y-2">
                {stations.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-brand-surface rounded-xl border border-brand-border">
                    <img src={s.logo} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{s.name}</p>
                      <p className="text-[10px] text-white/40">{s.category}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingStation(s)} className="p-2 text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteStation(s.id)} className="p-2 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Station Modal */}
          {editingStation && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6">
              <div className="w-full max-w-sm bg-brand-surface rounded-3xl p-6 border border-brand-border space-y-4">
                <h3 className="text-lg font-bold">{editingStation.id ? 'Edit Station' : 'Add Station'}</h3>
                <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-2 no-scrollbar">
                  <input placeholder="Name" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.name || ''} onChange={e => setEditingStation({...editingStation, name: e.target.value})} />
                  <input placeholder="Frequency (e.g. 100.0 FM)" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.frequency || ''} onChange={e => setEditingStation({...editingStation, frequency: e.target.value})} />
                  <input placeholder="Stream URL" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.url || ''} onChange={e => setEditingStation({...editingStation, url: e.target.value})} />
                  <input placeholder="Logo URL" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.logo || ''} onChange={e => setEditingStation({...editingStation, logo: e.target.value})} />
                  <input placeholder="Category" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.category || ''} onChange={e => setEditingStation({...editingStation, category: e.target.value})} />
                  <input placeholder="Location" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm" value={editingStation.location || ''} onChange={e => setEditingStation({...editingStation, location: e.target.value})} />
                </div>
                <div className="flex gap-2 pt-4">
                  <button onClick={() => setEditingStation(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">CANCEL</button>
                  <button onClick={handleSaveStation} className="flex-1 py-3 bg-brand-primary rounded-xl text-sm font-bold">SAVE</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search & Tabs */}
          <div className="px-6 space-y-4 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input 
                type="text" 
                placeholder="Search stations, genres..."
                className="w-full bg-brand-surface border border-brand-border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary/50 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {[
                { id: 'stations', label: 'All Stations', icon: Radio },
                { id: 'favorites', label: 'Favorites', icon: Heart },
                { id: 'recent', label: 'Recent', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id 
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                      : 'bg-brand-surface text-white/60 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Station List */}
          <main className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {displayedStations.length > 0 ? (
                displayedStations.map((station) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={station.id}
                    onClick={() => handleStationSelect(station)}
                    className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${
                      currentStation?.id === station.id 
                        ? 'bg-brand-primary/10 border border-brand-primary/20' 
                        : 'bg-brand-surface/50 border border-transparent hover:bg-brand-surface'
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                      <img 
                        src={station.logo} 
                        alt={station.name} 
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
                      />
                      {currentStation?.id === station.id && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex gap-0.5 items-end h-4">
                            {[0, 1, 2].map(i => (
                              <motion.div
                                key={i}
                                animate={{ height: [4, 12, 4] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                                className="w-1 bg-brand-primary rounded-full"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{station.name}</h3>
                      <p className="text-xs text-white/40 truncate">{station.frequency} • {station.category}</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(station.id);
                      }}
                      className={`p-2 rounded-full transition-colors ${
                        favorites.includes(station.id) ? 'text-brand-primary' : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${favorites.includes(station.id) ? 'fill-current' : ''}`} />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Radio className="w-12 h-12 mb-4 opacity-20" />
                  <p>No stations found</p>
                </div>
              )}
            </AnimatePresence>

            {/* Monetization Placeholder: Premium Banner */}
            <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-500">Go Premium</h4>
                  <p className="text-[10px] text-white/60">No ads, HD audio, and more.</p>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-amber-500 text-black text-[10px] font-bold rounded-lg hover:bg-amber-400 transition-colors">
                UPGRADE
              </button>
            </div>
          </main>
        </>
      )}

      {/* Player Bar */}
      {currentStation && (
        <motion.div 
          layout
          className="player-gradient glass border-t border-white/10 px-6 pt-4 pb-8 space-y-4 z-20"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 shadow-xl">
              <img 
                src={currentStation.logo} 
                alt={currentStation.name} 
                className="w-full h-full object-contain p-2"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold truncate">{currentStation.name}</h2>
                <span className="px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary text-[8px] font-bold uppercase tracking-wider">Live</span>
              </div>
              <p className="text-xs text-white/60 truncate">{currentStation.location} • {currentStation.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-8">
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <SkipBack className="w-6 h-6" />
              </button>
              <button 
                onClick={togglePlay}
                className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-4 px-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="text-white/40 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
                <div 
                  className="absolute inset-y-0 left-0 bg-brand-primary rounded-full"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom Ad Placeholder */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-primary/20" />
    </div>
  );
}
