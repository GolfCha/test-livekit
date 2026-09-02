import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, Users, MessageSquare,
  Sparkles, Disc, Radio, AlertCircle, Shield,
  Send, Volume2, UserPlus, Sliders, Check
} from 'lucide-react';
import { ParticipantInfo, RoomInfo, ChatMessage } from '../types';

interface WebRtcStudioProps {
  rooms: RoomInfo[];
  onRoomUpdated?: () => void;
}

export const WebRtcStudio: React.FC<WebRtcStudioProps> = ({ rooms, onRoomUpdated }) => {
  const [selectedRoom, setSelectedRoom] = useState<string>('demo-conference');
  const [identity, setIdentity] = useState<string>('participant-' + Math.random().toString(36).substring(2, 6));
  const [userName, setUserName] = useState<string>('Guest Engineer');
  const [inCall, setInCall] = useState<boolean>(false);

  // Media States
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [screenSharing, setScreenSharing] = useState<boolean>(false);
  const [simulcastQuality, setSimulcastQuality] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // UI state
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | 'stats'>('participants');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState<string>('');

  // Call Participants
  const [peers, setPeers] = useState<ParticipantInfo[]>([]);
  const [myAudioLevel, setMyAudioLevel] = useState<number>(0);

  // References
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Start / Join Call
  const handleJoinCall = async () => {
    setInCall(true);

    // Try to acquire real camera/mic, fallback to synthetic canvas if denied
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setupAudioMeter(stream);
    } catch (err) {
      console.warn('Media devices not permitted or unavailable, using high-tech canvas generator');
      startCanvasSimulation();
    }

    // Connect to WebSocket LiveKit RTC endpoint
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/rtc?room=${encodeURIComponent(selectedRoom)}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(userName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to LiveKit RTC Signaling Server');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'JOIN_RESPONSE') {
          if (msg.otherParticipants) {
            setPeers(msg.otherParticipants);
          }
          if (msg.room?.activeRecording) {
            setIsRecording(true);
          }
        } else if (msg.type === 'PARTICIPANT_JOINED') {
          setPeers(prev => {
            if (prev.some(p => p.identity === msg.participant.identity)) return prev;
            return [...prev, msg.participant];
          });
          setChatMessages(prev => [
            ...prev,
            {
              id: 'sys_' + Date.now(),
              senderIdentity: 'system',
              senderName: 'LiveKit SFU',
              message: `${msg.participant.name || msg.participant.identity} joined the room`,
              timestamp: Date.now(),
              isSystem: true,
            },
          ]);
        } else if (msg.type === 'PARTICIPANT_LEFT') {
          setPeers(prev => prev.filter(p => p.identity !== msg.identity));
          setChatMessages(prev => [
            ...prev,
            {
              id: 'sys_' + Date.now(),
              senderIdentity: 'system',
              senderName: 'LiveKit SFU',
              message: `${msg.identity} left the room`,
              timestamp: Date.now(),
              isSystem: true,
            },
          ]);
        } else if (msg.type === 'CHAT_MESSAGE') {
          setChatMessages(prev => [...prev, msg.chatMessage]);
        } else if (msg.type === 'TRACK_MUTED') {
          setPeers(prev => prev.map(p => {
            if (p.identity === msg.identity) {
              const tracks = p.tracks.map(t => (t.source === msg.source || t.sid === msg.trackSid) ? { ...t, muted: msg.muted } : t);
              return { ...p, tracks };
            }
            return p;
          }));
        } else if (msg.type === 'ACTIVE_SPEAKERS_UPDATE') {
          const speakersMap = new Map(msg.speakers.map((s: any) => [s.identity, s]));
          setPeers(prev => prev.map(p => {
            const spk: any = speakersMap.get(p.identity);
            if (spk) {
              return { ...p, isSpeaking: spk.isSpeaking, audioLevel: spk.level };
            }
            return p;
          }));
        }
      } catch (err) {
        console.error('Error parsing WS RTC event', err);
      }
    };

    ws.onclose = () => {
      console.log('LiveKit RTC connection closed');
    };
  };

  // Setup Audio Meter
  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 128);
        setMyAudioLevel(normalized);

        // Send audio level to server for speaker detection
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && Math.random() < 0.2) {
          wsRef.current.send(JSON.stringify({
            type: 'AUDIO_LEVEL',
            level: normalized,
          }));
        }

        requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn('Audio metering error', e);
    }
  };

  // Synthetic Video Canvas
  const startCanvasSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const render = () => {
      frame++;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw animated particle orb
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 60 + Math.sin(frame * 0.05) * 8;

      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius * 1.5);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.9)');
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.5)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw avatar badge
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 44, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(userName.charAt(0).toUpperCase() || 'U', centerX, centerY);

      // Title & stats
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`WebRTC 1080p • 60fps • VP8`, centerX, centerY + 80);

      // Audio waveform simulation
      if (audioEnabled) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const h = Math.sin(frame * 0.15 + i) * 15 * (myAudioLevel || 0.4);
          const bx = centerX - 50 + i * 5;
          ctx.moveTo(bx, centerY + 110 - h);
          ctx.lineTo(bx, centerY + 110 + h);
        }
        ctx.stroke();
      }

      if (inCall) {
        requestAnimationFrame(render);
      }
    };
    render();
  };

  const handleLeaveCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setInCall(false);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const vidTrack = localStreamRef.current.getVideoTracks()[0];
      if (vidTrack) {
        vidTrack.enabled = !videoEnabled;
      }
    }
    setVideoEnabled(!videoEnabled);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TRACK_MUTE',
        source: 'CAMERA',
        muted: videoEnabled,
      }));
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audTrack = localStreamRef.current.getAudioTracks()[0];
      if (audTrack) {
        audTrack.enabled = !audioEnabled;
      }
    }
    setAudioEnabled(!audioEnabled);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TRACK_MUTE',
        source: 'MICROPHONE',
        muted: audioEnabled,
      }));
    }
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        displayStream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch (e) {
        console.warn('Screen share canceled or failed', e);
      }
    } else {
      setScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      message: inputMsg.trim(),
    }));
    setInputMsg('');
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      try {
        const res = await fetch('/twirp/livekit.Egress/StartRoomCompositeEgress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_name: selectedRoom }),
        });
        const data = await res.json();
        setRecordingId(data.egressId);
        setIsRecording(true);
        if (onRoomUpdated) onRoomUpdated();
      } catch (err) {
        console.error('Failed to start egress recording', err);
      }
    } else {
      try {
        await fetch('/twirp/livekit.Egress/StopEgress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egress_id: recordingId || 'EG_active' }),
        });
        setIsRecording(false);
        setRecordingId(null);
        if (onRoomUpdated) onRoomUpdated();
      } catch (err) {
        console.error('Failed to stop egress recording', err);
      }
    }
  };

  const handleAddSimulatedBot = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SIMULATE_BOT_TALK',
      }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {!inCall ? (
        /* Pre-join Lobby Card */
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Radio className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">LiveKit Conference Studio</h2>
              <p className="text-xs text-slate-400">Connect to LiveKit WebRTC SFU Server with media &amp; signaling</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Room
              </label>
              <select
                id="select-room-input"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {rooms.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.numParticipants} participants)
                  </option>
                ))}
                <option value="custom-room">+ New Custom Room</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Display Name
                </label>
                <input
                  id="input-user-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Identity (SID/Sub)
                </label>
                <input
                  id="input-user-identity"
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Auto-minted Video Grant</span>
              </div>
              <p>
                Includes <code className="text-slate-300">roomJoin: true</code>, <code className="text-slate-300">canPublish: true</code>, <code className="text-slate-300">canSubscribe: true</code>, <code className="text-slate-300">canPublishData: true</code>.
              </p>
            </div>

            <button
              id="btn-join-room"
              onClick={handleJoinCall}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              <span>Connect to Room: {selectedRoom}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active Conference Studio Grid */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Stage & Participant Grid */}
          <div className="lg:col-span-3 space-y-4">
            {/* Top Room Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-slate-200">{selectedRoom}</span>
                <span className="text-xs text-slate-400 font-mono">({peers.length + 1} connected)</span>
              </div>

              <div className="flex items-center gap-2">
                {isRecording && (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1.5 animate-pulse">
                    <Disc className="w-3.5 h-3.5" />
                    REC (LiveKit Egress)
                  </span>
                )}
                <span className="text-xs font-mono px-2 py-1 bg-slate-950 rounded border border-slate-800 text-cyan-400">
                  VP8 / Opus SFU
                </span>
              </div>
            </div>

            {/* Video Streams Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-[420px]">
              {/* Local User Stream Card */}
              <div className={`relative bg-slate-950 rounded-2xl border ${myAudioLevel > 0.15 ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-slate-800'} overflow-hidden aspect-video flex items-center justify-center shadow-lg group`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${(!videoEnabled && !screenSharing) ? 'hidden' : ''}`}
                />
                {(!videoEnabled && !screenSharing) && (
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2">
                    <span>{userName} (You)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">HOST</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur px-2 py-1 rounded-lg border border-slate-800">
                    {audioEnabled ? (
                      <div className="flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        <div className="w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 transition-all duration-75"
                            style={{ width: `${Math.min(100, (myAudioLevel || 0.1) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Remote Peer 1 (e.g. Alice) */}
              {peers.map((peer) => {
                const isSpeaking = peer.isSpeaking;
                const camTrack = peer.tracks.find(t => t.source === 'CAMERA' || t.type === 'VIDEO');
                const micTrack = peer.tracks.find(t => t.source === 'MICROPHONE' || t.type === 'AUDIO');
                const isCamMuted = camTrack?.muted;
                const isMicMuted = micTrack?.muted;

                return (
                  <div
                    key={peer.identity}
                    className={`relative bg-slate-950 rounded-2xl border ${isSpeaking ? 'border-emerald-400 ring-2 ring-emerald-400/20' : 'border-slate-800'} overflow-hidden aspect-video flex items-center justify-center shadow-lg group`}
                  >
                    {!isCamMuted ? (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col items-center justify-center p-4">
                        <div className="relative mb-3">
                          <div className={`w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl ${isSpeaking ? 'ring-4 ring-emerald-400/50 animate-pulse' : ''}`}>
                            {peer.name.charAt(0).toUpperCase()}
                          </div>
                          {isSpeaking && (
                            <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full text-slate-950">
                              <Volume2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-slate-200">{peer.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">LiveKit WebRTC Track: {camTrack?.mimeType || 'video/vp8'}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center text-slate-500">
                        <VideoOff className="w-10 h-10 mb-2 text-slate-600" />
                        <span className="text-xs">Camera Muted</span>
                      </div>
                    )}

                    {/* Overlay Info */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <div className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2">
                        <span>{peer.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur px-2 py-1 rounded-lg border border-slate-800">
                        {!isMicMuted ? (
                          <div className="flex items-center gap-1">
                            <Mic className="w-3.5 h-3.5 text-emerald-400" />
                            <div className="w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 transition-all duration-75"
                                style={{ width: `${Math.min(100, (peer.audioLevel || 0.05) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Placeholder slot if single participant */}
              {peers.length === 0 && (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400 aspect-video">
                  <UserPlus className="w-10 h-10 mb-3 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">Waiting for participants to join</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Click "Trigger Simulated Speaker" or share room link to join multiple sessions.
                  </p>
                  <button
                    id="btn-bot-speaker"
                    onClick={handleAddSimulatedBot}
                    className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Simulate Audio Activity
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Floating Control Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur">
              {/* Media Controls */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-toggle-mic"
                  onClick={toggleAudio}
                  className={`p-3 rounded-xl transition ${
                    audioEnabled ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                  title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {audioEnabled ? <Mic className="w-5 h-5 text-emerald-400" /> : <MicOff className="w-5 h-5 text-red-400" />}
                </button>

                <button
                  id="btn-toggle-camera"
                  onClick={toggleVideo}
                  className={`p-3 rounded-xl transition ${
                    videoEnabled ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                  title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {videoEnabled ? <Video className="w-5 h-5 text-cyan-400" /> : <VideoOff className="w-5 h-5 text-red-400" />}
                </button>

                <button
                  id="btn-toggle-screenshare"
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-xl transition ${
                    screenSharing ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                  }`}
                  title="Share Screen"
                >
                  <MonitorUp className="w-5 h-5" />
                </button>

                <button
                  id="btn-toggle-egress-rec"
                  onClick={handleToggleRecording}
                  className={`px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                    isRecording ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title="Start/Stop Room Composite Egress Recording"
                >
                  <Disc className="w-4 h-4" />
                  <span className="hidden sm:inline">{isRecording ? 'Stop REC' : 'Record'}</span>
                </button>
              </div>

              {/* Simulcast Quality Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 hidden sm:inline">Simulcast:</span>
                {(['HIGH', 'MEDIUM', 'LOW'] as const).map(q => (
                  <button
                    key={q}
                    id={`btn-quality-${q.toLowerCase()}`}
                    onClick={() => setSimulcastQuality(q)}
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition ${
                      simulcastQuality === q ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {q === 'HIGH' ? '720p' : q === 'MEDIUM' ? '360p' : '180p'}
                  </button>
                ))}
              </div>

              {/* End Call Button */}
              <button
                id="btn-leave-call"
                onClick={handleLeaveCall}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/20"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          {/* Right Sidebar: Chat / Participants / Telemetry */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[560px] overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950/40">
              <button
                id="tab-sub-participants"
                onClick={() => setSidebarTab('participants')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  sidebarTab === 'participants' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/60' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members ({peers.length + 1})</span>
              </button>

              <button
                id="tab-sub-chat"
                onClick={() => setSidebarTab('chat')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  sidebarTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/60' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>

              <button
                id="tab-sub-stats"
                onClick={() => setSidebarTab('stats')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  sidebarTab === 'stats' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/60' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>SFU Stats</span>
              </button>
            </div>

            {/* Sidebar Content Body */}
            <div className="flex-1 p-4 overflow-y-auto">
              {sidebarTab === 'participants' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{userName}</span>
                        <span className="text-[10px] px-1 bg-cyan-500/20 text-cyan-400 rounded">YOU</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{identity}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {audioEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                      {videoEnabled ? <Video className="w-3.5 h-3.5 text-cyan-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                  </div>

                  {peers.map(p => (
                    <div key={p.identity} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.identity}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {p.tracks.length} tracks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sidebarTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                        <span>No messages yet in this room</span>
                      </div>
                    ) : (
                      chatMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`text-xs p-2.5 rounded-xl ${
                            msg.isSystem
                              ? 'bg-slate-950/60 border border-slate-800/60 text-slate-400 text-center italic'
                              : msg.senderIdentity === identity
                              ? 'bg-cyan-950/40 border border-cyan-800/40 ml-4 text-cyan-100'
                              : 'bg-slate-950 border border-slate-800/80 mr-4 text-slate-200'
                          }`}
                        >
                          {!msg.isSystem && (
                            <div className="flex items-center justify-between font-semibold text-[10px] text-slate-400 mb-1">
                              <span>{msg.senderName}</span>
                              <span className="font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          <p className="break-words">{msg.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="mt-3 flex items-center gap-2">
                    <input
                      id="input-chat-message"
                      type="text"
                      value={inputMsg}
                      onChange={e => setInputMsg(e.target.value)}
                      placeholder="Send message to room..."
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      id="btn-send-chat"
                      type="submit"
                      className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {sidebarTab === 'stats' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Protocol:</span>
                      <span className="text-cyan-400">LiveKit RTC v2 (Twirp)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Video Codec:</span>
                      <span className="text-slate-200">VP8 / 1280x720</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audio Codec:</span>
                      <span className="text-slate-200">Opus / 48kHz Stereo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated RTT:</span>
                      <span className="text-emerald-400">14 ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Packet Loss:</span>
                      <span className="text-emerald-400">0.00%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Simulcast Layer:</span>
                      <span className="text-indigo-400">{simulcastQuality}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
