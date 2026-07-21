'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, Lock, Mail, AlertCircle, CheckCircle, User, LogOut, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Existing logged-in user session state
  const [activeUser, setActiveUser] = useState<{ name: string; email: string; avatar: string } | null>(null);

  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'register') setMode('register');

      if (params.get('client_id')) setClientId(params.get('client_id')!);
      if (params.get('redirect_uri')) setRedirectUri(params.get('redirect_uri')!);
      if (params.get('state')) setState(params.get('state')!);
    }

    // Check if user already has an active session via HttpOnly cookie or userinfo
    fetch('/api/proxy/oauth/userinfo', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.email) {
          const userObj = {
            email: data.email,
            name: data.name || data.email.split('@')[0],
            avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.email)}`
          };
          setActiveUser(userObj);

          // If this is a direct normal login (no client_id in URL), redirect directly to /dashboard
          const currentClientId = new URLSearchParams(window.location.search).get('client_id');
          if (!currentClientId) {
            router.push('/dashboard');
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleContinueAsActiveUser = async () => {
    setLoading(true);
    try {
      if (redirectUri) {
        const res = await fetch('/api/proxy/api/auth/authorize-session', {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (data.code) {
          window.location.href = `${redirectUri}?code=${data.code}&state=${encodeURIComponent(state)}`;
        } else {
          setActiveUser(null);
          setLoading(false);
        }
      } else {
        router.push('/dashboard');
      }
    } catch (e) {
      router.push('/dashboard');
    }
  };

  const handleSwitchAccount = async () => {
    await fetch('/api/proxy/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setActiveUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/proxy/api/auth/login' : '/api/proxy/api/auth/register';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, clientId, redirectUri, state })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
      }

      if (redirectUri && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
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
        borderRadius: '28px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
            }}>
              <Shield size={28} color="#FFF" />
            </div>
          </Link>

          <h1 style={{ fontSize: '28px', fontWeight: 800 }} className="text-gradient">
            RunAuth
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
            {clientId ? <span style={{ color: '#818CF8', fontWeight: 600 }}>PractiDE</span> : 'RunAuth SSO'} ile Giriş
          </p>
        </div>

        {/* CASE A: Active Session Exists -> Show "Continue as [User]" Screen */}
        {activeUser ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              padding: '20px',
              borderRadius: '20px',
              marginBottom: '24px'
            }}>
              <img
                src={activeUser.avatar}
                alt="Avatar"
                style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', background: '#1E293B', border: '2px solid #6366F1' }}
              />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '2px' }}>
                {activeUser.name}
              </div>
              <div style={{ fontSize: '13.5px', color: '#94A3B8' }}>
                {activeUser.email}
              </div>
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '14px', marginBottom: '24px' }}>
              Zaten açık bir RunAuth oturumunuz var. Bu hesapla devam etmek ister misiniz?
            </p>

            <button
              onClick={handleContinueAsActiveUser}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: '14px', marginBottom: '12px' }}
            >
              <UserCheck size={18} /> {activeUser.name} Olarak Devam Et
            </button>

            <button
              onClick={handleSwitchAccount}
              className="btn-secondary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '14px', color: '#94A3B8' }}
            >
              Başka Hesapla Giriş Yap
            </button>
          </div>
        ) : (
          /* CASE B: No Active Session -> Show Login / Register Forms */
          <>
            <div style={{
              display: 'flex',
              background: 'rgba(31, 41, 55, 0.6)',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <button
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: mode === 'login' ? '#374151' : 'transparent',
                  color: mode === 'login' ? '#FFF' : '#9CA3AF',
                  fontWeight: 600,
                  fontSize: '14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: mode === 'register' ? '#374151' : 'transparent',
                  color: mode === 'register' ? '#FFF' : '#9CA3AF',
                  fontWeight: 600,
                  fontSize: '14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Hesap Aç
              </button>
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
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
              {mode === 'register' && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#D1D5DB', marginBottom: '8px' }}>
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Runterya"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#D1D5DB', marginBottom: '8px' }}>
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  required
                  placeholder="isim@example.com"
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
                  Şifre
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
                style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: '12px' }}
              >
                {loading ? 'İşleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Hesabımı Oluştur'}
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12.5px', color: '#6B7280' }}>
          RunAuth Single Sign-On Güvenliği
        </div>
      </div>
    </div>
  );
}
