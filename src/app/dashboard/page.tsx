'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Key, Plus, Copy, Check, Lock, AppWindow, Users, ExternalLink, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [copied, setCopied] = useState<string | null>(null);

  // Mock / Live Client Apps data
  const [apps, setApps] = useState([
    {
      client_id: 'practide-app-client',
      client_secret: 'secret_practide_123',
      app_name: 'PractiDE',
      redirect_uri: 'http://localhost:3000/api/auth/callback',
      created_at: '2026-07-21'
    }
  ]);

  const [newAppName, setNewAppName] = useState('');
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [showModal, setShowModal] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    const clientId = `${newAppName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-client`;
    const clientSecret = `sec_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

    const newApp = {
      client_id: clientId,
      client_secret: clientSecret,
      app_name: newAppName,
      redirect_uri: newRedirectUri || 'http://localhost:3000/callback',
      created_at: new Date().toISOString().split('T')[0]
    };

    setApps([...apps, newApp]);
    setNewAppName('');
    setNewRedirectUri('');
    setShowModal(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Dashboard Navigation */}
      <header style={{
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(6, 8, 17, 0.85)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={20} color="#FFF" />
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#FFF' }}>RunAuth Console</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13.5px' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '6px' }} className="text-gradient">
              Registered Applications
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '15px' }}>
              Manage OAuth 2.0 client applications connected to your RunAuth provider on runauth.com
            </p>
          </div>

          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={18} /> Register New App
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94A3B8', fontSize: '14px', marginBottom: '8px' }}>
              <AppWindow size={18} color="#818CF8" /> Active Client Apps
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFF' }}>{apps.length}</div>
          </div>

          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94A3B8', fontSize: '14px', marginBottom: '8px' }}>
              <Users size={18} color="#C084FC" /> Oracle DB Protocol
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFF' }}>ORDS REST</div>
          </div>

          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94A3B8', fontSize: '14px', marginBottom: '8px' }}>
              <Lock size={18} color="#F472B6" /> Signing Algorithm
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFF' }}>HS256 JWT</div>
          </div>
        </div>

        {/* Applications List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {apps.map((app) => (
            <div key={app.client_id} className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AppWindow size={22} color="#818CF8" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFF' }}>{app.app_name}</h3>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Created on {app.created_at}</span>
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(34, 197, 94, 0.12)', color: '#4ADE80', fontSize: '12.5px', fontWeight: 600 }}>
                  Active Client
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    CLIENT ID
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#080B13', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <code className="code-font" style={{ flex: 1, color: '#818CF8', fontSize: '13.5px' }}>{app.client_id}</code>
                    <button onClick={() => copyToClipboard(app.client_id, app.client_id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                      {copied === app.client_id ? <Check size={16} color="#4ADE80" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    CLIENT SECRET
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#080B13', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <code className="code-font" style={{ flex: 1, color: '#F472B6', fontSize: '13.5px' }}>{app.client_secret}</code>
                    <button onClick={() => copyToClipboard(app.client_secret, app.client_secret)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                      {copied === app.client_secret ? <Check size={16} color="#4ADE80" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  ALLOWED REDIRECT URIs
                </label>
                <div style={{ background: '#080B13', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E1', fontSize: '13.5px' }} className="code-font">
                  {app.redirect_uri}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal for Adding New Client App */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Register New Application</h2>
            
            <form onSubmit={handleCreateApp}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#CBD5E1', marginBottom: '6px' }}>
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Next Project"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#080B13',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '14.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#CBD5E1', marginBottom: '6px' }}>
                  Allowed Redirect Callback URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://myapp.com/api/auth/callback"
                  value={newRedirectUri}
                  onChange={(e) => setNewRedirectUri(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#080B13',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '14.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                  Create App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
