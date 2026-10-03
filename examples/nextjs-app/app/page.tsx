/**
 * FORSIDEN — offentlig, men siger goddag når den kan.
 *
 * Ingen omdirigering: en side der er offentlig skal BLIVE offentlig, også for
 * den der ikke er logget ind. Det er forskellen på `attach` og `require`.
 */
import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function Forside() {
  const session = await getSession();

  if (!session) {
    return (
      <main data-testid="nextjs-app-root">
        <h1>Next.js-eksempel</h1>
        <p>Du er ikke logget ind.</p>
        <p>
          {/* «Log ind», ikke «Log ind med Broberg ID»: der er intet at vælge imellem.
              <a>, ikke <Link>: ruten omdirigerer til BID, så det skal være et fuldt sideskift. */}
          <a data-testid="nextjs-app-login" href="/api/auth/login?returnTo=%2Fmine-data">
            Log ind
          </a>
        </p>
      </main>
    );
  }

  return (
    <main data-testid="nextjs-app-root">
      <h1>Next.js-eksempel</h1>
      {/* VIST, ikke nøglet på. Se /mine-data for hvad appen faktisk gemmer. */}
      <p data-testid="nextjs-app-hilsen">Hej {session.name ?? session.email ?? session.sub}</p>
      <p>
        <Link data-testid="nextjs-app-mine-data" href="/mine-data">Mine data</Link>
        {" · "}
        <a data-testid="nextjs-app-logout" href="/api/auth/logout">Log ud</a>
      </p>
    </main>
  );
}
