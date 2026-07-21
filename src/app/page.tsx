'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, User, ArrowRight, LogOut, Sparkles } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

  useEffect(() => {
    fetch('/api/proxy/oauth/userinfo', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.email) {
          setUser({ email: data.email, name: data.name || data.email.split('@')[0] });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/proxy/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div className="glass-card" style={{
        padding: '56px 48px',
        maxWidth: '480px',
        width: '100%',
        borderRadius: '32px'
      }}>
        {/* Brand Icon Badge */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 12px 30px rgba(99, 102, 241, 0.45)'
        }}>
          <Shield size={36} color="#FFF" />
        </div>

        {/* Minimal Title */}
        <h1 style={{
          fontSize: '48px',
          fontWeight: 800,
          letterSpacing: '-1.5px',
          marginBottom: '8px'
        }} className="text-gradient">
          RunAuth
        </h1>

        <p style={{
          color: '#94A3B8',
          fontSize: '16px',
          marginBottom: '36px',
          fontWeight: 400
        }}>
          Tek hesap, tüm uygulamaların.
        </p>

        {/* Dynamic Action Buttons */}
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              padding: '12px 16px',
              borderRadius: '14px',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#A5B4FC'
            }}>
              Hoş geldin, <strong>{user.name || user.email}</strong>
            </div>

            <Link href="/dashboard" className="btn-primary" style={{ padding: '16px', fontSize: '16px', borderRadius: '16px' }}>
              <User size={18} /> Hesabıma Git <ArrowRight size={18} />
            </Link>

            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '14px', fontSize: '15px', borderRadius: '16px', color: '#FCA5A5' }}>
              <LogOut size={16} /> Çıkış Yap
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Link href="/login" className="btn-primary" style={{ padding: '16px', fontSize: '16px', borderRadius: '16px' }}>
              Giriş Yap <ArrowRight size={18} />
            </Link>

            <Link href="/login?mode=register" className="btn-secondary" style={{ padding: '16px', fontSize: '16px', borderRadius: '16px' }}>
              Hesap Aç
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
