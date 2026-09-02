import React, { useState, useEffect } from 'react';
import { Disc, Radio, Plus, Trash2, RefreshCw, CheckCircle, Video, Play, Square, ExternalLink } from 'lucide-react';
import { EgressInfo, IngressInfo, RoomInfo } from '../types';

interface EgressIngressManagerProps {
  rooms: RoomInfo[];
}

export const EgressIngressManager: React.FC<EgressIngressManagerProps> = ({ rooms }) => {
  const [egressList, setEgressList] = useState<EgressInfo[]>([]);
  const [ingressList, setIngressList] = useState<IngressInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // New Egress State
  const [selectedRoomForEgress, setSelectedRoomForEgress] = useState<string>('demo-conference');
  const [customFilepath, setCustomFilepath] = useState<string>('recordings/demo-conference.mp4');

  // New Ingress State
  const [ingressName, setIngressName] = useState<string>('OBS Studio Stream');
  const [ingressInputType, setIngressInputType] = useState<'RTMP_INPUT' | 'WHIP_INPUT'>('RTMP_INPUT');
  const [ingressRoom, setIngressRoom] = useState<string>('demo-conference');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resEg, resIn] = await Promise.all([
        fetch('/twirp/livekit.Egress/ListEgress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch('/twirp/livekit.Ingress/ListIngress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ]);
      const dataEg = await resEg.json();
      const dataIn = await resIn.json();
      setEgressList(dataEg.items || []);
      setIngressList(dataIn.items || []);
    } catch (err) {
      console.error('Failed to fetch egress/ingress', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartEgress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/twirp/livekit.Egress/StartRoomCompositeEgress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: selectedRoomForEgress,
          file_outputs: { filepath: customFilepath },
        }),
      });
      fetchData();
    } catch (err) {
      console.error('Error starting egress', err);
    }
  };

  const handleStopEgress = async (egressId: string) => {
    try {
      await fetch('/twirp/livekit.Egress/StopEgress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egress_id: egressId }),
      });
      fetchData();
    } catch (err) {
      console.error('Error stopping egress', err);
    }
  };

  const handleCreateIngress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/twirp/livekit.Ingress/CreateIngress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ingressName,
          input_type: ingressInputType,
          room_name: ingressRoom,
          participant_identity: 'ingress_' + Math.random().toString(36).substring(2, 7),
          participant_name: ingressName,
        }),
      });
      fetchData();
    } catch (err) {
      console.error('Error creating ingress', err);
    }
  };

  const handleDeleteIngress = async (ingressId: string) => {
    try {
      await fetch('/twirp/livekit.Ingress/DeleteIngress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingress_id: ingressId }),
      });
      fetchData();
    } catch (err) {
      console.error('Error deleting ingress', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-cyan-400" />
            <span>LiveKit Egress &amp; Ingress Media Pipelines</span>
          </h2>
          <p className="text-xs text-slate-400">
            Export room composite recordings to S3/Storage, and ingest RTMP/WHIP feeds directly into rooms
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          title="Refresh pipelines"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Egress Section */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Disc className="w-4 h-4 text-red-400" />
                <span>Egress (Room Recordings &amp; Exports)</span>
              </h3>
            </div>

            <form onSubmit={handleStartEgress} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300">Start Composite Recording</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target Room</label>
                  <select
                    value={selectedRoomForEgress}
                    onChange={e => setSelectedRoomForEgress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  >
                    {rooms.map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">File Output Path</label>
                  <input
                    type="text"
                    value={customFilepath}
                    onChange={e => setCustomFilepath(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs transition flex items-center justify-center gap-1.5"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Start Room Recording</span>
              </button>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active &amp; Past Egress Sessions ({egressList.length})
              </div>

              {egressList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                  No active egress tasks.
                </div>
              ) : (
                egressList.map(eg => (
                  <div key={eg.egressId} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{eg.roomName}</span>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${
                          eg.status === 'EGRESS_ACTIVE' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {eg.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ID: {eg.egressId} • {eg.file?.filename}
                      </div>
                    </div>

                    {eg.status === 'EGRESS_ACTIVE' ? (
                      <button
                        onClick={() => handleStopEgress(eg.egressId)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition"
                      >
                        Stop
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">
                        {eg.file?.duration ? `${eg.file.duration}s` : 'Completed'}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ingress Section */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Ingress (RTMP / WHIP Broadcast Endpoints)</span>
              </h3>
            </div>

            <form onSubmit={handleCreateIngress} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300">Create Ingress Stream Endpoint</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">Ingress Name</label>
                  <input
                    type="text"
                    value={ingressName}
                    onChange={e => setIngressName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Type</label>
                  <select
                    value={ingressInputType}
                    onChange={e => setIngressInputType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  >
                    <option value="RTMP_INPUT">RTMP</option>
                    <option value="WHIP_INPUT">WHIP</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Ingress Endpoint</span>
              </button>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Configured Ingress Streams ({ingressList.length})
              </div>

              {ingressList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                  No ingress streams configured.
                </div>
              ) : (
                ingressList.map(item => (
                  <div key={item.ingressId} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{item.name}</span>
                        <span className="px-2 py-0.5 text-[10px] rounded-full font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          {item.inputType}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Stream Key: <code className="text-slate-300">{item.streamKey}</code> • Room: {item.roomName}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteIngress(item.ingressId)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition"
                      title="Delete ingress"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
