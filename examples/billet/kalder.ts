/**
 * AFSENDEREN — en tjeneste på Fly (eller et GitHub Actions-job) kalder
 * Discovery med en BID-billet i stedet for en nøgle. Kørt live 9/10 2026 på
 * BID's egen Fly-maskine (svc:broberg-id) — se bevis.ts.
 */
import { fetchTicket, NoWorkloadIdentityError, TicketExchangeError } from "@broberg/sso";

export async function hentFlaaden(): Promise<unknown> {
  // Hent billetten LIGE FØR kaldet — den gælder 5 minutter og caches for dig.
  const ticket = await fetchTicket({ audience: "discovery", scope: "discovery:read" });
  const res = await fetch("https://discovery.broberg.ai/api/fleet", {
    headers: { authorization: `Bearer ${ticket}` },
  });
  if (!res.ok) throw new Error(`discovery svarede ${res.status}`);
  return res.json();
}

export function forklar(err: unknown): string {
  // BID siger hvorfor: code er fx no_rule_for_audience — bed broberg-id om en regel.
  if (err instanceof TicketExchangeError) return `BID afviste: ${err.code}`;
  // På en Mac (eller lokalt) findes intet platformsbevis — brug den gamle nøgle dér.
  if (err instanceof NoWorkloadIdentityError) return "ingen Fly/GitHub-identitet her";
  return String(err);
}
