import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import type { NextFetchEvent, NextRequest } from 'next/server';

// Prefer explicit redirect URI; fall back to preview deployment URL
const fallbackHost =
  process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || 'localhost:3000';

const fallbackProto = fallbackHost.includes('localhost') ? 'http' : 'https';
const computedRedirectUri = `${fallbackProto}://${fallbackHost}/callback`;
const REDIRECT_URI =
  process.env.WORKOS_REDIRECT_URI ||
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ||
  computedRedirectUri;

const authMiddleware = authkitMiddleware({
  redirectUri: REDIRECT_URI,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/login',
      '/register',
      '/callback',
      '/ping',
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/:path*',
      '/.well-known/oauth-authorization-server',
      '/.well-known/workflow/v1/flow',
      '/.well-known/workflow/v1/step',
      '/.well-known/workflow/v1/webhook/:token',
      '/mcp',
      '/sse',
      '/message',
      '/api/mcp',
      '/api/transcripts/:id/download',
    ],
  },
  debug: true,
});

const redactHeaders = (
  headers: Headers,
): Record<string, string | undefined> => {
  const rawHeaders = Object.fromEntries(headers.entries());
  return {
    ...rawHeaders,
    authorization: rawHeaders.authorization ? '[redacted]' : undefined,
    cookie: rawHeaders.cookie ? '[redacted]' : undefined,
    'x-workos-session': rawHeaders['x-workos-session']
      ? '[redacted]'
      : undefined,
  };
};

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const pathname = request.nextUrl.pathname;

  console.log('[proxy] request', {
    method: request.method,
    url: request.url,
    pathname,
    headers: redactHeaders(request.headers),
  });

  if (
    pathname === '/mcp' ||
    pathname === '/sse' ||
    pathname === '/message' ||
    pathname.startsWith('/.well-known/oauth-protected-resource') ||
    pathname.match(/^\/api\/transcripts\/\d+\/download$/)
  ) {
    console.log('[proxy] bypass auth for path', pathname);
    return new Response(null, {
      headers: {
        'x-middleware-next': '1',
      },
    });
  }

  const response = await authMiddleware(request, event);
  const responseHeaders = response
    ? Object.fromEntries(response.headers.entries())
    : null;
  const redactedResponseHeaders = responseHeaders
    ? {
        ...responseHeaders,
        'set-cookie': responseHeaders['set-cookie']
          ? '[redacted]'
          : undefined,
      }
    : null;

  console.log('[proxy] authMiddleware response', {
    hasResponse: Boolean(response),
    status: response?.status,
    statusText: response?.statusText,
    headers: redactedResponseHeaders,
  });

  return new Response(response!.body, {
    status: response!.status,
    statusText: response!.statusText,
    headers: response!.headers,
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
