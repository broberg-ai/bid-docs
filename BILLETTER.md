# Tal med en anden tjeneste uden nøgle — BID-billetter

**Kort:** En tjeneste i flåden beviser hvem den er med det bevis den allerede
har (Fly giver hver maskine et; GitHub giver hvert CI-job et), bytter det hos
Broberg ID til en **billet** der gælder 5 minutter og kun til ÉN modtager, og
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

**En GitHub-regel binder altid til ÉT workflow.** En ny workflow-fil i samme
repo får ingen billet, før reglen siger det.

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

Reglen i BID nævner workflow-filen, fx `.github/workflows/ticket-probe.yml`.
Et andet workflow i samme repo får en `workflow_not_allowed`.

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

Billetten tjekkes **lokalt** mod BID's offentlige nøgler — modtageren spørger
ikke BID ved hvert kald. Målt 9/10: med BID's nøgler spærret i 60 sekunder
blev en gyldig billet stadig godkendt seks gange i træk.

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
| `fly_org_untrusted` / `github_owner_untrusted` | du er uden for `broberg-ai` | — |
| `fly_audience_mismatch` / `github_audience_mismatch` | dit bevis er ikke udstedt til BID | bed om beviset med `aud = https://id.broberg.ai` |
| `*_token_expired` | beviset er udløbet | hent et nyt — gem det aldrig |

## 6. Aldrig

- **Gem aldrig en billet** i en fil, en log eller en besked. Den er en adgang i
  5 minutter. Hent en ny når du skal bruge den.
- **Hent den ikke ved opstart.** En tjeneste lever længere end 5 minutter;
  hent den lige før kaldet (hjælperen cacher den for dig).
