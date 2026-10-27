# Tal med en anden tjeneste uden nøgle — BID-billetter

**Kort:** En tjeneste i flåden beviser hvem den er med det bevis den allerede
har (Fly giver hver maskine et; GitHub giver hvert CI-job et), bytter det hos
BID til en **billet** der gælder 5 minutter og kun til ÉN modtager, og
sender billetten med sit kald. Ingen nøgle i `.env`, ingen Fly-hemmelighed,
intet at lække.

> **Status 9/10 2026.** Virker for **Fly-tjenester** og **GitHub Actions-job**
> i organisationen `broberg-ai`. **cc-sessioner på en Mac bruger fortsat den
> gamle nøgle** — Mac-sessionerne ændres ikke, før Christian siger til. Den
> gamle nøgle-vej fjernes heller ikke endnu: billetten er en ekstra dør, ikke
> en erstatning.

Første modtager er **discovery.broberg.ai**. Hver kodeblok herunder er
kopieret ud af [`examples/billet/`](https://github.com/broberg-ai/bid-docs/tree/main/examples/billet)
— kode der er kørt mod den rigtige BID og den rigtige Discovery, både på en
Fly-maskine og i et GitHub Actions-job (9/10 2026).

Det hele bor i **`@broberg/sso` 0.14.1** (eller nyere): `fetchTicket` til at
sende, `createTicketVerifier` til at modtage.

---

## 1. Få en regel i BID — uden den får du ingen billet

BID udsteder kun en billet når der står en **adgangsregel**: *«tjeneste X må
kalde modtager Y med rettighederne Z»*. Spørg `broberg-id`
(`ask_peer({ to: "broberg-id", … })`) med:

- **hvem du er:** Fly-appens navn (præcis som `app =` i `fly.toml`), eller
  GitHub-repoet + workflow-filen (fx `.github/workflows/ci.yml`)
- **hvem du vil kalde:** fx `discovery`
- **hvad du skal:** fx `discovery:read` (læse flåde-laget) eller
  `discovery:enroll` (tilmelde dig selv)

Dit navn i billetten bliver `svc:<fly-app>` eller `svc:gh:<ejer>/<repo>`.
Reglen kan ses og rettes af driften under *Administration → Adgangsregler*
på id.broberg.ai, og hver ændring logges.

**En GitHub-regel binder altid til navngivne workflows** — ét eller flere
(F087.35). En ny workflow-fil i samme repo får ingen billet, før reglen siger
det. Reglen kan også spærre til **én gren** (fx `refs/heads/main`): så får et
job fra en anden gren eller en PR ingen billet. Bed om gren-spærren, når dit
workflow kun skal hente billetter fra main.

### Modtagere i dag

| `audience` i `fetchTicket` | modtager (`aud` i billetten) | rettigheder |
|---|---|---|
| `discovery` | `https://discovery.broberg.ai` | `discovery:read`, `discovery:enroll`, `discovery:dictionary-edit` |
| `upmetrics` | `https://upmetrics.org` | `upmetrics:enroll`, `upmetrics:issues` |
| `trail` | `https://engine.trailmem.com` | `trail:upload` |
| `cronjobs` | `https://cronjobs.webhouse.net` | `cronjobs:read`, `cronjobs:write` — kun dine egne jobs (F087.36, 12/10 2026) |
| `trail-app` | `https://app.trailmem.com` | `trail:clip` — kun BRUGER-billetter fra `trail-clipper` (F087.37, 12/10 2026) |

## 2. Hent en billet og kald — som Fly-tjeneste

```ts
import { fetchTicket, NoWorkloadIdentityError, TicketExchangeError } from "@broberg/sso";
```

```ts
// Hent billetten LIGE FØR kaldet — den gælder 5 minutter og caches for dig.
const ticket = await fetchTicket({ audience: "discovery", scope: "discovery:read" });
const res = await fetch("https://discovery.broberg.ai/api/fleet", {
  headers: { authorization: `Bearer ${ticket}` },
});
```

`fetchTicket` finder selv ud af, at den kører på Fly, og beder maskinen om
dens bevis. Du skal ikke sætte nogen miljøvariabel.

## 3. Hent en billet — som GitHub Actions-job

**Samme kode som på Fly.** `fetchTicket` ser selv, at den kører i GitHub
Actions. Jobbet skal blot have lov til at bede GitHub om sit bevis:

```yaml
permissions:
  id-token: write
  contents: read
```

Reglen i BID nævner workflow-filen (eller filerne), fx
`.github/workflows/ticket-probe.yml`. Et andet workflow i samme repo får en
`workflow_not_allowed`, og med gren-spærre giver en anden gren `ref_not_allowed`.

## 4. Tag imod billetter — som modtager

```ts
import { createTicketVerifier, JwksUnavailableError, SsoError } from "@broberg/sso";
```

```ts
const verifier = createTicketVerifier({
  issuer: "https://id.broberg.ai",
  audience: "https://discovery.broberg.ai",
});
```

```ts
const { principal, scopes } = await verifier.verify(auth.slice(7), { scope: "discovery:read" });
```

```ts
// BID et øjeblik væk OG en ukendt nøgle: prøv igen, afvis ikke kalderen.
if (err instanceof JwksUnavailableError) return new Response("prøv igen", { status: 503 });
if (err instanceof SsoError) return new Response("billet afvist", { status: 401 });
```

`principal` er afsenderens navn (`svc:cardmem`, `svc:gh:broberg-ai/components`
…). Brug det til at afgøre, hvad afsenderen må hos dig.

Billetten indeni, hvis du tjekker den uden `@broberg/sso` (målt i BID's tests):
`iss` = `https://id.broberg.ai` (nøgler på `https://id.broberg.ai/jwks`, EdDSA),
`aud` = modtagerens adresse, `sub` = `client_id` = afsenderen, `scope` = en
**mellemrums-adskilt streng**, `principal_type` = `"service"`, `ver` = `1`.

Billetten tjekkes **lokalt** mod BID's offentlige nøgler — modtageren spørger
ikke BID ved hvert kald. Målt 9/10: med BID's nøgler spærret i 60 sekunder
blev en gyldig billet stadig godkendt seks gange i træk.

## 4b. Bruger-billetter — en app veksler sin BRUGERS login (F087.37)

En app hvor en bruger er logget ind med BID (fx en browserudvidelse), kan
bytte brugerens adgangstoken til en billet til ÉN modtager — samme format som
maskinernes, så modtageren tjekker den med samme `createTicketVerifier`.

```
POST https://id.broberg.ai/oauth2/token
  grant_type=urn:ietf:params:oauth:grant-type:token-exchange
  subject_token=<brugerens BID-adgangstoken>
  subject_token_type=urn:ietf:params:oauth:token-type:access_token
  client_id=trail-clipper            (+ client_secret hvis appen har en)
  resource=https://app.trailmem.com
  scope=trail:clip                   (valgfri — ellers reglens scopes)
```

Reglen oprettes af broberg-id med samme kommando som for maskiner; for en
almindelig app giver den samtidig appen lov til at veksle:

```
bun run src/service-principal.ts rule trail-clipper https://app.trailmem.com - trail:clip
```

I billetten: `sub` = **brugerens** id, `client_id`/`azp` = appen der byttede,
`principal_type` = `"user"`, `ver` = `1`. Modtageren slår brugeren op på `sub`
og afgør selv hvad brugeren må — BID siger kun at login'et må bruges HER.

BID udsteder kun mens brugerens BID-login lever: efter log ud, «log ud
overalt», ny kode eller udløb svarer den `subject_token_inactive`, og appen
skal forny sit token — fejler fornyelsen også, så bed brugeren logge ind igen. En billet kan ikke veksles videre (`subject_is_ticket`).

## 4c. På vegne af et menneske — samtykke (F087.40)

En **agent** sender desuden `requested_subject=<mail eller bruger-id>` (og evt. `delegation_ttl` i sekunder, 3600–2592000; standard 30 dage).

- Har mennesket ikke sagt ja: `400 consent_required` med `consent_uri` (gælder 10 min). Giv mennesket linket. BID sender intet selv.
- Har hun sagt ja: billetten har `sub` = mennesket, `act.sub` = agenten, `principal_type: user`. Scopes = det hun gav ∩ agentens regel.
- Hun kan trække det tilbage under Konto → Agenter (F087.42). Derefter: `consent_required` igen.

## 4d. Som edge — en af ejerens maskiner med buddy (F087.50)

En cc-session på en Mac (eller en anden edge) har intet platform-ID. I stedet beviser **edgen** sig med sin egen nøgle: buddy har ét ES256-nøglepar (P-256), den private del som `~/.buddy/edge-identity.key` (mode 600), og BID kender kun den offentlige (registreret med `agent-registry.ts edge-key`).

Påstanden buddy signerer (ES256), sendt som `subject_token` med `subject_token_type=urn:ietf:params:oauth:token-type:jwt`:

```text
header:  { "alg": "ES256" }
payload: {
  "iss": "edge:<navn>",          // fx edge:m1, edge:cb-2 — samme som sub
  "sub": "edge:<navn>",
  "aud": "https://id.broberg.ai",
  "iat": <nu>,
  "exp": <højst iat + 300>,
  "jti": "<engangs, ≤ 128 tegn>",
  "session": "<sessionens navn>"  // valgfri, 1–80 tegn [A-Za-z0-9._-]
}
```

Billetten: `sub` = edgens `agent-<uuid>`, `principal_type: agent`, `edge: "<navn>"`, `session`, `agent_card`.

**`session` er edgens oplysning, ikke et bevis.** Alle sessioner på en maskine kører som samme bruger, så BID står kun inde for at billetten kom fra den registrerede edge. Brug `session` til at vise og logge HVEM der spurgte, ikke til at give adgang.

Afvisninger: `edge_unknown`, `edge_assertion_invalid` (signatur, `aud`, `iss`/`sub`, `jti`, `session`), `edge_assertion_expired`, `edge_assertion_too_long` (exp − iat > 300), `edge_assertion_replayed` (samme `jti` to gange), `agent_not_active` (edgen er slukket), `no_rule_for_audience`.

## 5. Når det går galt

```ts
// BID siger hvorfor: code er fx no_rule_for_audience — bed broberg-id om en regel.
if (err instanceof TicketExchangeError) return `BID afviste: ${err.code}`;
// På en Mac (eller lokalt) findes intet platformsbevis — brug den gamle nøgle dér.
if (err instanceof NoWorkloadIdentityError) return "ingen Fly/GitHub-identitet her";
```

`err.code` er BID's eget navn for afvisningen:

| Fejl | Betyder | Gør |
|---|---|---|
| `no_rule_for_audience` | der er ingen regel for dig → den modtager | bed broberg-id om en regel |
| `scope_not_allowed` | du bad om mere end reglen giver | bed om mindre, eller om en bredere regel |
| `service_not_registered` | BID kender ikke `svc:<dit-navn>` | bed broberg-id registrere dig |
| `workflow_not_allowed` | GitHub: forkert workflow-fil i forhold til reglen | kør fra den fil reglen nævner |
| `ref_not_allowed` | GitHub: reglen er spærret til en anden gren | kør fra den gren reglen nævner (typisk main) |
| `fly_org_untrusted` / `github_owner_untrusted` | du er uden for `broberg-ai` | — |
| `fly_audience_mismatch` / `github_audience_mismatch` | dit bevis er ikke udstedt til BID | bed om beviset med `aud = https://id.broberg.ai` |
| `*_token_expired` | beviset er udløbet | hent et nyt — gem det aldrig |
| `client_mismatch` | bruger: tokenet tilhører en anden app | veksl kun din egen apps tokens |
| `subject_token_inactive` | bruger: tokenet er udløbet, tilbagekaldt, ukendt — eller brugerens BID-login er slut | forny tokenet og veksl igen; fejler fornyelsen, så log ind igen |
| `session_ended` | bruger: tokenet er ikke bundet til et BID-login | brug et token fra et rigtigt login |
| `subject_is_ticket` | bruger: du sendte en billet, ikke et adgangstoken | veksl det oprindelige adgangstoken |
| `client_unauthenticated` | bruger: appen kunne ikke bekræftes, eller må ikke veksle | bed broberg-id om en regel |

## 6. Aldrig

- **Gem aldrig en billet** i en fil, en log eller en besked. Den er en adgang i
  5 minutter. Hent en ny når du skal bruge den.
- **Hent den ikke ved opstart.** En tjeneste lever længere end 5 minutter;
  hent den lige før kaldet (hjælperen cacher den for dig).
