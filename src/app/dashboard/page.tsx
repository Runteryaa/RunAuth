'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield, User, Lock, KeyRound, Globe, Camera, Check,
  LogOut, ShieldCheck, Trash2, Smartphone, AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{
    email: string;
    name: string;
    avatar: string;
    created_at: string;
  } | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI feedback states
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Connected Apps state
  const [connectedApps, setConnectedApps] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/oauth/userinfo', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.email) {
          const u = {
            email: data.email,
            name: data.name || data.email.split('@')[0],
            avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.email)}`,
            created_at: '2026-07-21'
          };
          setUser(u);
          setName(u.name);
          setAvatar(u.avatar);
          if (data.connected_apps && Array.isArray(data.connected_apps)) {
            setConnectedApps(data.connected_apps);
          }
          setLoading(false);
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch('/api/proxy/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, avatar })
      });
      if (res.ok) {
        const updatedUser = { ...user, name, avatar };
        setUser(updatedUser);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      }
    } catch (err) {
      // ignore
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor.');
      return;
    }

    try {
      const res = await fetch('/api/proxy/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPasswordError(data.error || 'Şifre güncellenemedi.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err: any) {
      setPasswordError('Bağlantı hatası oluştu.');
    }
  };

  const handleRevokeApp = async (appId: string) => {
    try {
      await fetch(`/api/proxy/api/user/grants/${appId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setConnectedApps(connectedApps.filter(app => app.id !== appId));
    } catch (err) {
      setConnectedApps(connectedApps.filter(app => app.id !== appId));
    }
  };

  const handleLogout = async () => {
    await fetch('/api/proxy/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    window.location.href = '/';
  };

  const presetAvatars = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Runterya',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Phoenix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Matrix'
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
        Oturum kontrol ediliyor...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(6, 8, 17, 0.85)'
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}>
              <Shield size={22} color="#FFF" />
            </div>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFF', letterSpacing: '-0.5px' }}>
              RunAuth Panel
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt="Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFF' }}>{name || user?.email}</span>
            </div>

            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13.5px', borderRadius: '10px', color: '#FCA5A5' }}>
              <LogOut size={15} /> Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Profile Header Banner */}
        <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <img
              src={avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
              alt="Profile"
              style={{ width: '96px', height: '96px', borderRadius: '50%', background: '#1F2937', border: '2px solid #6366F1' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }} className="text-gradient">
              {name || 'Kullanıcı'}
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '15px', marginBottom: '10px' }}>{user?.email}</p>
            <span style={{ padding: '4px 12px', borderRadius: '100px', background: 'rgba(99, 102, 241, 0.15)', color: '#A5B4FC', fontSize: '12.5px', fontWeight: 600 }}>
              ✓ RunAuth SSO Hesabı Aktif
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
          
          {/* Left Column: Profil & Şifre Ayarları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 1. Profil Bilgileri & Fotoğrafı */}
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={20} color="#818CF8" /> Profil Ayarları
              </h3>

              {profileSaved && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#86EFAC', fontSize: '13.5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} /> Profil başarıyla güncellendi!
                </div>
              )}

              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '10px' }}>
                    Profil Fotoğrafı Seç
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    {presetAvatars.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Preset ${i}`}
                        onClick={() => setAvatar(url)}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          background: '#1F2937',
                          border: avatar === url ? '2px solid #6366F1' : '1px solid rgba(255,255,255,0.1)',
                          transform: avatar === url ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="url"
                    placeholder="Veya profil resmi URL'si yapıştırın"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      color: '#64748B',
                      fontSize: '14.5px',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px' }}>
                  Profil Bilgilerini Kaydet
                </button>
              </form>
            </div>

            {/* 2. Şifre Değiştirme */}
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound size={20} color="#F472B6" /> Şifre Değiştir
              </h3>

              {passwordSaved && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#86EFAC', fontSize: '13.5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} /> Şifreniz başarıyla değiştirildi!
                </div>
              )}

              {passwordError && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '13.5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} /> {passwordError}
                </div>
              )}

              <form onSubmit={handleUpdatePassword}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                    Mevcut Şifre
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                    Yeni Şifre
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <button type="submit" className="btn-secondary" style={{ width: '100%', padding: '12px', borderRadius: '10px' }}>
                  Şifreyi Güncelle
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Bağlı Web Siteleri & Aktif Oturumlar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Bağlı Siteler */}
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={20} color="#38BDF8" /> Bağlı Web Siteleri
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '24px' }}>
                RunAuth hesabınızla giriş yaptığınız aktif uygulamalar.
              </p>

              {connectedApps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B', fontSize: '14px' }}>
                  Henüz bağlı hiçbir uygulama yok.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {connectedApps.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(31, 41, 55, 0.4)',
                        padding: '16px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          {app.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFF', fontSize: '16px' }}>{app.name}</div>
                          <div style={{ color: '#64748B', fontSize: '12.5px' }}>Bağlanma: {app.connectedAt}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRevokeApp(app.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12.5px', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <Trash2 size={14} /> Erişimi Kes
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Aktif Oturumlar */}
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={20} color="#4ADE80" /> Aktif Cihazlar
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>
                Şu anda açık olan RunAuth oturumlarınız.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(31, 41, 55, 0.4)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#FFF', fontSize: '15px' }}>Bu Cihaz (Mevcut Oturum)</div>
                  <div style={{ color: '#64748B', fontSize: '12.5px' }}>Windows • Web Tarayıcısı</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '100px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', fontSize: '12px', fontWeight: 600 }}>
                  Çevrimiçi
                </span>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
