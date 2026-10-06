import { pontive } from "@/lib/pontive";

/**
 * The SDK's routes under /api/auth. In browser mode there is one:
 * /api/auth/switch-organization, which sends the browser through the auth
 * server's session handshake into another organization.
 */
export function GET(request: Request) {
  return pontive().handlers.GET(request);
}

export function POST(request: Request) {
  return pontive().handlers.POST(request);
}
