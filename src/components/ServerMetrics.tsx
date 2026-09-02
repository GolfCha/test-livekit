import React, { useState, useEffect } from 'react';
import { Activity, Server, Cpu, HardDrive, Wifi, ArrowDown, ArrowUp, Copy, Check, RefreshCw } from 'lucide-react';
import { ServerStats } from '../types';

interface ServerMetricsProps {
  stats: ServerStats | null;
}

export const ServerMetrics: React.FC<ServerMetricsProps> = ({ stats }) => {
  const [prometheusRaw, setPrometheusRaw] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPrometheus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/metrics');
      const text = await res.text();
      setPrometheusRaw(text);
    } catch (err) {
      console.error('Failed to load metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrometheus();
  }, []);

  const copyPrometheus = () => {
    navigator.clipboard.writeText(prometheusRaw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>LiveKit Node Metrics &amp; Prometheus Telemetry</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time SFU performance, bitrate counters, and Prometheus /metrics exporter
          </p>
        </div>

        <button
          onClick={fetchPrometheus}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>CPU Load</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{stats?.cpuUsage ?? 12.4}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${stats?.cpuUsage ?? 12.4}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Memory Allocated</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{stats?.memoryUsage ?? 34.8}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${stats?.memoryUsage ?? 34.8}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Inbound Media</span>
            <ArrowDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats ? (stats.bytesInPerSec / 1024).toFixed(1) : '45.2'} KB/s
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono">{stats?.numTracksIn ?? 4} active tracks</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Outbound SFU Fanout</span>
            <ArrowUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats ? (stats.bytesOutPerSec / 1024).toFixed(1) : '182.4'} KB/s
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono">{stats?.numTracksOut ?? 8} distributed tracks</div>
        </div>
      </div>

      {/* Node Details Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>LiveKit Node Specification</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Version</div>
            <div className="text-cyan-400 font-bold">{stats?.version || '1.5.2'}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Node ID</div>
            <div className="text-slate-200">{stats?.nodeId || 'node_sfu'}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Region</div>
            <div className="text-slate-200">{stats?.region || 'asia-east-1'}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Server Uptime</div>
            <div className="text-emerald-400 font-bold">{stats ? formatUptime(stats.uptime) : '24m'}</div>
          </div>
        </div>
      </div>

      {/* Prometheus /metrics raw exporter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span>Prometheus Scrape Endpoint (<code>GET /metrics</code>)</span>
          </h3>

          <button
            onClick={copyPrometheus}
            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
          {prometheusRaw || 'Loading /metrics...'}
        </pre>
      </div>
    </div>
  );
};
