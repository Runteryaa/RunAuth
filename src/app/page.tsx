import React from 'react';
import Link from 'next/link';
import { Shield, Key, Zap, Lock, ArrowRight, CheckCircle2, Terminal, Cpu, Globe, ExternalLink, Code2 } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(6, 8, 17, 0.75)'
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
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#FFF', letterSpacing: '-0.5px' }}>
              RunAuth
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#features" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Features</a>
            <a href="#architecture" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Architecture</a>
            <a href="#integration" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Integration</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/dashboard" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }}>
              Developer Console
            </Link>
            <Link href="/login" className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1 }}>
        <section style={{ padding: '100px 24px 80px', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '100px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#A5B4FC',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '24px'
          }}>
            <Zap size={15} color="#A5B4FC" />
            Centralized OAuth 2.0 & OIDC Provider
          </div>

          <h1 style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1.5px' }} className="text-gradient">
            One Secure Identity for <br />
            <span className="text-gradient-primary">All Your Applications</span>
          </h1>

          <p style={{ fontSize: '20px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '40px', fontWeight: 400 }}>
            RunAuth is your single identity infrastructure. Sign in once, access all your connected projects seamlessly—powered by Cloudflare Workers and Oracle Cloud Autonomous Database.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary" style={{ padding: '16px 32px', fontSize: '17px' }}>
              Try Login with RunAuth <ArrowRight size={18} />
            </Link>
            <Link href="/dashboard" className="btn-secondary" style={{ padding: '16px 28px', fontSize: '17px' }}>
              <Terminal size={18} /> Manage Apps
            </Link>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px 100px' }}>
          <div style={{ textAlignment: 'center', marginBottom: '60px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }} className="text-gradient">
              Built for Speed & Enterprise Security
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '17px' }}>Everything you need to manage users across multiple projects seamlessly.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Globe size={26} color="#818CF8" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>Single Sign-On (SSO)</h3>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6 }}>
                Users create one account on RunAuth and log in to PractiDE and all your future web and mobile applications with a single click.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Cpu size={26} color="#C084FC" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>Edge Workers Speed</h3>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6 }}>
                Cloudflare Workers sitting at 300+ global edge locations cache JWT tokens and deliver sub-10ms session verification worldwide.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Shield size={26} color="#F472B6" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>Oracle Autonomous DB</h3>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6 }}>
                All user credentials and application client secrets are stored securely in Oracle Autonomous DB via ORDS REST API with zero public DB access.
              </p>
            </div>
          </div>
        </section>

        {/* Integration Code Snippet */}
        <section id="integration" style={{ maxWidth: '1000px', margin: '0 auto 100px', padding: '0 24px' }}>
          <div className="glass-card" style={{ padding: '40px', borderRadius: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Code2 size={24} color="#818CF8" />
              <h3 style={{ fontSize: '22px', fontWeight: 700 }}>Integrate RunAuth in 3 Lines of Code</h3>
            </div>
            <p style={{ color: '#94A3B8', marginBottom: '24px' }}>
              Simply redirect your users to RunAuth's authorization URL with your registered <code className="code-font" style={{ color: '#A5B4FC' }}>client_id</code>:
            </p>
            <div style={{
              background: '#04060C',
              padding: '20px 24px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              overflowX: 'auto'
            }}>
              <pre className="code-font" style={{ color: '#E2E8F0', fontSize: '14.5px', lineHeight: 1.6 }}>
                <code>{`// Redirect user to RunAuth SSO Login Portal
const authUrl = \`https://runauth.com/oauth/authorize?client_id=\${PRACTIDE_CLIENT_ID}&redirect_uri=\${CALLBACK_URL}&response_type=code&state=\${csrfState}\`;

window.location.href = authUrl;`}</code>
              </pre>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '40px 24px',
        textAlign: 'center',
        background: 'rgba(6, 8, 17, 0.9)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#818CF8" />
            <span style={{ fontWeight: 700, color: '#FFF' }}>runauth.com</span>
            <span style={{ color: '#64748B', fontSize: '14px' }}>© 2026 RunAuth Inc.</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: '#94A3B8', fontSize: '14px' }}>
            <span>Oracle Cloud Protected</span>
            <span>Cloudflare Edge Network</span>
            <span>OAuth 2.0 / OIDC Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
