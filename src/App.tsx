import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WebRtcStudio } from './components/WebRtcStudio';
import { RoomsManager } from './components/RoomsManager';
import { TokenGenerator } from './components/TokenGenerator';
import { ApiPlayground } from './components/ApiPlayground';
import { EgressIngressManager } from './components/EgressIngressManager';
import { ServerMetrics } from './components/ServerMetrics';
import { RoomInfo, ServerStats } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('studio');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchRoomsAndStats = async () => {
    try {
      const [resRooms, resStats] = await Promise.all([
        fetch('/twirp/livekit.RoomService/ListRooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch('/api/server/info'),
      ]);
      const dataRooms = await resRooms.json();
      const dataStats = await resStats.json();
      setRooms(dataRooms.rooms || []);
      setServerStats(dataStats);
    } catch (err) {
      console.error('Error fetching rooms / stats', err);
    }
  };

  useEffect(() => {
    fetchRoomsAndStats();
    const interval = setInterval(fetchRoomsAndStats, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshDemo = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/rooms/seed-demo', { method: 'POST' });
      await fetchRoomsAndStats();
    } catch (err) {
      console.error('Failed to seed demo data', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverStats={serverStats}
        onRefreshDemo={handleRefreshDemo}
        refreshing={refreshing}
      />

      <main className="flex-1">
        {activeTab === 'studio' && (
          <WebRtcStudio rooms={rooms} onRoomUpdated={fetchRoomsAndStats} />
        )}
        {activeTab === 'rooms' && (
          <RoomsManager rooms={rooms} onRefresh={fetchRoomsAndStats} />
        )}
        {activeTab === 'tokens' && (
          <TokenGenerator />
        )}
        {activeTab === 'api' && (
          <ApiPlayground />
        )}
        {activeTab === 'egress' && (
          <EgressIngressManager rooms={rooms} />
        )}
        {activeTab === 'metrics' && (
          <ServerMetrics stats={serverStats} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            LiveKit WebRTC SFU Server • Node.js Express + WebRTC WebSocket Signaling
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Twirp RPC</span>
            <span>•</span>
            <span>VP8/Opus Media Engine</span>
            <span>•</span>
            <span>JWT Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
