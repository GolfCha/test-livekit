import React, { useState } from 'react';
import { ShieldCheck, Key, Copy, Check, Terminal, FileCode, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { VideoGrant } from '../types';

export const TokenGenerator: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('devkey');
  const [apiSecret, setApiSecret] = useState<string>('secret');
  const [identity, setIdentity] = useState<string>('participant-alpha');
  const [name, setName] = useState<string>('Alpha User');
  const [room, setRoom] = useState<string>('demo-conference');
  const [validFor, setValidFor] = useState<string>('24');
  const [metadata, setMetadata] = useState<string>('{"avatar": "https://example.com/avatar.png"}');

  // Video Grants State
  const [grants, setGrants] = useState<VideoGrant>({
    roomJoin: true,
    room: 'demo-conference',
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: false,
    roomCreate: false,
    roomList: true,
    roomRecord: false,
    hidden: false,
    recorder: false,
  });

  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [tokenClaims, setTokenClaims] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  // Inspector State
  const [inspectInput, setInspectInput] = useState<string>('');
  const [inspectedResult, setInspectedResult] = useState<any>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const handleGrantChange = (key: keyof VideoGrant, value: boolean) => {
    setGrants(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateToken = async () => {
    try {
      const res = await fetch('/api/token/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          identity,
          name,
          room,
          validFor,
          metadata,
          videoGrant: {
            ...grants,
            room,
          },
        }),
      });
      const data = await res.json();
      if (data.token) {
        setGeneratedToken(data.token);
        setTokenClaims(data.claims);
      }
    } catch (err) {
      console.error('Failed to generate token', err);
    }
  };

  const handleInspectToken = async () => {
    setInspectError(null);
    setInspectedResult(null);
    try {
      const res = await fetch('/api/token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inspectInput.trim(),
          apiSecret,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setInspectedResult(data.claims);
      } else {
        setInspectError(data.error || 'Invalid LiveKit token signature or expired');
      }
    } catch (err: any) {
      setInspectError(err.message);
    }
  };

  const copyToClipboard = (text: string, type: 'token' | 'cli') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    }
  };

  const cliCommand = `livekit-cli create-token \\
  --api-key ${apiKey} --api-secret ${apiSecret} \\
  --join --room ${room} --identity ${identity} \\
  --valid-for ${validFor}h`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span>LiveKit JWT Access Token Studio</span>
        </h2>
        <p className="text-xs text-slate-400">
          Mint signed tokens for client SDKs (JS/React, Swift, Kotlin, Flutter, Unity) and test endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Token Configuration Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
            <Key className="w-4 h-4 text-cyan-400" />
            <span>Credentials &amp; Claims</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                API Key
              </label>
              <input
                id="token-api-key"
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                API Secret
              </label>
              <input
                id="token-api-secret"
                type="password"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Identity (sub)
              </label>
              <input
                id="token-identity"
                type="text"
                value={identity}
                onChange={e => setIdentity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                id="token-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Room
              </label>
              <input
                id="token-room"
                type="text"
                value={room}
                onChange={e => setRoom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Validity (Hours)
            </label>
            <input
              id="token-valid-for"
              type="number"
              value={validFor}
              onChange={e => setValidFor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* VideoGrants Toggles */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Video Grants (Permissions)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              {[
                { key: 'roomJoin', label: 'Room Join' },
                { key: 'canPublish', label: 'Can Publish' },
                { key: 'canSubscribe', label: 'Can Subscribe' },
                { key: 'canPublishData', label: 'Publish Data' },
                { key: 'roomAdmin', label: 'Room Admin' },
                { key: 'roomCreate', label: 'Room Create' },
                { key: 'roomList', label: 'Room List' },
                { key: 'roomRecord', label: 'Room Record' },
                { key: 'hidden', label: 'Hidden (Invisible)' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!grants[item.key as keyof VideoGrant]}
                    onChange={e => handleGrantChange(item.key as keyof VideoGrant, e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="btn-generate-token"
            onClick={handleGenerateToken}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Generate LiveKit Token</span>
          </button>
        </div>

        {/* Output & CLI Command */}
        <div className="space-y-6">
          {/* JWT Output */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Generated JWT Access Token</span>
              </h3>
              {generatedToken && (
                <button
                  id="btn-copy-token"
                  onClick={() => copyToClipboard(generatedToken, 'token')}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {generatedToken ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 break-all font-mono text-[11px] text-cyan-300 max-h-32 overflow-y-auto">
                  {generatedToken}
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="text-slate-400 font-semibold mb-1">Decoded Payload Claims:</div>
                  <pre className="text-slate-300 text-[11px] overflow-x-auto">
                    {JSON.stringify(tokenClaims, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                Click "Generate LiveKit Token" to produce a signed JWT.
              </div>
            )}
          </div>

          {/* CLI Command Equivalent */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Equivalent LiveKit CLI Command</span>
              </h3>
              <button
                onClick={() => copyToClipboard(cliCommand, 'cli')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
              >
                {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCli ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
              {cliCommand}
            </pre>
          </div>
        </div>
      </div>

      {/* Token Inspector Tool */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Token Verifier &amp; Grant Inspector</span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="input-inspect-token"
            type="text"
            placeholder="Paste a LiveKit JWT token to inspect and verify signature..."
            value={inspectInput}
            onChange={e => setInspectInput(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            id="btn-inspect-token"
            onClick={handleInspectToken}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            Verify Token
          </button>
        </div>

        {inspectedResult && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 font-mono space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Valid LiveKit Token Signature</span>
            </div>
            <pre className="text-slate-300 text-[11px] overflow-x-auto bg-slate-950 p-3 rounded-lg border border-slate-800">
              {JSON.stringify(inspectedResult, null, 2)}
            </pre>
          </div>
        )}

        {inspectError && (
          <div className="p-4 bg-red-950/20 border border-red-800/40 rounded-xl text-xs text-red-300 font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{inspectError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
