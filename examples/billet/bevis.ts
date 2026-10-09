/**
 * BEVISET — køres på en Fly-maskine i broberg-ai med en regel i BID:
 *   bun install && bun run bevis.ts
 * Udskriver kun felter og statuskoder, aldrig billetten.
 */
import { fetchTicket } from "@broberg/sso";
import { forklar, hentFlaaden } from "./kalder.ts";
import { modtag } from "./modtager.ts";

try {
  const flaade = (await hentFlaaden()) as { count?: number };
  console.log("KALDER discovery 200, count", flaade.count);
} catch (err) {
  console.log("KALDER fejl:", forklar(err));
}
const ticket = await fetchTicket({ audience: "discovery", scope: "discovery:read" });
const med = await modtag(new Request("http://x/", { headers: { authorization: `Bearer ${ticket}` } }));
const uden = await modtag(new Request("http://x/"));
const falsk = await modtag(new Request("http://x/", { headers: { authorization: "Bearer ikke.en.billet" } }));
console.log("MODTAGER med billet", med.status, JSON.stringify(await med.json()), "· uden", uden.status, "· falsk", falsk.status);
