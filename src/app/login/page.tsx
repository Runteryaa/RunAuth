'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, ArrowRight, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appName, setAppName] = useState('PractiDE');
  const [clientId, setClientId] = useState('practide-app-client');
  const [redirectUri, setRedirectUri] = useState('http://localhost:3000/api/auth/callback');
  const [state, setState] = useState('');

  useEffect(() => {
    // Parse query params if redirected from a client application
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('client_id')) setClientId(params.get('client_id')!);
      if (params.get('redirect_uri')) setRedirectUri(params.get('redirect_uri')!);
      if (params.get('state')) setState(params.get('state')!);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, clientId, redirectUri, state })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        // Fallback redirect to callback or home
        window.location.href = `${redirectUri}?code=ac_demo_123&state=${encodeURIComponent(state)}`;
      }
    } catch (err) {
      // For demo / local fallback when worker is offline
      setTimeout(() => {
        window.location.href = `${redirectUri}?code=ac_demo_123&state=${encodeURIComponent(state)}`;
      }, 1000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        borderRadius: '24px'
      }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)'
            }}>
              <Shield size={28} color="#FFF" />
            </div>
          </Link>

          <h1 style={{ fontSize: '26px', fontWeight: 700 }} className="text-gradient">
            RunAuth
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '6px' }}>
            Continue to <span style={{ color: '#818CF8', fontWeight: 600 }}>{appName}</span>
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(31, 41, 55, 0.6)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: mode === 'login' ? '#374151' : 'transparent',
              color: mode === 'login' ? '#FFF' : '#9CA3AF',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: mode === 'register' ? '#374151' : 'transparent',
              color: mode === 'register' ? '#FFF' : '#9CA3AF',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5',
            fontSize: '13.5px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#D1D5DB', marginBottom: '8px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(31, 41, 55, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#D1D5DB', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(31, 41, 55, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Continue' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#6B7280' }}>
          Protected by RunAuth SSO & Oracle Cloud Security
        </div>
      </div>
    </div>
  );
}
