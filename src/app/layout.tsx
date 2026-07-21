import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RunAuth | Universal Identity & OAuth Provider',
  description: 'The centralized, ultra-secure OAuth 2.0 & OIDC identity provider for all your applications.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg-glow-container">
          <div className="glow-orb glow-1"></div>
          <div className="glow-orb glow-2"></div>
          <div className="glow-orb glow-3"></div>
        </div>
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
