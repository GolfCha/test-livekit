import React, { useState, useEffect } from 'react';
import {
  Server, Plus, Trash2, Users, MicOff, VideoOff, RefreshCw,
  Search, Shield, Edit3, X, UserMinus, Clock, Layers
} from 'lucide-react';
import { RoomInfo, ParticipantInfo } from '../types';

interface RoomsManagerProps {
  rooms: RoomInfo[];
  onRefresh: () => void;
}

export const RoomsManager: React.FC<RoomsManagerProps> = ({ rooms, onRefresh }) => {
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [loadingParts, setLoadingParts] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Room Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newMaxParts, setNewMaxParts] = useState<number>(50);
  const [newEmptyTimeout, setNewEmptyTimeout] = useState<number>(300);
  const [newMetadata, setNewMetadata] = useState<string>('{"layout": "grid"}');
  const [creating, setCreating] = useState<boolean>(false);

  // Load participants for selected room
  const loadRoomParticipants = async (roomName: string) => {
    setLoadingParts(true);
    try {
      const res = await fetch('/twirp/livekit.RoomService/ListParticipants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (err) {
      console.error('Failed to list participants', err);
    } finally {
      setLoadingParts(false);
    }
  };

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0]);
      loadRoomParticipants(rooms[0].name);
    } else if (selectedRoom) {
      const updated = rooms.find(r => r.name === selectedRoom.name);
      if (updated) setSelectedRoom(updated);
      loadRoomParticipants(selectedRoom.name);
    }
  }, [rooms]);

  const handleSelectRoom = (room: RoomInfo) => {
    setSelectedRoom(room);
    loadRoomParticipants(room.name);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      await fetch('/twirp/livekit.RoomService/CreateRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          max_participants: newMaxParts,
          empty_timeout: newEmptyTimeout,
          metadata: newMetadata,
        }),
      });
      setShowCreateModal(false);
      setNewRoomName('');
      onRefresh();
    } catch (err) {
      console.error('Failed to create room', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomName: string) => {
    if (!confirm(`Are you sure you want to delete room "${roomName}"?`)) return;
    try {
      await fetch('/twirp/livekit.RoomService/DeleteRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      if (selectedRoom?.name === roomName) {
        setSelectedRoom(null);
        setParticipants([]);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete room', err);
    }
  };

  const handleRemoveParticipant = async (identity: string) => {
    if (!selectedRoom) return;
    try {
      await fetch('/twirp/livekit.RoomService/RemoveParticipant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: selectedRoom.name, identity }),
      });
      loadRoomParticipants(selectedRoom.name);
      onRefresh();
    } catch (err) {
      console.error('Failed to remove participant', err);
    }
  };

  const handleMuteTrack = async (identity: string, trackSid: string, muted: boolean) => {
    if (!selectedRoom) return;
    try {
      await fetch('/twirp/livekit.RoomService/MutePublishedTrack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: selectedRoom.name,
          identity,
          track_sid: trackSid,
          muted,
        }),
      });
      loadRoomParticipants(selectedRoom.name);
    } catch (err) {
      console.error('Failed to mute track', err);
    }
  };

  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Room &amp; Participant Directory</span>
          </h2>
          <p className="text-xs text-slate-400">Live active sessions registered on the LiveKit SFU node</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              id="input-search-rooms"
              type="text"
              placeholder="Filter rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            id="btn-open-create-room"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl text-xs flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Room</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rooms Column */}
        <div className="lg:col-span-1 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Active Rooms ({filteredRooms.length})
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
                No rooms found. Click "Create Room" to start one.
              </div>
            ) : (
              filteredRooms.map(r => {
                const isSelected = selectedRoom?.name === r.name;
                return (
                  <div
                    key={r.sid}
                    onClick={() => handleSelectRoom(r)}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-100">{r.name}</span>
                      <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-slate-300">
                        {r.numParticipants} members
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>SID:</span>
                        <span className="text-slate-300">{r.sid.substring(0, 14)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Capacity:</span>
                        <span className="text-slate-300">{r.maxParticipants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span className="text-slate-300">{new Date(r.creationTime).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.activeRecording ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {r.activeRecording ? 'Recording Active' : 'Idle SFU'}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(r.name);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        title="Delete Room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Room Details & Participants */}
        <div className="lg:col-span-2 space-y-4">
          {selectedRoom ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              {/* Room Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedRoom.name}</h3>
                    <span className="px-2 py-0.5 text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md">
                      {selectedRoom.sid}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Metadata: <code className="text-slate-300">{selectedRoom.metadata || '(none)'}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-refresh-parts"
                    onClick={() => loadRoomParticipants(selectedRoom.name)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    title="Refresh participant list"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingParts ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Participants List */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Live Room Participants ({participants.length})</span>
                  </h4>
                </div>

                {participants.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                    No active participants currently in this room.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participants.map(p => (
                      <div
                        key={p.identity}
                        className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-200">{p.name || p.identity}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono text-cyan-400">
                              {p.identity}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                              {p.state}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {p.tracks.map(tr => (
                              <div
                                key={tr.sid}
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2"
                              >
                                <span>{tr.name} ({tr.type})</span>
                                <button
                                  onClick={() => handleMuteTrack(p.identity, tr.sid, !tr.muted)}
                                  className={`p-1 rounded text-xs ${tr.muted ? 'text-red-400' : 'text-emerald-400 hover:bg-slate-800'}`}
                                  title={tr.muted ? 'Unmute track' : 'Mute track'}
                                >
                                  {tr.muted ? <MicOff className="w-3 h-3" /> : <MicOff className="w-3 h-3 opacity-60 hover:opacity-100" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveParticipant(p.identity)}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Kick</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Select a room on the left to inspect its live state and participants.
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base text-white">Create New LiveKit Room</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Room Name
                </label>
                <input
                  id="modal-input-room-name"
                  type="text"
                  required
                  placeholder="e.g. executive-boardroom"
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Max Participants
                  </label>
                  <input
                    type="number"
                    value={newMaxParts}
                    onChange={e => setNewMaxParts(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Empty Timeout (s)
                  </label>
                  <input
                    type="number"
                    value={newEmptyTimeout}
                    onChange={e => setNewEmptyTimeout(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Metadata (JSON)
                </label>
                <textarea
                  rows={3}
                  value={newMetadata}
                  onChange={e => setNewMetadata(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition"
                >
                  {creating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
