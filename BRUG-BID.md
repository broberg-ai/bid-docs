# Kobl din app på Broberg ID

Denne vejledning er skrevet ud fra [`examples/minimal-app/`](https://github.com/broberg-ai/bid-docs/tree/main/examples/minimal-app) — en app der aldrig
havde været koblet på, og som blev det ved at følge trinnene herunder. Hver
kodeblok er **kopieret ud af den app der kører**, ikke skrevet af hånden
bagefter. Køres den igennem, ser du en rigtig bruger blive logget ind.

> **Læser du det her som en AI-assistent?** Så er
> <https://id.broberg.ai/llms.txt> den korte, handlingsrettede udgave —
> rækkefølgen, felterne og de fejl der koster mest, uden begrundelserne.
> Hele denne tekst råt: <https://id.broberg.ai/llms-full.txt>.

> **Dette er IKKE et design.** Eksemplet har med vilje ingen styling og intet
> byggetrin. Din apps skærmbilleder bygges stadig i Stack A (Next.js) eller
> Stack B (Vite + Preact + Tailwind). Det du kopierer herfra er **ledningen**,
> ikke layoutet.

---

## Login-reglen — en BETINGELSE for at bruge BID

**Én login-dialog: BID's. Din app har ingen egen.** Det er ikke en anbefaling —
det er betingelsen for at blive optaget (Christian, 28/9 2026: *«der findes kun
1 udgave af login hos ALLE apps og det er en central»*). Som Microsofts login:
den skifter ikke fra produkt til produkt.

- **Appen viser ALDRIG en login-side. /login er en omdirigering direkte til BID — ingen side, ingen knap, intet «Log ind med Broberg ID».**
  /login og enhver side der kræver login sender brugeren videre via `@broberg/sso`'s
  login-rute med et fuldt sideskift. En side der LINKER til dialogen er stadig appens
  egen login-side. Ingen iframe — BID kan ikke vises i en ramme, og adgangsnøgler
  virker kun på BID's eget domæne.
- Appen har **ingen egen login-formular**: ingen adgangskode, ingen adgangsnøgle,
  intet GitHub/Google, intet login-link.
- **Aldrig begge på samme side.** Indtil skiftet er det gamle login UÆNDRET og uden
  BID-knap; BID-ruten findes, men linkes ingen steder fra (bevis den ved at åbne den
  direkte). Skiftet er ÉN udrulning: /login bliver omdirigering OG det gamle slettes.
  migration-status (afsnit 5c) afgør HVORNÅR skiftet sker — ikke at begge vises imens.
- **BID som én af flere login-muligheder er IKKE optagelse.** En Auth.js/NextAuth-provider ved siden af magic-link, en adgangskode eller Google er stadig to logins. BID er den ENESTE vej ind, og de andre slettes.
- Appen styler, kopierer eller efterligner ikke dialogen. Den er den samme i alle
  apps; kun «Fortsæt til <appens navn>» skifter, og navnet kommer fra BID's register.
- Se den selv: <https://id.broberg.ai/login>

---

## Hvad BID er, og hvad din app selv skal holde

```
BID    holder IDENTITETEN      hvem er du, hvordan beviser du det
DIN APP holder SINE EGNE DATA  nøglet på BID's bruger-id (tokenets `sub`)
```

**Kopiér ALDRIG mailadresser eller navne ind i din egen tabel som nøgle.** Et
menneske kan eje flere adresser hos BID og kan gøre en anden til sin primære.
Gemmer du adressen, har du en anden mening om hvem folk er — og intet fortæller
dig nogensinde at den er blevet forkert.

Sådan ser det ud i eksemplet:

```ts
const notesBySubject = new Map<string, string>();
```

`sub` er det eneste stabile. Navn, mail og billede er bekvemmeligheder du må
vise — ikke noget du må nøgle på eller træffe beslutninger om adgang ud fra.

---

## 1. Registrér din app som klient

Dynamisk registrering er slået **fra** med vilje: en ukendt part må ikke kunne
oprette sig selv en klient og begynde at samle samtykker under vores domæne. Så
registreringen er en bevidst handling, udført af BID.

**Du skal ikke køre noget.** Du afleverer en spec, og BID registrerer klienten
og sender de bekræftede værdier tilbage — læst ud af rækken, ikke af det du bad
om. Skemaet står i næste afsnit.

Du vil næsten altid have **to** redirect-adresser: din rigtige callback og en
`localhost`-udgave. En forbruger der ikke kan bevise ledningen lokalt, beviser
den i produktionen.

### Hvilken af DINE flader skal bære callback'en?

**Det er den vigtigste beslutning i hele opsætningen, og den er let at tage
forkert.** Den er målt: ved BID's første rigtige optagelse gættede vi på appens
konsol, og appen rettede os — konsollen var et statisk browser-bundt, hvor alt
er læsbart for enhver besøgende.

| din flade | kan bære callback'en? |
|---|---|
| en SERVER (Hono, Next.js route, et API) | **ja** — og den kan opbevare en hemmelighed |
| et statisk browser-bundt (Vite, React, en SPA) | nej. Læg callback'en på din server |
| en mobil-app | brug en loopback- eller app-adresse, aldrig en hemmelighed |

**Klient-typen er PUBLIC som standard.** Ikke fordi confidential er dårligere —
BID kan udstede begge — men fordi det er den type der virker uanset hvor din
callback ligger. Vil du have en confidential klient, kræver det `@broberg/sso`
**0.2.0 eller nyere**: 0.1.0 sendte slet ingen `client_secret` (målt: nul
forekomster i hele pakken), så en klient registreret som confidential blev
afvist af token-endepunktet med «Missing required client credentials» — en fejl
der ligner noget du selv har gjort forkert. Sig til når du vil hæves; det er en
ændring i BID's ende, ikke i din.

**PKCE er påkrævet uanset.** En hemmelighed er ikke en undskyldning for at
slække på den — de to beskytter mod forskellige angreb.

Lokalt (mod fiksturen) sker det samme fra kode — det her er linjen eksemplet
faktisk kører:

```ts
const { row } = await registerSelftestClient(config, {
  clientId: "minimal-app",
  redirectUris: [REDIRECT],
  name: "Minimal app",
  // UDEN denne kan appen aldrig logge nogen UD: /oauth2/end-session sender kun
  // browseren videre til en adresse der står på klientens egen hvidliste.
  postLogoutRedirectUris: [`${appOrigin}/`],
});
```

### Fælde 1 — redirect-adressen matches PRÆCIST

Én efterstillet skråstreg er en **anden adresse** og afvises. Det er målt, ikke
antaget (`src/verify-live.ts`, AC#4b). Symptomet er `invalid_request` uden noget
at gå efter, så tjek tegn for tegn at `SSO_REDIRECT_URI` er nøjagtig den du
registrerede.

### Fælde 2 — `enableEndSession` og hvidlisten

Registreringen sætter `enableEndSession: true` for hver klient, og
registreringsscriptet **fejler** hvis kolonnen ikke kom med. Det er der fordi
den manglede i produktionen i F084.16: `/oauth2/end-session` svarede *"The
client is not allowed to initiate logout"* for hver eneste klient vi havde.
Logout er ikke en valgfri funktion i en identitetstjeneste.

`postLogoutRedirectUris` er en hvidliste, ikke en bekvemmelighed. Står din
forside ikke på den, lander brugeren på BID's egen side i stedet. Tom liste er
lovligt og sikkert.

---

## 2. Installér klientpakken

```bash
bun add @broberg/sso hono
```

Den er en **public client**: der er ingen client secret, og det er med vilje. En
hemmelighed der aldrig blev udstedt kan ikke lækkes, og PKCE er så den faktiske
sikkerhedsgrænse. Det er sikkert netop fordi BID matcher redirect-adresser
præcist — en angriber kan starte et login, men ikke modtage resultatet.

---

## 3. Sæt miljøet

Pakken læser sin konfiguration fra miljøet og **ingen andre steder**. Ligger den
i kode, kan to udrulninger af samme app være uenige om hvem deres udbyder er —
og symptomet er en token-afvisning ingen kan spore tilbage til en config-linje.

| variabel | krav |
|---|---|
| `BID_ISSUER` | `https://id.broberg.ai` — bar origin. Kun `localhost` må være http |
| `SSO_CLIENT_ID` | det id du registrerede |
| `SSO_REDIRECT_URI` | nøjagtig den registrerede adresse, typisk `…/auth/callback` |
| `SSO_COOKIE_SECRET` | `openssl rand -hex 32`. Mindst 32 tegn — en kort nøgle er en session enhver kan forfalske |
| `SSO_POST_LOGOUT_REDIRECT_URI` | hvor browseren lander efter logout |
| `SSO_SCOPES` | valgfri, default `openid profile email` |
| `SSO_SESSION_MAX_AGE` | valgfri, **default 7 dage**. Holder din app person- eller helbredsdata, SKAL du sætte `43200` (12 timer) |

---

## 4. Mount ruterne

Hele koblingen er tre linjer. Kopieret fra [`examples/minimal-app/app.ts`](https://github.com/broberg-ai/bid-docs/blob/main/examples/minimal-app/app.ts):

```ts
import { Hono } from "hono";
import { getSession, ssoRoutes } from "@broberg/sso/hono";

const { app: authRoutes, attach, require: requireLogin } = ssoRoutes();

const app = new Hono();
app.route("/auth", authRoutes);
```

Det giver dig `/auth/login`, `/auth/callback` og `/auth/logout`, plus to
middlewares:

- **`attach`** — læser sessionen hvis der er en, og omdirigerer aldrig. Til en
  side der er offentlig, men gerne siger goddag når den kan.
- **`require`** — sender en bruger der ikke er logget ind til BID og tilbage til
  netop den side.

### Fælde 3 — ALTID fuldt sideskift, aldrig en skjult ramme

```ts
  // `require` sends a user who is not logged in to BID and back to THIS page.
  // A FULL page redirect — never a hidden frame. Safari has blocked
  // third-party context for years, so the frame version works on your Mac and
  // fails for every user on an iPhone.
  app.get("/mine-data", requireLogin, (c) => {
```

Pakken producerer kun URL'er til fulde sideskift — også ved `prompt=none`. Bygger
du selv en skjult ramme mod BID, virker alt i test og intet på en telefon, og
fejlen ser ud som *"du er ikke logget ind"*.

### Fælde 4 — `returnTo` er en adresse en fremmed må skrive

`/auth/login?returnTo=…` afgør hvor brugeren lander EFTER et vellykket login.
Den parameter står i en URL, så den kan sættes af hvem som helst der kan få
nogen til at klikke på et link.

> **GULVET ER IKKE ÉT TAL — det afhænger af hvilken halvdel du bruger:**
>
> | bruger du | mindst | hvad du ellers mangler |
> |---|---|---|
> | **kernen** (Next.js, dine egne ruter) | `0.2.3` | `maxAgeSeconds` på flow-cookien, og en token-veksling der siger hvorfor den fejlede |
> | **Hono-adapteren** | `0.3.0` | adapterens to-tals-form, og de tre callback-fejlkoder der skelner «for sent» fra «aldrig startet» |
>
> Et enkelt tal kan ikke bære begge. Følger du kernens gulv og bruger
> adapteren, får du en adapter der deler cookiens levetid og serverens grænse
> — netop den form der koster en diagnose.
>
> **SPRING 0.2.1 OVER uanset hvad.** 0.2.1 afviser hvert eneste
> token BID udsteder: vores `/jwks` bærer **EdDSA** og discovery averterer
> `["EdDSA"]` som den eneste, mens 0.2.1's algoritme-liste kun rummer `RS256`
> og `ES256`. Login fejler med `JOSEAlgNotAllowed`.
>
> **0.2.2 er verificeret hos os** — ikke læst i en changelog, men kørt: et ægte
> EdDSA-token fra en rigtig BID hele vejen gennem den installerede pakke,
> kodeveksling og signaturverifikation inklusive. Lens-flow 2b2b15e7, 14/14.
>
> **0.2.3 giver to ting du ikke kan bygge udefra:** en token-veksling der
> siger HVORFOR den fejlede (afsnit 4b, «Hjemturen»), og en udløbsdato på
> signaturen af flow-cookien (afsnit 4b, «Flow-cookien skal have sin
> udløbsdato PÅ SIGNATUREN»). Begge er målt på den installerede pakke.
>
> **0.2.4 er browser-bevist hos os** — 22. september 2026, og heller ikke det
> er læst i en changelog: en rigtig browser gik fra eksemplets forside til
> BID's loginside, loggede ind med en rigtig bruger og landede tilbage på
> `/mine-data` med `sub` på skærmen — med den daterede flow-cookie tændt.
> Lens-flow `0ae16d30`, 10 trin, alle grønne.
>
> Her stod i et døgn at 0.2.3 IKKE var browser-bevist, fordi vores Lens-daemon
> ikke kunne starte en browser. Det var rigtigt da det blev skrevet, og
> forbeholdet stod her frem for at blive krydset af. Nu er det afløst af en
> måling frem for at blive slettet i stilhed.

**Fælden findes fra 0.2.0 og frem til den rettes.** 0.2.0 havde en vagt der
afviste `//` og krævede en indledende skråstreg — og slap en OMVENDT skråstreg
igennem:

```
/auth/login?returnTo=/\evil.dk   →   https://evil.dk/ i en browser
```

En omvendt skråstreg er ikke en sti-adskiller for RFC 3986 og **er** det for
den parser browsere faktisk bruger. Brugeren sendes derhen fra din apps eget
domæne, lige efter at have logget ind — den mest troværdige aflevering en
phishing-side kan få.

**Bygger du din EGEN returnTo-håndtering, så lad browserens parser afgøre det
— to gange — frem for at liste farlige tegn.** En tegn-liste er altid ét trick
bagud. Rettelsen i pakken gør præcis det: parser adressen, normaliserer den,
parser resultatet igen, og kræver at oprindelsen er din begge gange.

**Og læg mærke til hvad der gik galt med 0.2.1**, for det er samme lektie ét
lag inde: listen over tilladte algoritmer blev skrevet ud fra hvad en
OIDC-klient *plejer* at tillade, i stedet for ud fra hvad BID's `/jwks`
faktisk bruger. **Slå udstederen op frem for at antage.** Vores discovery-
dokument siger det på ét kald:

```bash
curl -s https://id.broberg.ai/.well-known/openid-configuration \
  | grep -o '"id_token_signing_alg_values_supported":[^]]*]'
```

---

## 4b. Next.js — samme kobling, uden adapter

**Er du på Next.js, så læs DETTE afsnit i stedet for afsnit 4.** Resten af
vejledningen gælder uændret.

Koden herunder er kopieret ud af [`examples/nextjs-app/`](https://github.com/broberg-ai/bid-docs/tree/main/examples/nextjs-app), som er koblet på en
rigtig BID og bevist i en browser: forside → BID-login → tilbage som logget
ind. Ikke skrevet af hånden bagefter.

### Hele koblingen ligger i kernen

```bash
bun add @broberg/sso next react react-dom
```

`@broberg/sso` eksporterer en framework-fri kerne ved siden af Hono-adapteren.
Fem funktioner er alt en Next.js-app skal bruge:

| funktion | hvad den gør |
|---|---|
| `createSsoClient` | `beginLogin` · `completeLogin` · `verifyIdToken` · `logoutUrl` |
| `signValue` / `verifyValue` | den kortlivede flow-cookie mellem login og callback |
| `signSession` / `verifySession` | din egen sessions-cookie bagefter |
| `cookieHeader` / `readCookie` | Set-Cookie uden at skrive strengen selv |
| `loadSsoConfig` | miljøet, læst ét sted |

### `lib/sso.ts` — koblingen, ét sted

```ts
import { createSsoClient, loadSsoConfig } from "@broberg/sso";

export const config = loadSsoConfig();
export const sso = createSsoClient(config);
```

### Start et login

```ts
export async function GET(request: Request) {
  const start = await sso.beginLogin();
```

`beginLogin()` giver dig adressen OG tre engangsværdier — `state`,
`codeVerifier` og `nonce`. De skal overleve turen til BID og hjem igen.

**Læg dem i en SIGNERET cookie, ikke i en `Map` på serveren.** En `Map` dør ved
hver udrulning, og så fejler ethvert login der var i gang, med en besked der
ikke navngiver årsagen. Cookien ligger i browseren og overlever.

### Flow-cookien skal have sin udløbsdato PÅ SIGNATUREN

**Cookiens `Max-Age` er ikke en grænse — den er browserens løfte** om hvornår
den holder op med at sende værdien. En klient kan lade være med at give det
løfte, og den der har selve strengen, sender den bare igen i morgen. Det var
hullet i vores eget eksempel indtil 21. september 2026: kommentaren lovede at
«en glemt cookie ikke kan genbruges i morgen», og serveren tog imod en korrekt
signeret flow-værdi for evigt.

Fra `@broberg/sso` **0.2.3** kan du datere det du signerer. Det skal stå
**begge** steder, og det er ikke et ryddelighedskrav:

```ts
    config.cookieSecret,
    { maxAgeSeconds: FLOW_MAX_AGE },
  );
```

```ts
  const flowJson = await verifyValue(flowCookie, config.cookieSecret, {
    maxAgeSeconds: FLOW_MAX_AGE,
  });
```

**Stemplet ligger INDE i signaturen**, og det er hele forskellen på en grænse
og en henstilling. Målt på den installerede 0.2.3: retter man tallet i den rå
værdi — den har formen `t<epoch>~<værdi>.<signatur>` — svarer `verifyValue`
`null`. Et udløb holderen selv kan redigere er ingen grænse.

**GRÆNSEN BOR I `verifyValue`.** `signValue` skriver kun tidsstemplet ind i
det signerede indhold. Læser ingen det tilbage, er det fire bytes pynt — og
sætter du den kun dér hvor cookien UDSTEDES, har du ikke fået et kortere
vindue, du har intet vindue. Alle fire tilfælde, målt på den installerede
pakke:

| signeret | verificeret | udfald |
|---|---|---|
| med grænse | med grænse, i vindue | værdien |
| med grænse | med grænse, uden for vindue | `null` |
| UDEN grænse | med grænse | `null` — fejler **lukket** |
| med grænse | **UDEN grænse** | **gyldig for evigt** |

**Den sidste række er den eneste der fejler i den grønne retning**, og derfor
den eneste der er farlig: ingen fejl, intet i loggen, ingenting at kigge på.
Vi målte den med et stempel dateret ti år tilbage — værdien kom ud.

Den tredje række er til gengæld grunden til at grænsen er noget værd: en
gammel, UDATERET cookie er ikke vejen udenom den grænse man netop har
indført.

Prisen er at flow-cookies der allerede ligger i en browser fra før
opgraderingen bliver ugyldige. For en cookie der lever ti minutter er det ti
minutters ulempe — derfor er grænsen frivillig i pakken, og derfor skal DU
sætte den. Du får den ikke gratis på kernen.

### Og cookien skal leve LÆNGERE end vinduet — to tal, ikke ét

**Det nærliggende er at bruge samme tal begge steder. Det koster en diagnose.**

En cookie browseren har smidt væk, **ankommer aldrig**. Udløber cookiens
`Max-Age` og serverens grænse samtidig, er der i det sekund vinduet passerer
ingenting i requesten — og din callback kan ikke skelne *«hun var for længe
undervejs»* fra *«hun har aldrig startet et login»*. Begge bliver til den
samme intetsigende besked, og det er den besked en udvikler står med når en
bruger ringer.

```ts
export const FLOW_MAX_AGE = 600;
export const FLOW_COOKIE_MAX_AGE = FLOW_MAX_AGE * 3;
```

**Den ekstra levetid er inert.** En for gammel transaktion kan stadig ikke
veksles — `verifyValue` afviser den på stemplet — og cookien ryddes i samme
svar. Det eneste de ekstra minutter køber, er at værdien stadig ANKOMMER, så
du kan svare på hvad der gik galt:

```ts
  if (!flowCookie) {
    return NextResponse.redirect(new URL("/?error=no_login_in_progress", url.origin), 302);
  }
```

```ts
    const aarsag = (await verifyValue(flowCookie, config.cookieSecret)) !== null ? "expired" : "bad_signature";
    console.warn(`[callback] login-cookie afvist: ${aarsag}`);
    const afvist = NextResponse.redirect(new URL("/?error=login_failed", url.origin), 302);
```

Holder signaturen, er det din egen cookie der bare er for gammel. Holder den
ikke, er det slet ikke en cookie du har udstedt. **Den forskel skriver du i din
egen log — browseren får ét svar, `login_failed`, for begge.** Et særskilt
«for gammel» fortæller en fremmed at signaturen holdt mod din nuværende
hemmelighed (helpdesk 22/9, F084.55), og det er valgt fra (Christian 7/10,
`@broberg/sso` 0.12.0). «Ingen cookie» (`no_login_in_progress`) er stadig sit
eget svar: det røber intet om signaturen.

**Det er ikke en teori.** helpdesk ramte det i praksis, og `@broberg/sso`
rettede samme form i sin egen Hono-adapter i 0.3.0 — to konstanter, hvor
cookiens er tre gange serverens.

**Bruger du adapteren, får du det gratis — men FØRST fra 0.3.0.** På en ældre
adapter deler de to det samme tal, og så har du formen her uden at vide det.
Bruger du kernen, er det dit uanset version.

### Hjemturen

```ts
  let resultat;
  try {
    resultat = await sso.completeLogin({
      params: url.searchParams,
      state: flow.state,
      codeVerifier: flow.codeVerifier,
      nonce: flow.nonce,
    });
  } catch (fejl) {
    console.error("[callback] login kunne ikke fuldfoeres:", fejl);
    return NextResponse.redirect(new URL("/?error=login_failed", url.origin), 302);
  }
  const { claims, idToken } = resultat;
```

`completeLogin()` veksler koden OG verificerer id-tokenet mod BID's `/jwks` —
signatur, issuer, audience og nonce. Returnerer den, er identiteten bevist.

**Og den KASTER hvis den ikke er det.** En brugt kode, en udløbet kode, et
nonce der ikke passer, eller et `/jwks` der ikke svarer — alle fire ender samme
sted. Uden hegnet bliver et mislykket login til en **500**, og 500 er præcis
den kode der får nogen til at lede efter fejlen i BID i stedet for i sit eget
login. Fejlteksten logges serverside og vises aldrig: den kan bære koden eller
en del af tokenet, og brugeren kan alligevel ikke bruge den til noget.

**Fra 0.2.3 ER den ene log-linje hele diagnosen.** Beskeden bærer nu status OG
årsag. Begge linjer herunder er målt 21. september 2026 — den første mod en
rigtig BID med en kode der aldrig blev udstedt, den anden mod en mellemmand der
svarer 200 med HTML:

```
token exchange failed (400): invalid_grant — invalid code
token exchange failed (200): the response body is not JSON (content-type: text/html) — <html><body>502 Bad Gateway — nginx</body></html>
```

**Den anden er den et statustjek ALENE ikke fælder.** Status er 200. Noget
andet end BID har svaret — en proxy, en fejlside, et login-vindue foran dit
netværk — og indtil 0.2.3 lignede det en fejl i tokenet: 0.2.2 gav
`Failed to parse JSON` (Bun; på Node `SyntaxError: Unexpected token '<'`), og
den besked sender læseren ind i kryptografien efter en fejl der sidder i
netværket. Nu står der hvad svaret VAR.

**Uddraget er sikkert at logge, og det er målt, ikke antaget:** ét enkelt
linjeskift-frit uddrag, klippet ved 200 tegn, og en `client_secret` serveren
skulle ekko tilbage er skiftet ud med `[redacted client_secret]` — prøvet med
en 400 tegn lang HTML-side der bar hemmeligheden midt i.

Derefter mønter du din EGEN session, nøglet på `sub`:

```ts
  const session = await signSession(
    {
      sub: claims.sub,
      exp: Math.floor(Date.now() / 1000) + config.sessionMaxAge,
      ...(claims.email ? { email: claims.email } : {}),
      ...(claims.name ? { name: claims.name } : {}),
    },
    config.cookieSecret,
  );
```

### Læs sessionen — ét sted

```ts
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, config.cookieSecret);
}
```

`verifySession` returnerer `null` for ENHVER grund cookien ikke kan stoles på:
manipuleret, udløbet, forkert signeret, fraværende. Der er ingen gren hvor en
halvt gyldig session slipper igennem.

### En side der kræver login

```ts
  const session = await getSession();
  if (!session) redirect("/api/auth/login?returnTo=%2Fmine-data");
```

`redirect()` til din egen login-rute, som laver et **fuldt sideskift** til BID.
Aldrig en skjult ramme — se fælde 3.

### Fælde 5 — callback'en ligger på `/api/auth/callback`

Next.js' App Router ejer `app/api/*`. Registrerer du `/auth/callback` og bygger
`/api/auth/callback`, får du `invalid_redirect` **efter** at brugeren har sagt
ja — og fejlen ligner noget du selv har gjort forkert. Adressen matches tegn for
tegn; se fælde 1.

### Prøv den

```bash
cd examples/nextjs-app && bun install     # kun første gang
cd ../.. && bun run scripts/fikstur-nextjs.ts
```

Starter en lokal BID, opretter en bruger, registrerer `nextjs-app` og starter
Next.js-eksemplet. Åbn appen og log ind med den bruger scriptet printer.

---

## 5. Læs brugeren

```ts
  app.get("/", attach, (c) => {
    const session = getSession(c);
    if (!session) {
      return c.html(
        page(
          `<h1>Minimal app</h1><p>Du er ikke logget ind.</p>` +
            `<p><a data-testid="minimal-app-login" href="/auth/login?returnTo=%2Fmine-data">Log ind</a></p>`,
        ),
      );
    }
```

Linket hedder «Log ind», ikke «Log ind med Broberg ID»: det er en offentlig
forside, ikke en login-side, og `/auth/login` er en omdirigering direkte til BID.
Der findes intet at vælge imellem, så der er ingen knap der navngiver et valg.

`session` indeholder `sub`, `exp` og — hvis de kom med — `email` og `name`. Der
er **ingen roller og ingen rettigheder** i den, og det er bevidst: en cookie er
en cache ingen kan gøre ugyldig, og en forældet rolle i en cookie er en tilladelse
der overlever sin egen tilbagekaldelse. Rettigheder slår du op i din egen base
på `sub`.

---

## 5b. Invitationer — spørg BID om adressen, ikke tokenets mail

Din app inviterer stadig selv: den bestemmer HVEM og med hvilken rolle. BID
bestemmer kun hvem personen ER.

Fælden: du inviterer `anne@firma.dk`, men Anne logger ind med en BID-konto hvis
PRIMÆRE adresse er hendes private. Tokenets `email` er så den private, og din
invitation matcher ikke. Spørg i stedet BID, i det øjeblik hun indløser:

```http
POST /api/app/address-ownership
Authorization: Bearer <det access_token appen fik for hende>
Content-Type: application/json

{ "address": "anne@firma.dk" }
```

Svaret har tre udfald, og de betyder hver sin ting:

| `status` | hvad din app gør |
|---|---|
| `verified` | kontoen ejer adressen, bevist → indløs invitationen på tokenets `sub` |
| `unverified` | adressen står på kontoen, men er ikke bekræftet → indløs IKKE; «bekræft adressen i Broberg ID» |
| `not_on_account` | → indløs IKKE; «du er logget ind med en anden konto» |

- **Kun om den konto tokenet tilhører.** Uden gyldigt token svarer ruten `401
  {"error":"invalid_token"}` uanset adressen — den slår den slet ikke op. Den
  kan ikke bruges til at finde ud af hvem der har en konto.
- **Gem ikke svaret.** Det er sandt NU. Spørg ved indløsningen, og nøgl
  medlemskabet på `sub` bagefter — aldrig på adressen. Svaret bærer
  `cache-control: no-store`.
- `unverified` må aldrig behandles som ejet: enhver kan skrive en adresse ind på
  sin egen konto. Det er bekræftelsen der beviser den.

## 5b¼. Konto-side i appen — brugeren retter navn og billede uden at forlade appen (F084.151)

Christian 5/10: det er forstyrrende pludselig at havne i et ID-system. Så appen
viser kontoen selv, og retter navn og billede gennem BID. Alt kaldes fra appens
**server** med brugerens `access_token` fra login:

| kald | kræver scope | gør |
|---|---|---|
| `GET /api/app/profile` | `profile` | `{sub, name, picture, email, account_url}` |
| `POST /api/app/profile` `{"name":"…"}` | `profile:write` | retter navnet (1–120 tegn) |
| `POST /api/app/profile/avatar` (rå bytes) | `profile:write` | nyt billede — max 2 MB, PNG/JPEG/WebP, genkendt på bytes |
| `POST /api/app/profile/avatar/remove` | `profile:write` | fjerner billedet |

**`profile:write` er sit eget scope, med vilje.** `profile` er et LÆSE-scope og
forbliver det. For at rette skal `profile:write` stå i din registrering
(spec'ens `scopes`: `["openid","profile","email","profile:write"]`), og appen
skal bede om det ved login (`scope=openid profile email profile:write`). Beder
en app om det uden at være registreret med det, afviser BID login'et med
`invalid_scope`.

**Kun brugerens EGEN profil.** Hvem der rettes, afgøres af tokenet — der findes
ingen parameter der kan pege på en anden, og et `sub` i kroppen læses aldrig.

**Svarene:** `401 invalid_token` (manglende/udløbet/tilbagekaldt token) ·
`403 insufficient_scope` med `scope` (hvilket der mangler) · `400` med `name_required`,
`name_too_long` eller `name_must_be_a_string` · `413 too_large` · `415 not_an_image`.
Et vellykket kald svarer med profilen læst tilbage fra basen.

**Friskhed:** svaret bærer den nye værdi straks, og `/oauth2/userinfo` viser den
med det samme. Et id_token der allerede er udstedt, bærer den gamle til næste
login eller refresh — læs `GET /api/app/profile` når kontosiden vises.

**Bliver i BID:** mail, adgangskode, adgangsnøgler, tofaktor, sessioner,
telefoner, tilsluttede logins og sletning af kontoen. Link til `account_url` i
en ny fane.

## 5b⅓. Forny adgangen i baggrunden — fornyelses-tokens (F084.156)

Et `access_token` fra BID gælder i **1 time** (`expires_in: 3600`). Uden mere
skal brugeren gennem login igen bagefter (et klik på «Fortsæt som …»).

**Vil appen forny i baggrunden** (fx med `@broberg/sso` 0.9.0's `tokenStore`),
skal den have et `refresh_token`, og det kræver scopet `offline_access`:

1. `offline_access` skal stå i din registrering (spec'ens `scopes`) — bed BID om det.
2. Bed om det ved login: `scope=openid profile email offline_access`.

**En fornyelses-nøgle dør med brugerens login i BID.** Logger hun ud, trykker
«log ud overalt», skifter kode, eller udløber login'et, svarer
`POST /oauth2/token` (grant_type=refresh_token) `400 invalid_grant` — send
hende til login (uden `prompt`). Det gælder OGSÅ for `offline_access`, selvom
OIDC ellers lader den slags overleve et log ud: hos BID betyder log ud log ud.

**Rotation:** hver fornyelse giver en NY nøgle; gem den og smid den gamle væk.
Bruges en gammel nøgle igen (efter et kort vindue), tilbagekaldes hele kæden.

## 5b½. Afviser du en bruger — send hende til BID's side, vis aldrig din egen

Har brugeren et gyldigt Broberg ID, men ingen adgang til DIN app (ikke på din
liste, ikke inviteret), så redirect til:

```
https://id.broberg.ai/no-access?client_id=<dit client_id>
```

BID viser «Ingen adgang til <appens navn>», hvilken konto hun er logget ind med,
at en invitation på en anden adresse kan tilføjes og bekræftes under kontoen, og
en knap til at logge ind med en anden konto. Ingen rå JSON, ingen egen fejlside —
afvisningen ser ens ud i alle apps, ligesom login gør. Siden viser ingen tekst fra
URL'en; navnet kommer fra BID's register.

**Og tjek ikke din liste mod tokenets `email`.** Det er kontoens PRIMÆRE adresse.
Står personen på din liste med en anden adresse hun ejer, så spørg
`/api/app/address-ownership` om hver adresse på listen (afsnit 5b). Målt 30/9: en
app afviste ejeren selv, fordi listen havde hans ene bekræftede adresse og tokenet
hans anden.

## 5c. Flyt dine brugere — og bevis at ALLE er flyttet, før det gamle login slukkes

Den 29/9 2026 stod en redaktør låst ude af CMS: appens gamle login var slukket,
og hun havde endnu intet Broberg ID. Det her er vejen der gør det umuligt.

**Din app får sin egen nøgle til BID** (`bidk_…`), udstedt af broberg-id og
leveret gennem vaulten. Den er IKKE din `client_secret` og IKKE et brugertoken.
Læg den i din servers env, aldrig i browseren.

**1. Hvor langt er vi?** Send HELE din brugerliste:

```http
POST /api/app/migration-status
Authorization: Bearer bidk_…
Content-Type: application/json

{ "emails": ["anne@firma.dk", "bo@firma.dk"] }
```

```json
{ "users": [ { "email": "anne@firma.dk", "state": "ready" },
             { "email": "bo@firma.dk",   "state": "not_invited" } ],
  "counts": { "ready": 1, "invited": 0, "expired": 0, "not_invited": 1 },
  "complete": false }
```

| `state` | betyder | du gør |
|---|---|---|
| `ready` | adressen er BEKRÆFTET på et Broberg ID — din callback kan koble hende | intet |
| `invited` | invitation sendt, ikke indløst endnu (`expiresAt`) | vent |
| `expired` | invitationen udløb ubrugt | invitér igen |
| `not_invited` | ingen konto, ingen invitation fra DIN app | invitér |

**2. Invitér dem der mangler:**

```http
POST /api/app/invitations
Authorization: Bearer bidk_…
Content-Type: application/json

{ "customerName": "Firma A/S", "appUrl": "https://app.example/", 
  "users": [ { "email": "bo@firma.dk", "name": "Bo Berg" } ] }
```

Svaret er pr. adresse: `invited` (med `mailId`) · `already_invited` (en levende
invitation findes — INTET sendt) · `existing` (har allerede et Broberg ID —
intet sendt) · `invalid` (se `problem`) · `too_soon`/`too_many_today`. Kaldet
kan gentages uden at nogen får to mails. BID sender mailen som «Broberg ID»
med kopi til huset. Højst 500 brugere pr. kald.

**3. Spørg igen, og skift FØRST når `complete` er `true`.** Imens står det gamle
login uændret — UDEN en BID-knap ved siden af. Skiftet er én udrulning: /login
bliver en omdirigering til BID, og det gamle slettes. Aldrig begge på samme side.
`complete` er kun sand når hver eneste adresse er `ready`. Replace, prove, THEN
remove — et login der slukkes over én bruger der ikke er flyttet, er en
bruger der står udenfor.

- Nøglen gælder kun DIN app: invitationer fra andre apps tæller ikke i dit svar.
- Forkert, manglende eller tilbagekaldt nøgle → `401 {"error":"invalid_app_key"}`,
  intet slået op og intet sendt.

---

## 6. Log ud

```ts
          `<p><a data-testid="minimal-app-logout" href="/auth/logout">Log ud</a></p>`,
```

**Fra `@broberg/sso` 0.7.0 gør `/auth/logout` det rigtige af sig selv** (components
F084.152, 29/9 2026): appens session og id-token-cookie slettes, og browseren
sendes til `/auth/login?prompt=login` → BID's login-dialog, med «← Tilbage til
<din app>» under, hvis din registrering har `client_uri` (F084.107).

**Christians ordre 29/9:** *«Når jeg logger ud, skal den bare vise BID's dialog
med et link til forsiden under dialogen.»* Log ud i en app er log ud af **appen**,
ikke af BID (D-376ffa). Derfor ikke `/oauth2/end-session`.

- `prompt=login` viser BID's dialog, også når BID-sessionen lever — brugeren
  vælger selv at logge ind igen, i stedet for at ryge lydløst igennem.
- Efter login fjerner BID selv `prompt=login` (F084.108), så der er ingen løkke.
- Face ID starter ikke af sig selv efter et log ud (F084.108).
- Vil brugeren ud af ALT: «Log ud overalt» på `id.broberg.ai/account` → Enheder
  (F084.7, og `logout_everywhere_uri` i din registrering).

Den gamle, federerede adfærd (videre til `/oauth2/end-session`, lukker også
BID-sessionen) fås med `ssoRoutes({ logout: "central" })`. Brug den ikke uden en
grund, der er Christians.

**På kernen uden adapteren** (Trail, cardmem): slet din session, og send til
authorize med `prompt=login` — samme adfærd.

**`session.email_verified`** (0.7.0+): bind kun adgang til en mailadresse, når
feltet er `true`. Mangler det, er adressen ikke bevist.

---

## Når noget fejler — hvad koden betyder, og HVEM der ejer den

**Målt mod produktionen 20. september 2026**, ikke skrevet efter hukommelsen.
Hver linje herunder er et kald der faktisk blev kørt mod `id.broberg.ai`.

Den vigtigste kolonne er den sidste. Ejeren Christian åbnede
`localhost:5174/v1/auth/bid/start`, fik 404 og skrev «der er noget galt» —
ruten fandtes bare ikke endnu, fordi appen var tyve minutter inde i at bygge
den. **Intet var i stykker.** Han kunne ikke se forskel, og det kunne vi heller
ikke uden at måle.

| du ser | betyder | hvem ejer den |
|---|---|---|
| `302` til `/login?...` | **alt virker.** Brugeren skal bare logge ind | — |
| `302` til `id.broberg.ai/error?error=invalid_redirect` | din `redirect_uri` står ikke på klientens liste — tegn for tegn | **appen** (registreringen) |
| `302` til `id.broberg.ai/error?error=invalid_client` | klienten findes ikke, eller er slået fra | **BID** |
| `302` til **DIN callback** med `error=invalid_request`<br>`&error_description=pkce+is+required+for+public+clients` | du sendte intet `code_challenge` | **appen** |
| **404 på din EGEN callback-rute** | **ikke bygget endnu** — ikke i stykker | **appen** |
| **500 på din EGEN callback-rute** | din `completeLogin()` kastede og ingen greb den. Fejlen er ægte (brugt kode, forkert nonce, `/jwks` svarer ikke) — men 500 sender dig hen for at lede i BID | **appen** |
| `503` fra din egen start-rute | dine `BID_*`-miljøvariabler er tomme. Korrekt ship-dark, og derfor usynlig | **appen** |
| «Missing required client credentials» fra token-endepunktet | klienten er registreret som confidential, men dit bibliotek sender ingen hemmelighed — kræver `@broberg/sso` 0.2.0+ | **appen** |
| «The client is not allowed to initiate logout» | `enableEndSession` mangler på rækken | **BID** |
| `no_login_in_progress` fra **adapterens** `/auth/callback` | der kom ingen flow-cookie. Hun har ikke startet et login her — eller browseren har smidt cookien væk for længst | **appen** |
| `login_failed` (400, fra `@broberg/sso` 0.12.0) | cookien kom, men holder ikke — enten for gammel (hun var for længe undervejs) eller ikke en cookie I har udstedt. **Browseren får med vilje ét svar for begge**; bed hende logge ind igen. Årsagen står i jeres log (`onCallbackRefused(cause, c)` eller `[@broberg/sso] /callback refused: <cause>`). Til og med 0.11.0 hed de to `login_expired` og `bad_login_cookie` — et særskilt «for gammel» fortalte en fremmed at signaturen holdt (F084.55), så det er valgt fra (Christian 7/10). `callbackErrors: "granular"` findes, men lad være | **appen** |

### De to fælder i tabellen

**`invalid_redirect` vises på BID, `invalid_request` vises hos DIG.** Det er
ikke en inkonsekvens: en redirect-adresse vi ikke genkender kan vi ikke sende
noget tilbage til — dét er hele pointen med hvidlisten. En PKCE-fejl derimod
kommer på en adresse vi godt kender, så fejlen leveres hjem til appen. Så leder
du efter en fejl du ikke kan finde på BID, så se efter den i dine egne logs.

**En grøn udrulning og en lukket dør ser ens ud udefra.** `503`-linjen er
HelpDesks egen erfaring, ordret: deres ruter var bygget, prøvet og committet —
men `BID_ISSUER`/`BID_CLIENT_ID`/`BID_REDIRECT_URI` var aldrig sat nogen steder.

**BID's fejlside er bibliotekets egen: engelsk og ustylet.** Samme flade som
logout-bekræftelsen nedenfor, og samme grund — vi har ikke overtaget den endnu.
Det er kosmetik, ikke en fejl: koden og beskrivelsen i URL'en er de rigtige.

---

## Hvad vejledningen IKKE dækker

En vejledning der kun siger hvad der virker, læser som en garanti. Her er det
den ikke dækker (gennemgået 2. oktober 2026; log ud står i afsnit 6):

### Tokenets `email` er kontoens PRIMÆRE adresse

En konto kan eje flere bekræftede adresser. Tokenet bærer kun den primære, og
BID viser ikke en kontos øvrige adresser. Det du KAN, er at spørge om en adresse
du allerede kender: `POST /api/app/address-ownership` svarer `verified`,
`unverified` eller `not_on_account` (afsnit 5b, F084.38). Inviterer du folk på mail,
eller har du en liste over tilladte adresser, så tjek dem dér — aldrig mod
tokenets `email`. Det du ikke kan, er at finde en bruger hvis adresse i din app
er en du ikke kender og ikke er hendes primære i BID.

### Der er ingen Next.js-ADAPTER — men Next.js er dækket

`@broberg/sso` har en kerne (framework-fri) og en Hono-adapter. En
Next.js-adapter er ikke bygget (F084.5), og du behøver den ikke: afsnit 4b
herover viser hele koblingen på kernen, kopieret ud af [`examples/nextjs-app/`](https://github.com/broberg-ai/bid-docs/tree/main/examples/nextjs-app)
som er bevist i en browser. Prisen er ~40 linjer i dine egne ruter i stedet for
tre.

### Der er ingen nøddør hvis BID er nede

BID er et enkelt fejlpunkt for hele flåden: er den nede, kan ingen logge ind
nogen steder samtidig. Der findes i dag **ingen reservevej**. Det er en kendt,
åben risiko og ikke noget din app kan løse alene. Har du en konsol hvor
driftsfolk skal kunne komme ind mens BID er nede, så sig det højt inden du
migrerer.

### `@broberg/auth` er det du migrerer FRA

Den gamle vej var at hver app kørte sin egen Better Auth. Det er ikke et
alternativ til BID — det er den tilstand BID findes for at afløse. Migrering af
eksisterende brugere er et selvstændigt problem (F084.26), ikke en del af den
her vejledning.

---

## Prøv det selv

```bash
cd examples/minimal-app && bun install     # kun første gang
cd ../.. && bun run scripts/fikstur-app.ts
```

Det starter en lokal BID på `http://localhost:50993`, opretter en bruger,
registrerer `minimal-app` og starter eksemplet på `http://localhost:8123`.
Åbn appen, klik **Log ind**, og log ind med den bruger scriptet
printer.
