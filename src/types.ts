export interface VideoGrant {
  roomCreate?: boolean;
  roomList?: boolean;
  roomRecord?: boolean;
  roomAdmin?: boolean;
  roomJoin?: boolean;
  room?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
  recorder?: boolean;
  ingressAdmin?: boolean;
}

export interface AccessTokenClaims {
  sub?: string;
  name?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  video?: VideoGrant;
  metadata?: string;
  sha256?: string;
}

export type TrackType = 'AUDIO' | 'VIDEO' | 'DATA';
export type TrackSource = 'UNKNOWN' | 'CAMERA' | 'MICROPHONE' | 'SCREEN_SHARE' | 'SCREEN_SHARE_AUDIO';

export interface TrackInfo {
  sid: string;
  type: TrackType;
  name: string;
  muted: boolean;
  width?: number;
  height?: number;
  simulcast?: boolean;
  source: TrackSource;
  mimeType?: string;
}

export type ParticipantState = 'JOINING' | 'JOINED' | 'ACTIVE' | 'DISCONNECTED';

export interface ParticipantInfo {
  sid: string;
  identity: string;
  name: string;
  state: ParticipantState;
  tracks: TrackInfo[];
  metadata: string;
  joinedAt: number;
  isPublisher: boolean;
  isSpeaking?: boolean;
  audioLevel?: number; // 0 to 1
  permission?: {
    canSubscribe: boolean;
    canPublish: boolean;
    canPublishData: boolean;
    hidden: boolean;
    recorder: boolean;
  };
}

export interface RoomInfo {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: number;
  turnPassword?: string;
  enabledCodecs?: string[];
  metadata: string;
  numParticipants: number;
  numPublishers: number;
  activeRecording: boolean;
}

export interface EgressInfo {
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
  stream?: {
    url: string;
    duration: number;
  };
}

export interface IngressInfo {
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

export interface ServerStats {
  version: string;
  nodeId: string;
  region: string;
  uptime: number;
  numRooms: number;
  numParticipants: number;
  numTracksIn: number;
  numTracksOut: number;
  bytesInPerSec: number;
  bytesOutPerSec: number;
  cpuUsage: number;
  memoryUsage: number;
  packetLossRate: number;
  activeEgressCount: number;
  activeIngressCount: number;
}

export interface ChatMessage {
  id: string;
  senderIdentity: string;
  senderName: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}
