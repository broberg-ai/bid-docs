/**
 * HELE KOBLINGEN TIL BROBERG ID, ét sted.
 *
 * ── HVORFOR DER IKKE ER EN ADAPTER HER ────────────────────────────────────
 *
 * `@broberg/sso` har en Hono-adapter og ingen Next.js-adapter. Den behøves
 * heller ikke: pakkens KERNE er framework-fri, og de fem funktioner herunder
 * er alt en Next.js-app skal bruge. En adapter ville spare de ~40 linjer i
 * ruterne og koste en pakke der skal følge med Next.js' egne skift.
 *
 * ── DE TO COOKIES, og hvorfor de er forskellige ──────────────────────────
 *
 *   FLOW-cookien      lever mellem /login og /callback. 10 minutter. Bærer
 *                     state, code_verifier og nonce — de tre ting der
 *                     beviser at det svar der kommer retur, hører til DET
 *                     login VI startede.
 *   SESSIONS-cookien  lever bagefter. Bærer kun `sub`, `exp` og et par
 *                     bekvemmeligheder. Ingen roller, ingen rettigheder.
 *
 * Begge er SIGNEREDE og HttpOnly. Flow-cookien må ikke være langlivet: den
 * er et engangsbevis, og en gammel ligger og venter på at blive genbrugt.
 */
import { createSsoClient, loadSsoConfig } from "@broberg/sso";

export const config = loadSsoConfig();
export const sso = createSsoClient(config);

/** Navnene ét sted. To filer der er enige om en cookie-streng driver fra
 *  hinanden den dag den ene rettes. */
export const FLOW_COOKIE = "bid_flow";
export const SESSION_COOKIE = config.cookieName;

/** Secure slås KUN fra på http://localhost. En browser husker «altid https»
 *  for en vært, så en forkert secure på localhost følger udvikleren rundt
 *  længe efter den er fjernet igen. */
export const secureCookies = !config.redirectUri.startsWith("http://localhost");

/** Flow-cookien er et ENGANGSBEVIS. Ti minutter er rigeligt til et login og
 *  kort nok til at en glemt cookie ikke kan genbruges i morgen.
 *
 *  DET TAL BRUGES TO STEDER, og det er med vilje: som cookiens `Max-Age` OG
 *  som `maxAgeSeconds` på selve signaturen (`@broberg/sso` 0.2.3+). Max-Age
 *  alene er BROWSERENS løfte om hvornår værdien holder op med at gælde — en
 *  klient kan simpelthen lade være med at give det løfte, og så tog serveren
 *  imod en korrekt signeret flow-værdi for evigt. Sætningen ovenfor var altså
 *  usand for enhver der havde selve værdien; nu er den sand.
 *
 *  ── OG DE TO TAL ER IKKE ÉT TAL ──────────────────────────────────────────
 *
 *  Her stod indtil 22. september 2026 ÉN konstant til begge formål. Det er
 *  den nærliggende læsning, og den koster en diagnose: **en cookie browseren
 *  har smidt væk, ankommer aldrig.** Udløber de to samtidig, er der i det
 *  sekund vinduet passerer ingenting i requesten — og callback'en kan ikke
 *  skelne «hun var for længe undervejs» fra «hun har aldrig startet et
 *  login». Meldt af helpdesk via components, som rettede samme form i deres
 *  egen adapter (0.3.0).
 *
 *  Den ekstra levetid er INERT: en for gammel transaktion kan ikke veksles —
 *  `verifyValue` afviser den på stemplet — og cookien ryddes i samme svar.
 *  Det eneste den køber, er at værdien stadig ANKOMMER, så vi kan sige hvad
 *  der gik galt. */
export const FLOW_MAX_AGE = 600;

/** Cookiens egen levetid. LÆNGERE end serverens grænse, med vilje — se
 *  ovenfor. Samme faktor som `@broberg/sso`s Hono-adapter bruger. */
export const FLOW_COOKIE_MAX_AGE = FLOW_MAX_AGE * 3;
