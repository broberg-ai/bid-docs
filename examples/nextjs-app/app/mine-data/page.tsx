/**
 * EN SIDE DER KRÆVER LOGIN.
 *
 * `redirect()` til vores egen /api/auth/login, som laver et FULDT sideskift
 * til BID og tilbage hertil. Aldrig en skjult ramme.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * DET APPEN SELV GEMMER, nøglet på `sub`.
 *
 * Bemærk hvad der IKKE er her: ingen mailadresse, intet navn. Kopierer man
 * dem ind som nøgle, har man en anden mening om hvem folk er — og intet
 * fortæller nogensinde at den er blevet forkert.
 */
const noterPrSubject = new Map<string, string>();

export default async function MineData() {
  const session = await getSession();
  if (!session) redirect("/api/auth/login?returnTo=%2Fmine-data");

  const note = noterPrSubject.get(session.sub) ?? "(ingenting endnu)";

  return (
    <main data-testid="nextjs-app-mine-data-root">
      <h1>Mine data</h1>
      <p>
        Din note: <span data-testid="nextjs-app-note">{note}</span>
      </p>
      <p>
        Nøglet på <code data-testid="nextjs-app-sub">{session.sub}</code> — ikke på din mailadresse.
      </p>
      <p>
        <a data-testid="nextjs-app-logout" href="/api/auth/logout">Log ud</a>
      </p>
    </main>
  );
}
