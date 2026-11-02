import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// The signed-in user's client: every query runs under their row-level security.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

type Result<T> = { data: T; error: null } | { data: null; error: { message: string } };

// Returns a query's data, or throws its error.
export function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Row-level security makes a disallowed update or delete match 0 rows instead of failing, so those
// queries select the rows they changed and this turns "nothing changed" into an error.
export function unwrapChanged<T>(result: Result<T[]>, what: string): T[] {
  const rows = unwrap(result);
  if (rows.length === 0) throw new Error(`The ${what} wasn't changed — it doesn't exist or isn't yours.`);
  return rows;
}
