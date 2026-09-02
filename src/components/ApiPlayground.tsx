import React, { useState } from 'react';
import { Activity, Play, Send, Copy, Check, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export const ApiPlayground: React.FC = () => {
  const endpoints = [
    {
      id: 'CreateRoom',
      name: 'CreateRoom',
      url: '/twirp/livekit.RoomService/CreateRoom',
      defaultBody: JSON.stringify({
        name: 'api-room-' + Math.random().toString(36).substring(2, 6),
        empty_timeout: 300,
        max_participants: 25,
        metadata: '{"tier": "enterprise"}',
      }, null, 2),
    },
    {
      id: 'ListRooms',
      name: 'ListRooms',
      url: '/twirp/livekit.RoomService/ListRooms',
      defaultBody: JSON.stringify({
        names: [],
      }, null, 2),
    },
    {
      id: 'ListParticipants',
      name: 'ListParticipants',
      url: '/twirp/livekit.RoomService/ListParticipants',
      defaultBody: JSON.stringify({
        room: 'demo-conference',
      }, null, 2),
    },
    {
      id: 'GetParticipant',
      name: 'GetParticipant',
      url: '/twirp/livekit.RoomService/GetParticipant',
      defaultBody: JSON.stringify({
        room: 'demo-conference',
        identity: 'alice-developer',
      }, null, 2),
    },
    {
      id: 'MutePublishedTrack',
      name: 'MutePublishedTrack',
      url: '/twirp/livekit.RoomService/MutePublishedTrack',
      defaultBody: JSON.stringify({
        room: 'demo-conference',
        identity: 'alice-developer',
        track_sid: 'TR_mic_alice',
        muted: true,
      }, null, 2),
    },
    {
      id: 'SendData',
      name: 'SendData (Data Packet)',
      url: '/twirp/livekit.RoomService/SendData',
      defaultBody: JSON.stringify({
        room: 'demo-conference',
        data: 'SGVsbG8gTGl2ZUtpdCE=', // Base64 for "Hello LiveKit!"
        kind: 'RELIABLE',
        destination_identities: [],
      }, null, 2),
    },
    {
      id: 'DeleteRoom',
      name: 'DeleteRoom',
      url: '/twirp/livekit.RoomService/DeleteRoom',
      defaultBody: JSON.stringify({
        room: 'demo-conference',
      }, null, 2),
    },
    {
      id: 'ListEgress',
      name: 'ListEgress',
      url: '/twirp/livekit.Egress/ListEgress',
      defaultBody: JSON.stringify({
        room_name: 'demo-conference',
      }, null, 2),
    },
    {
      id: 'ListIngress',
      name: 'ListIngress',
      url: '/twirp/livekit.Ingress/ListIngress',
      defaultBody: JSON.stringify({
        room_name: 'demo-conference',
      }, null, 2),
    },
  ];

  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints[0]);
  const [requestBody, setRequestBody] = useState(endpoints[0].defaultBody);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectEndpoint = (ep: typeof endpoints[0]) => {
    setSelectedEndpoint(ep);
    setRequestBody(ep.defaultBody);
    setResponseOutput(null);
    setResponseStatus(null);
    setLatency(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    setResponseOutput(null);
    const start = performance.now();
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(requestBody);
      } catch (e) {
        alert('Invalid JSON in request body');
        setLoading(false);
        return;
      }

      const res = await fetch(selectedEndpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const time = Math.round(performance.now() - start);
      setLatency(time);
      setResponseStatus(res.status);

      const json = await res.json();
      setResponseOutput(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setResponseStatus(500);
      setResponseOutput(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (!responseOutput) return;
    navigator.clipboard.writeText(responseOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <span>LiveKit Twirp RPC API Bench</span>
        </h2>
        <p className="text-xs text-slate-400">
          Execute live Twirp Protocol RPC calls against the local LiveKit SFU server
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Endpoints List */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Twirp Methods
          </div>
          {endpoints.map(ep => {
            const active = selectedEndpoint.id === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => handleSelectEndpoint(ep)}
                className={`w-full text-left p-3 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                  active
                    ? 'bg-slate-900 border border-cyan-500/50 text-cyan-400 shadow-sm'
                    : 'bg-slate-900/60 border border-slate-800/80 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span>{ep.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  POST
                </span>
              </button>
            );
          })}
        </div>

        {/* Request & Response workbench */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">POST</span>
                <span className="text-slate-200">{selectedEndpoint.url}</span>
              </div>

              <button
                id="btn-execute-api"
                onClick={handleExecute}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition shadow-md shadow-cyan-500/20 self-end sm:self-auto"
              >
                <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Send Request</span>
              </button>
            </div>

            {/* Request Body Area */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Request JSON Body
              </label>
              <textarea
                id="textarea-request-body"
                rows={7}
                value={requestBody}
                onChange={e => setRequestBody(e.target.value)}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Response Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Response</span>
                {responseStatus && (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    responseStatus >= 200 && responseStatus < 300
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    HTTP {responseStatus}
                  </span>
                )}
                {latency !== null && (
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {latency} ms
                  </span>
                )}
              </div>

              {responseOutput && (
                <button
                  onClick={copyResponse}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {responseOutput ? (
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-80">
                {responseOutput}
              </pre>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                Click "Send Request" to view LiveKit server response.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
