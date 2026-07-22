import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const WORKER_URL = 'https://runauth-worker.runte.workers.dev';

async function handleProxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const resolvedParams = await context.params;
  const pathArr = resolvedParams?.path || [];
  const path = pathArr.length > 0 ? `/${pathArr.join('/')}` : '';
  const search = request.nextUrl.search || '';
  const targetUrl = `${WORKER_URL}${path}${search}`;

  const sessionCookie = request.cookies.get('runauth_session')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  // Attach session token to both Authorization header and Cookie header for the worker
  if (sessionCookie) {
    headers.set('Authorization', `Bearer ${sessionCookie}`);
    headers.set('Cookie', `runauth_session=${sessionCookie}`);
  } else {
    const authHeader = request.headers.get('authorization');
    if (authHeader) headers.set('Authorization', authHeader);
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const bodyText = await request.text();
      if (bodyText) {
        fetchOptions.body = bodyText;
      }
    } catch (e) {
      // ignore empty body
    }
  }

  try {
    const workerRes = await fetch(targetUrl, fetchOptions);
    let data = null;
    const resText = await workerRes.text();
    try {
      data = resText ? JSON.parse(resText) : {};
    } catch (e) {
      data = { text: resText };
    }

    const response = NextResponse.json(data, { status: workerRes.status });

    // Manage first-party HttpOnly session cookie on the frontend domain (localhost:3000 / runauth.com)
    if (data && data.sessionToken) {
      response.cookies.set({
        name: 'runauth_session',
        value: data.sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    // If logout route is hit, clear the first-party cookie
    if (path.includes('/api/auth/logout')) {
      response.cookies.set({
        name: 'runauth_session',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Proxy fetch error to worker', details: error.message },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}
