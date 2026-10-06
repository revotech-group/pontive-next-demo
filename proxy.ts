import type { NextRequest } from "next/server";

import { pontive } from "@/lib/pontive";

/**
 * Keeps the server's view of the session current. It never refreshes: when a
 * signed-in user loads a page after the access token has lapsed, it sends the
 * browser through the auth server's session handshake, which renews the
 * cookies and comes straight back. Everything else passes through.
 */
export function proxy(req: NextRequest) {
  return pontive().middleware(req);
}

export const config = {
  // Not the auth proxy itself, Next's internals or static files.
  matcher: ["/((?!__auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};
