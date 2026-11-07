import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// How long a login lasts, however active the user is. After this they must enter their password again.
const MAX_SESSION_SECONDS = 24 * 60 * 60;

// Pages for logged-out visitors; a logged-in user opening them is sent to the dashboard.
const AUTH_PAGES = ["/login", "/signup"];
// Routes that check their own secret instead of a session.
const SECRET_ROUTES = ["/api/cron", "/api/telegram"];

// `path` is `prefix` itself or a page under it ("/login" matches "/login", not "/loginx").
function isUnder(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// When the user last typed their password (or used another sign-in method), in seconds since the epoch.
// It's the `amr` timestamp in the signed access token, which stays the same when the token is refreshed.
function signedInAt(claims: JwtPayload): number | null {
  const times = (claims.amr ?? []).flatMap((entry) => (typeof entry === "object" ? [entry.timestamp] : []));
  return times.length > 0 ? Math.min(...times) : null;
}

// Runs on every request: refreshes the session cookie, ends logins older than MAX_SESSION_SECONDS,
// and sends logged-out visitors to /login.
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isUnder(path, SECRET_ROUTES)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Don't run code between createServerClient and getClaims(): it refreshes the session token and
  // re-sets the cookies through setAll above, then verifies the token's signature.
  const { data } = await supabase.auth.getClaims();
  let claims = data?.claims ?? null;

  if (claims) {
    const since = signedInAt(claims);
    if (since === null || Date.now() / 1000 - since > MAX_SESSION_SECONDS) {
      // Revokes this session's refresh token on Supabase and clears the cookies (through setAll).
      await supabase.auth.signOut({ scope: "local" });
      claims = null;
    }
  }

  const onAuthPage = isUnder(path, AUTH_PAGES);
  if (!claims && !onAuthPage) return redirect(request, response, "/login");
  if (claims && onAuthPage) return redirect(request, response, "/");
  return response;
}

// A redirect that keeps the cookies set above (a refreshed or cleared session).
function redirect(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}
