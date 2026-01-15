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
    ],
  },
  debug: true,
});

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname === '/mcp' ||
    pathname === '/sse' ||
    pathname === '/message' ||
    pathname.startsWith('/.well-known/oauth-protected-resource')
  ) {
    return new Response(null, {
      headers: {
        'x-middleware-next': '1',
      },
    });
  }

  const response = await authMiddleware(request, event);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
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
