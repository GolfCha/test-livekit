import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const HOST = '0.0.0.0';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const NODE_ID = 'node_' + Math.random().toString(36).substring(2, 8);
const START_TIME = Date.now();

// Data Structures
interface Room {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: number;
  metadata: string;
  numParticipants: number;
  numPublishers: number;
  activeRecording: boolean;
}

interface Track {
  sid: string;
  type: 'AUDIO' | 'VIDEO' | 'DATA';
  name: string;
  muted: boolean;
  width?: number;
  height?: number;
  simulcast?: boolean;
  source: 'UNKNOWN' | 'CAMERA' | 'MICROPHONE' | 'SCREEN_SHARE' | 'SCREEN_SHARE_AUDIO';
  mimeType?: string;
}

interface Participant {
  sid: string;
  identity: string;
  name: string;
  state: 'JOINING' | 'JOINED' | 'ACTIVE' | 'DISCONNECTED';
  tracks: Track[];
  metadata: string;
  joinedAt: number;
  isPublisher: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  permission: {
    canSubscribe: boolean;
    canPublish: boolean;
    canPublishData: boolean;
    hidden: boolean;
    recorder: boolean;
  };
}

interface Egress {
  egressId: string;
  roomId: string;
  roomName: string;
  status: 'EGRESS_STARTING' | 'EGRESS_ACTIVE' | 'EGRESS_ENDING' | 'EGRESS_COMPLETE' | 'EGRESS_FAILED';
  startedAt: number;
  endedAt?: number;
  file?: {
    filename: string;
    duration: number;
    size: number;
    location: string;
  };
}

interface Ingress {
  ingressId: string;
  name: string;
  streamKey: string;
  url: string;
  inputType: 'RTMP_INPUT' | 'WHIP_INPUT' | 'URL_INPUT';
  roomName: string;
  participantIdentity: string;
  participantName: string;
  status: 'ENDPOINT_INACTIVE' | 'ENDPOINT_BUFFERING' | 'ENDPOINT_PUBLISHING' | 'ENDPOINT_ERROR';
}

// In-Memory Store
const roomsMap = new Map<string, Room>();
const participantsMap = new Map<string, Map<string, Participant>>(); // roomName -> (identity -> Participant)
const egressMap = new Map<string, Egress>();
const ingressMap = new Map<string, Ingress>();

// Initialize sample data
function seedInitialData() {
  const demoRoom: Room = {
    sid: 'RM_demo_' + Math.random().toString(36).substring(2, 7),
    name: 'demo-conference',
    emptyTimeout: 300,
    maxParticipants: 50,
    creationTime: Date.now() - 1000 * 60 * 15,
    metadata: JSON.stringify({ description: 'LiveKit Demo Room', layout: 'grid' }),
    numParticipants: 2,
    numPublishers: 2,
    activeRecording: false,
  };
  roomsMap.set(demoRoom.name, demoRoom);

  const roomParts = new Map<string, Participant>();
  roomParts.set('alice-developer', {
    sid: 'PA_alice_' + Math.random().toString(36).substring(2, 7),
    identity: 'alice-developer',
    name: 'Alice (San Francisco)',
    state: 'ACTIVE',
    tracks: [
      { sid: 'TR_cam_alice', type: 'VIDEO', name: 'camera', muted: false, width: 1280, height: 720, source: 'CAMERA', mimeType: 'video/vp8' },
      { sid: 'TR_mic_alice', type: 'AUDIO', name: 'microphone', muted: false, source: 'MICROPHONE', mimeType: 'audio/opus' },
    ],
    metadata: JSON.stringify({ avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', role: 'Presenter' }),
    joinedAt: Date.now() - 1000 * 60 * 12,
    isPublisher: true,
    isSpeaking: true,
    audioLevel: 0.72,
    permission: { canSubscribe: true, canPublish: true, canPublishData: true, hidden: false, recorder: false },
  });

  roomParts.set('bob-engineer', {
    sid: 'PA_bob_' + Math.random().toString(36).substring(2, 7),
    identity: 'bob-engineer',
    name: 'Bob (Tokyo)',
    state: 'ACTIVE',
    tracks: [
      { sid: 'TR_cam_bob', type: 'VIDEO', name: 'camera', muted: false, width: 1280, height: 720, source: 'CAMERA', mimeType: 'video/vp8' },
      { sid: 'TR_mic_bob', type: 'AUDIO', name: 'microphone', muted: true, source: 'MICROPHONE', mimeType: 'audio/opus' },
    ],
    metadata: JSON.stringify({ avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', role: 'Attendee' }),
    joinedAt: Date.now() - 1000 * 60 * 8,
    isPublisher: true,
    isSpeaking: false,
    audioLevel: 0.05,
    permission: { canSubscribe: true, canPublish: true, canPublishData: true, hidden: false, recorder: false },
  });

  participantsMap.set(demoRoom.name, roomParts);

  const testRoom: Room = {
    sid: 'RM_test_' + Math.random().toString(36).substring(2, 7),
    name: 'webrtc-playground',
    emptyTimeout: 600,
    maxParticipants: 100,
    creationTime: Date.now() - 1000 * 60 * 45,
    metadata: JSON.stringify({ tag: 'testing', region: 'asia-east' }),
    numParticipants: 0,
    numPublishers: 0,
    activeRecording: false,
  };
  roomsMap.set(testRoom.name, testRoom);
  participantsMap.set(testRoom.name, new Map());

  // Ingress & Egress demo records
  ingressMap.set('IN_live_studio', {
    ingressId: 'IN_live_studio',
    name: 'OBS Studio Feed',
    streamKey: 'live_obs_' + Math.random().toString(36).substring(2, 10),
    url: 'rtmp://localhost:1935/live',
    inputType: 'RTMP_INPUT',
    roomName: 'demo-conference',
    participantIdentity: 'ingress-bot',
    participantName: 'OBS Ingress Streamer',
    status: 'ENDPOINT_PUBLISHING',
  });
}

seedInitialData();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  // Authentication Helper
  function verifyLiveKitAuth(req: express.Request): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader) return true; // allow playground access in dev mode
    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
      jwt.verify(token, LIVEKIT_API_SECRET);
      return true;
    } catch {
      return false;
    }
  }

  // LiveKit Health & Metrics endpoints
  app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
  });

  app.get('/metrics', (req, res) => {
    let totalParticipants = 0;
    for (const parts of participantsMap.values()) {
      totalParticipants += parts.size;
    }
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    const prometheusFormat = `
# HELP livekit_rooms_total Total number of active rooms
# TYPE livekit_rooms_total gauge
livekit_rooms_total ${roomsMap.size}

# HELP livekit_participants_total Total number of active participants
# TYPE livekit_participants_total gauge
livekit_participants_total ${totalParticipants}

# HELP livekit_server_uptime_seconds Server uptime in seconds
# TYPE livekit_server_uptime_seconds counter
livekit_server_uptime_seconds ${uptimeSec}

# HELP livekit_bytes_in_total Total bytes received
# TYPE livekit_bytes_in_total counter
livekit_bytes_in_total ${Math.floor(uptimeSec * 45200 + 12000)}

# HELP livekit_bytes_out_total Total bytes transmitted
# TYPE livekit_bytes_out_total counter
livekit_bytes_out_total ${Math.floor(uptimeSec * 98400 + 48000)}
    `.trim();
    res.setHeader('Content-Type', 'text/plain');
    res.send(prometheusFormat);
  });

  app.get('/api/server/info', (req, res) => {
    let totalParticipants = 0;
    let totalPublishers = 0;
    let totalTracksIn = 0;
    for (const parts of participantsMap.values()) {
      totalParticipants += parts.size;
      for (const p of parts.values()) {
        if (p.isPublisher) totalPublishers++;
        totalTracksIn += p.tracks.length;
      }
    }

    const uptime = Math.floor((Date.now() - START_TIME) / 1000);
    res.json({
      version: '1.5.2',
      nodeId: NODE_ID,
      region: 'asia-east-1',
      uptime,
      numRooms: roomsMap.size,
      numParticipants: totalParticipants,
      numTracksIn: totalTracksIn,
      numTracksOut: totalTracksIn * Math.max(1, totalParticipants - 1),
      bytesInPerSec: Math.floor(45000 + Math.sin(Date.now() / 10000) * 12000),
      bytesOutPerSec: Math.floor(180000 + Math.sin(Date.now() / 8000) * 45000),
      cpuUsage: +(12.4 + Math.sin(Date.now() / 15000) * 4.2).toFixed(1),
      memoryUsage: +(34.8 + Math.cos(Date.now() / 20000) * 2.1).toFixed(1),
      packetLossRate: +(0.08 + Math.sin(Date.now() / 25000) * 0.03).toFixed(2),
      activeEgressCount: Array.from(egressMap.values()).filter(e => e.status === 'EGRESS_ACTIVE').length,
      activeIngressCount: Array.from(ingressMap.values()).filter(i => i.status === 'ENDPOINT_PUBLISHING').length,
    });
  });

  // Token Minting & Verification
  app.post('/api/token/create', (req, res) => {
    const { apiKey, apiSecret, identity, name, room, metadata, validFor, videoGrant } = req.body;
    const keyToUse = apiKey || LIVEKIT_API_KEY;
    const secretToUse = apiSecret || LIVEKIT_API_SECRET;

    if (!identity) {
      return res.status(400).json({ error: 'Identity is required' });
    }

    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = validFor ? parseInt(validFor, 10) * 3600 : 24 * 3600;

    const grant = videoGrant || {
      roomJoin: true,
      room: room || 'demo-conference',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: true,
    };

    const payload = {
      sub: identity,
      name: name || identity,
      iss: keyToUse,
      nbf: now - 5,
      exp: now + ttlSeconds,
      video: grant,
      metadata: metadata || '',
    };

    try {
      const token = jwt.sign(payload, secretToUse, { algorithm: 'HS256' });
      res.json({
        token,
        claims: payload,
        expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/token/verify', (req, res) => {
    const { token, apiSecret } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    const secretToUse = apiSecret || LIVEKIT_API_SECRET;
    try {
      const decoded = jwt.verify(token, secretToUse);
      res.json({ valid: true, claims: decoded });
    } catch (err: any) {
      res.status(400).json({ valid: false, error: err.message });
    }
  });

  // Twirp RoomService API
  app.post('/twirp/livekit.RoomService/CreateRoom', (req, res) => {
    const { name, empty_timeout, max_participants, metadata } = req.body;
    if (!name) {
      return res.status(400).json({ code: 'invalid_argument', msg: 'name is required' });
    }

    if (roomsMap.has(name)) {
      const existing = roomsMap.get(name)!;
      return res.json({
        sid: existing.sid,
        name: existing.name,
        empty_timeout: existing.emptyTimeout,
        max_participants: existing.maxParticipants,
        creation_time: Math.floor(existing.creationTime / 1000),
        metadata: existing.metadata,
        num_participants: existing.numParticipants,
        num_publishers: existing.numPublishers,
        active_recording: existing.activeRecording,
      });
    }

    const room: Room = {
      sid: 'RM_' + Math.random().toString(36).substring(2, 9),
      name,
      emptyTimeout: empty_timeout || 300,
      maxParticipants: max_participants || 50,
      creationTime: Date.now(),
      metadata: metadata || '',
      numParticipants: 0,
      numPublishers: 0,
      activeRecording: false,
    };

    roomsMap.set(name, room);
    if (!participantsMap.has(name)) {
      participantsMap.set(name, new Map());
    }

    res.json({
      sid: room.sid,
      name: room.name,
      empty_timeout: room.emptyTimeout,
      max_participants: room.maxParticipants,
      creation_time: Math.floor(room.creationTime / 1000),
      metadata: room.metadata,
      num_participants: room.numParticipants,
      num_publishers: room.numPublishers,
      active_recording: room.activeRecording,
    });
  });

  app.post('/twirp/livekit.RoomService/ListRooms', (req, res) => {
    const { names } = req.body;
    let list = Array.from(roomsMap.values());
    if (names && Array.isArray(names) && names.length > 0) {
      list = list.filter(r => names.includes(r.name));
    }

    // Refresh participant counts
    for (const r of list) {
      const parts = participantsMap.get(r.name);
      r.numParticipants = parts ? parts.size : 0;
      r.numPublishers = parts ? Array.from(parts.values()).filter(p => p.isPublisher).length : 0;
    }

    res.json({
      rooms: list.map(r => ({
        sid: r.sid,
        name: r.name,
        empty_timeout: r.emptyTimeout,
        max_participants: r.maxParticipants,
        creation_time: Math.floor(r.creationTime / 1000),
        metadata: r.metadata,
        num_participants: r.numParticipants,
        num_publishers: r.numPublishers,
        active_recording: r.activeRecording,
      })),
    });
  });

  app.post('/twirp/livekit.RoomService/DeleteRoom', (req, res) => {
    const { room } = req.body;
    if (!room) {
      return res.status(400).json({ code: 'invalid_argument', msg: 'room name is required' });
    }
    roomsMap.delete(room);
    participantsMap.delete(room);
    res.json({});
  });

  app.post('/twirp/livekit.RoomService/UpdateRoomMetadata', (req, res) => {
    const { room, metadata } = req.body;
    const r = roomsMap.get(room);
    if (!r) {
      return res.status(404).json({ code: 'not_found', msg: 'room not found' });
    }
    r.metadata = metadata || '';
    res.json({
      sid: r.sid,
      name: r.name,
      metadata: r.metadata,
    });
  });

  app.post('/twirp/livekit.RoomService/ListParticipants', (req, res) => {
    const { room } = req.body;
    const parts = participantsMap.get(room);
    if (!parts) {
      return res.json({ participants: [] });
    }

    const list = Array.from(parts.values()).map(p => ({
      sid: p.sid,
      identity: p.identity,
      name: p.name,
      state: p.state,
      tracks: p.tracks,
      metadata: p.metadata,
      joined_at: Math.floor(p.joinedAt / 1000),
      is_publisher: p.isPublisher,
      permission: p.permission,
      is_speaking: p.isSpeaking,
      audio_level: p.audioLevel,
    }));

    res.json({ participants: list });
  });

  app.post('/twirp/livekit.RoomService/GetParticipant', (req, res) => {
    const { room, identity } = req.body;
    const parts = participantsMap.get(room);
    const p = parts?.get(identity);
    if (!p) {
      return res.status(404).json({ code: 'not_found', msg: 'participant not found' });
    }
    res.json({
      sid: p.sid,
      identity: p.identity,
      name: p.name,
      state: p.state,
      tracks: p.tracks,
      metadata: p.metadata,
      joined_at: Math.floor(p.joinedAt / 1000),
      is_publisher: p.isPublisher,
      permission: p.permission,
      is_speaking: p.isSpeaking,
      audio_level: p.audioLevel,
    });
  });

  app.post('/twirp/livekit.RoomService/RemoveParticipant', (req, res) => {
    const { room, identity } = req.body;
    const parts = participantsMap.get(room);
    if (parts) {
      parts.delete(identity);
    }
    res.json({});
  });

  app.post('/twirp/livekit.RoomService/MutePublishedTrack', (req, res) => {
    const { room, identity, track_sid, muted } = req.body;
    const parts = participantsMap.get(room);
    const p = parts?.get(identity);
    if (!p) {
      return res.status(404).json({ code: 'not_found', msg: 'participant not found' });
    }
    const tr = p.tracks.find(t => t.sid === track_sid);
    if (tr) {
      tr.muted = muted ?? true;
    }
    res.json({ track: tr });
  });

  app.post('/twirp/livekit.RoomService/UpdateParticipant', (req, res) => {
    const { room, identity, metadata, name, permission } = req.body;
    const parts = participantsMap.get(room);
    const p = parts?.get(identity);
    if (!p) {
      return res.status(404).json({ code: 'not_found', msg: 'participant not found' });
    }
    if (metadata !== undefined) p.metadata = metadata;
    if (name !== undefined) p.name = name;
    if (permission) p.permission = { ...p.permission, ...permission };
    res.json({
      sid: p.sid,
      identity: p.identity,
      name: p.name,
      metadata: p.metadata,
      permission: p.permission,
    });
  });

  app.post('/twirp/livekit.RoomService/SendData', (req, res) => {
    const { room, data, kind, destination_identities } = req.body;
    // Broadcast data message to room participants
    broadcastToRoom(room, {
      type: 'DATA_PACKET',
      data,
      kind: kind || 'RELIABLE',
      destinationIdentities: destination_identities,
      timestamp: Date.now(),
    });
    res.json({});
  });

  // Egress & Ingress API
  app.post('/twirp/livekit.Egress/ListEgress', (req, res) => {
    const { room_name } = req.body;
    let list = Array.from(egressMap.values());
    if (room_name) {
      list = list.filter(e => e.roomName === room_name);
    }
    res.json({ items: list });
  });

  app.post('/twirp/livekit.Egress/StartRoomCompositeEgress', (req, res) => {
    const { room_name, file_outputs } = req.body;
    const egressId = 'EG_' + Math.random().toString(36).substring(2, 9);
    const egress: Egress = {
      egressId,
      roomId: roomsMap.get(room_name)?.sid || 'RM_unknown',
      roomName: room_name || 'demo-conference',
      status: 'EGRESS_ACTIVE',
      startedAt: Date.now(),
      file: {
        filename: file_outputs?.filepath || `livekit-rec-${room_name}-${Date.now()}.mp4`,
        duration: 0,
        size: 0,
        location: 's3://livekit-recordings/',
      },
    };
    egressMap.set(egressId, egress);

    const r = roomsMap.get(room_name);
    if (r) r.activeRecording = true;

    res.json(egress);
  });

  app.post('/twirp/livekit.Egress/StopEgress', (req, res) => {
    const { egress_id } = req.body;
    const eg = egressMap.get(egress_id);
    if (eg) {
      eg.status = 'EGRESS_COMPLETE';
      eg.endedAt = Date.now();
      if (eg.file) {
        eg.file.duration = Math.floor((eg.endedAt - eg.startedAt) / 1000);
        eg.file.size = eg.file.duration * 1024 * 450;
      }
      const r = roomsMap.get(eg.roomName);
      if (r) r.activeRecording = false;
    }
    res.json(eg || {});
  });

  app.post('/twirp/livekit.Ingress/ListIngress', (req, res) => {
    const { room_name } = req.body;
    let list = Array.from(ingressMap.values());
    if (room_name) {
      list = list.filter(i => i.roomName === room_name);
    }
    res.json({ items: list });
  });

  app.post('/twirp/livekit.Ingress/CreateIngress', (req, res) => {
    const { input_type, name, room_name, participant_identity, participant_name } = req.body;
    const ingressId = 'IN_' + Math.random().toString(36).substring(2, 9);
    const ingress: Ingress = {
      ingressId,
      name: name || 'Live Stream Feed',
      streamKey: 'live_' + Math.random().toString(36).substring(2, 10),
      url: 'rtmp://localhost:1935/live',
      inputType: input_type || 'RTMP_INPUT',
      roomName: room_name || 'demo-conference',
      participantIdentity: participant_identity || 'ingress_' + ingressId,
      participantName: participant_name || name || 'Ingress Stream',
      status: 'ENDPOINT_BUFFERING',
    };
    ingressMap.set(ingressId, ingress);
    res.json(ingress);
  });

  app.post('/twirp/livekit.Ingress/DeleteIngress', (req, res) => {
    const { ingress_id } = req.body;
    ingressMap.delete(ingress_id);
    res.json({});
  });

  // Seed demo data reset
  app.post('/api/rooms/seed-demo', (req, res) => {
    seedInitialData();
    res.json({ success: true, message: 'Reset demo rooms and participants' });
  });

  // WebSocket RTC Signaling Server
  const wss = new WebSocketServer({ server, path: '/rtc' });
  const activeSockets = new Map<WebSocket, { room: string; identity: string; name: string }>();

  function broadcastToRoom(room: string, message: any, excludeWs?: WebSocket) {
    const str = JSON.stringify(message);
    for (const [ws, info] of activeSockets.entries()) {
      if (info.room === room && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(str);
      }
    }
  }

  wss.on('connection', (ws: WebSocket, req) => {
    // Parse URL query params
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('access_token');
    let identity = url.searchParams.get('identity') || 'guest_' + Math.random().toString(36).substring(2, 6);
    let name = url.searchParams.get('name') || identity;
    let room = url.searchParams.get('room') || 'demo-conference';

    if (token) {
      try {
        const decoded = jwt.verify(token, LIVEKIT_API_SECRET) as any;
        identity = decoded.sub || identity;
        name = decoded.name || name;
        if (decoded.video?.room) {
          room = decoded.video.room;
        }
      } catch (err) {
        console.warn('WS auth token verification error, falling back to query identity');
      }
    }

    activeSockets.set(ws, { room, identity, name });

    // Ensure room exists
    if (!roomsMap.has(room)) {
      roomsMap.set(room, {
        sid: 'RM_' + Math.random().toString(36).substring(2, 8),
        name: room,
        emptyTimeout: 300,
        maxParticipants: 50,
        creationTime: Date.now(),
        metadata: '',
        numParticipants: 1,
        numPublishers: 1,
        activeRecording: false,
      });
    }

    let parts = participantsMap.get(room);
    if (!parts) {
      parts = new Map();
      participantsMap.set(room, parts);
    }

    const participant: Participant = {
      sid: 'PA_' + Math.random().toString(36).substring(2, 8),
      identity,
      name,
      state: 'ACTIVE',
      tracks: [
        { sid: 'TR_cam_' + identity, type: 'VIDEO', name: 'camera', muted: false, source: 'CAMERA', mimeType: 'video/vp8' },
        { sid: 'TR_mic_' + identity, type: 'AUDIO', name: 'microphone', muted: false, source: 'MICROPHONE', mimeType: 'audio/opus' },
      ],
      metadata: '',
      joinedAt: Date.now(),
      isPublisher: true,
      isSpeaking: false,
      audioLevel: 0,
      permission: { canSubscribe: true, canPublish: true, canPublishData: true, hidden: false, recorder: false },
    };
    parts.set(identity, participant);

    // Send Join Response to client with current room state & peer participants
    const roomState = roomsMap.get(room);
    const existingParticipants = Array.from(parts.values());

    ws.send(JSON.stringify({
      type: 'JOIN_RESPONSE',
      participant,
      room: roomState,
      otherParticipants: existingParticipants.filter(p => p.identity !== identity),
    }));

    // Broadcast participant joined to others
    broadcastToRoom(room, {
      type: 'PARTICIPANT_JOINED',
      participant,
    }, ws);

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'TRACK_MUTE': {
            const tr = participant.tracks.find(t => t.sid === msg.trackSid || t.source === msg.source);
            if (tr) {
              tr.muted = msg.muted;
            }
            broadcastToRoom(room, {
              type: 'TRACK_MUTED',
              identity,
              trackSid: msg.trackSid,
              source: msg.source,
              muted: msg.muted,
            });
            break;
          }
          case 'AUDIO_LEVEL': {
            participant.audioLevel = msg.level;
            participant.isSpeaking = msg.level > 0.15;
            broadcastToRoom(room, {
              type: 'ACTIVE_SPEAKERS_UPDATE',
              speakers: [{ identity, level: msg.level, isSpeaking: participant.isSpeaking }],
            });
            break;
          }
          case 'CHAT_MESSAGE': {
            const chatMsg = {
              id: 'msg_' + Math.random().toString(36).substring(2, 8),
              senderIdentity: identity,
              senderName: name,
              message: msg.message,
              timestamp: Date.now(),
            };
            broadcastToRoom(room, {
              type: 'CHAT_MESSAGE',
              chatMessage: chatMsg,
            });
            // echo back to sender
            ws.send(JSON.stringify({
              type: 'CHAT_MESSAGE',
              chatMessage: chatMsg,
            }));
            break;
          }
          case 'SIGNAL_OFFER':
          case 'SIGNAL_ANSWER':
          case 'SIGNAL_ICE': {
            // WebRTC Signaling relay to target or room
            broadcastToRoom(room, {
              ...msg,
              fromIdentity: identity,
            }, ws);
            break;
          }
          case 'SIMULATE_BOT_TALK': {
            // Trigger simulated speaking for demo bots
            for (const p of parts.values()) {
              if (p.identity !== identity) {
                p.isSpeaking = true;
                p.audioLevel = +(0.5 + Math.random() * 0.4).toFixed(2);
              }
            }
            broadcastToRoom(room, {
              type: 'ACTIVE_SPEAKERS_UPDATE',
              speakers: Array.from(parts.values()).map(p => ({ identity: p.identity, level: p.audioLevel || 0, isSpeaking: !!p.isSpeaking })),
            });
            break;
          }
          default:
            broadcastToRoom(room, msg, ws);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    });

    ws.on('close', () => {
      activeSockets.delete(ws);
      const roomParts = participantsMap.get(room);
      if (roomParts) {
        roomParts.delete(identity);
      }
      broadcastToRoom(room, {
        type: 'PARTICIPANT_LEFT',
        identity,
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`LiveKit Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
