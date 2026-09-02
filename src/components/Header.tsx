import React from 'react';
import { Radio, Server, Activity, ShieldCheck, RefreshCw, Copy, Check } from 'lucide-react';
import { ServerStats } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  serverStats: ServerStats | null;
  onRefreshDemo: () => void;
  refreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  serverStats,
  onRefreshDemo,
  refreshing,
}) => {
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  const copyServerUrl = () => {
    const wsUrl = `ws://${window.location.host}/rtc`;
    navigator.clipboard.writeText(wsUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const navItems = [
    { id: 'studio', label: 'Live Video Studio', icon: Radio },
    { id: 'rooms', label: 'Rooms & Participants', icon: Server },
    { id: 'tokens', label: 'JWT Token Studio', icon: ShieldCheck },
    { id: 'api', label: 'Twirp API Playground', icon: Activity },
    { id: 'egress', label: 'Egress & Ingress', icon: RefreshCw },
    { id: 'metrics', label: 'Telemetry & Metrics', icon: Activity },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Node Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  LiveKit<span className="text-cyan-400">.SFU</span>
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Running (Port 3000)
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Node: <code className="text-slate-300 font-mono">{serverStats?.nodeId || 'node_sfu'}</code></span>
                <span>•</span>
                <span>Twirp RPC + WebRTC /rtc</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-300">
            <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Active Rooms:</span>
              <span className="font-bold text-cyan-400">{serverStats?.numRooms ?? 1}</span>
            </div>
            <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Total Participants:</span>
              <span className="font-bold text-indigo-400">{serverStats?.numParticipants ?? 2}</span>
            </div>
            <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Bitrate Out:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {serverStats ? `${(serverStats.bytesOutPerSec / 1024).toFixed(1)} KB/s` : '182 KB/s'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="btn-copy-ws-url"
              onClick={copyServerUrl}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              title="Copy WebRTC WebSocket Signaling URL"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedUrl ? 'Copied URL' : 'Copy WS URL'}</span>
            </button>

            <button
              id="btn-reset-demo"
              onClick={onRefreshDemo}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
              title="Reset sample rooms & active bot participants"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Seed Demo Data</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/80 no-scrollbar">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
