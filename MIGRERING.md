# Fra dit eget login til Broberg ID — migreringsguiden

Til den der skal flytte en app, der i dag har sit EGET login (NextAuth med
magic-link eller GitHub, en adgangskode, `@broberg/auth`), over på Broberg ID
(BID). Guiden er rækkefølgen og beslutningerne. Selve ledningen — pakke, miljø,
ruter — står i vejledningen <https://id.broberg.ai/docs>, og der henvises dertil
i stedet for at gentage den.

> **Er du en AI-assistent?** Læs denne fil fra ende til anden FØR du skriver
> kode. Det der koster mest her, er ikke koden — det er rækkefølgen.

---

## 0. Reglen du migrerer hen imod

**Én login-dialog: BID's. Din app har ingen egen.**

- **Appen viser ALDRIG en login-side. /login er en omdirigering direkte til BID — ingen side, ingen knap, intet «Log ind med Broberg ID».**
- Ingen egen formular: ingen adgangskode, ingen adgangsnøgle, intet
  GitHub/Google, intet login-link.
- **BID som én af flere login-muligheder er IKKE optagelse.** En
  NextAuth-provider ved siden af magic-link er stadig to logins.
- **Aldrig begge på samme side.** Se afsnit 3.

Det er en betingelse, ikke en anbefaling (Christian 28/9 og 2/10 2026). To apps
har allerede bygget den forkerte udgave — cronjobs (BID som ekstra provider ved
siden af magic-link) og Contracts (egen login-side med en BID-knap ved siden af
magic-link og GitHub). Begge læste en tidligere udgave af reglen, der tillod
det. Den udgave er væk; byg ikke efter den, heller ikke hvis du finder den i en
gammel plan (fx CMS' implementeringsplan fra 22/9, trin 4 «knap ved siden af»).

---

## 1. Før du starter — skriv appens nuværende login ned

Lav en kort opgørelse i dit kort/plan-doc, FØR du rører koden. Den bliver din
tjekliste i afsnit 6.

| spørgsmål | hvorfor det betyder noget |
|---|---|
| Hvilke login-veje findes? (kode, magic-link, GitHub, Google, API-nøgler …) | ALLE menneske-veje slettes i skiftet. Maskin-konti (service-tokens, Lens) røres ikke — BID logger mennesker ind |
| Hvor bor brugerne? (tabel, `team.json`, en allowlist i env) | det er listen du sender til migration-status (afsnit 5) |
| Hvad nøgler dine data på i dag? (eget bruger-id, mail) | efter skiftet er identiteten BID's `sub`. Din bruger-række bliver; den får et `sub` knyttet på |
| Hvor slås roller op? | tokenet bærer INGEN roller. BID afgør HVEM, din app afgør HVAD |
| Hvilken af dine flader kan bære en callback? | en SERVER. Aldrig et statisk browser-bundt (vejledningens afsnit 1) |
| Er der en konsol driftsfolk skal ind i, hvis BID er nede? | der findes ingen nøddør. Sig det højt FØR du migrerer |

**`sub` er det eneste stabile.** Kopiér aldrig mail eller navn ind som nøgle.
Et menneske kan eje flere adresser hos BID og skifte sin primære.

---

## 2. Registrér appen

Ikke selvbetjening. Udfyld skemaet i `docs/OPTAG-APP.md` (eller
<https://id.broberg.ai/docs>) og send det til broberg-id-sessionen.

- **`redirect_uris`**: din rigtige callback + en `localhost`. Matches tegn for
  tegn; én efterstillet skråstreg er en anden adresse. Er du på Next.js App
  Router, ligger callback'en typisk under `/api/auth/callback` — registrér den
  sti du faktisk bygger (vejledningens fælde 5).
- **`post_logout_redirect_uris`**: din forside, begge skrivemåder.
- **`client_uri`**: din forside — BID viser «← Tilbage til <navn>» under dialogen.
- **`logout_everywhere_uri`** (valgfri): uden den rammer «Log ud overalt» ikke
  din egen session.
- **Skifter appen domæne undervejs**, så bed om de nye adresser OVENI de gamle.
  Fjern de gamle først når ingen bruger dem.

Bed samtidig om **appens nøgle** (`bidk_…`) til migration-status og
invitationer. Den udstedes på BID-maskinen (`bun src/app-key-cli.ts issue
<client_id>`) og leveres gennem vaulten. Den er IKKE din `client_secret` og IKKE
et brugertoken — læg den i serverens env, aldrig i browseren.

---

## 3. Overgangen — aldrig begge på samme side

**Aldrig begge på samme side.** Overgangen har tre tilstande, og der findes ingen
fjerde:

| | hvad brugeren ser | hvad der findes i koden |
|---|---|---|
| **A. før** | det gamle login, **UÆNDRET** — ingen BID-knap, intet link til BID | det gamle login + BID-ruterne (start, callback), **linket ingen steder fra** |
| **B. skiftet** (én udrulning) | `/login` er en 302 direkte til BID | BID-ruterne. Det gamle logins kode er slettet |
| **C. oprydning** (senere udrulning) | uændret fra B | gamle tabeller/kolonner fjernes — se afsnit 7 |

I tilstand A beviser du BID-vejen ved at åbne din start-rute **direkte**
(`/auth/login` med adapteren, eller din egen start-rute på kernen) og logge ind
med en rigtig BID-konto. Ingen bruger kan finde ruten, og intet på din forside
peger på den.

**Hvorfor ikke en knap «i overgangen»?** Fordi overgangen kan vare uger, og en
side med to login-veje i uger ER en app med sin egen login-side. Det er præcis
den form reglen forbyder — og den form begge tidligere apps endte i.

### Byg BID-vejen (tilstand A)

Følg vejledningen: afsnit 2–4 (Hono-adapteren, mindst `0.3.0`) eller afsnit 4b
(Next.js på kernen, mindst `0.2.3`; brug den nyeste — `0.8.0` er den Contracts
byggede på). De fælder der rammer en migrering hårdest:

- **Fuldt sideskift, aldrig en ramme.** Også ved `prompt=none`.
- **Flow-cookien dateres på signaturen** (`maxAgeSeconds` i BÅDE `signValue` og
  `verifyValue`), og cookien lever længere end vinduet (fx 600 s / 1800 s).
- **`completeLogin()` i try/catch → redirect med en navngivet årsag**, aldrig en
  500.
- **`returnTo` valideres med URL-parseren, to gange**, ikke med en tegn-liste.
- **Din egen session efter login er din sag.** Du må mønte pakkens
  `signSession` eller din eksisterende session (fx NextAuth's JWT-cookie) — så
  længe den først udstedes EFTER `completeLogin()` har bevist identiteten.
- **Person- eller helbredsdata:** `SSO_SESSION_MAX_AGE=43200` (12 timer).

---

## 4. Kobl de eksisterende brugere

Første gang et `sub` logger ind, skal din app finde ud af hvilken af DINE
brugere det er. Det sker på en mailadresse, og kun på en adresse der er
**bekræftet i BEGGE ender**: din app har den, og BID siger at kontoen ejer den.

**Brug `POST /api/app/address-ownership`, aldrig tokenets `email` alene.**
Tokenets `email` er kontoens PRIMÆRE adresse; personen kan stå hos dig med en
anden adresse hun også ejer.

```http
POST https://id.broberg.ai/api/app/address-ownership
Authorization: Bearer <det access_token din app fik for hende>
Content-Type: application/json

{ "address": "anne@firma.dk" }
```

| `status` | gør |
|---|---|
| `verified` | kobl: gem `sub` → din bruger-række |
| `unverified` | kobl IKKE. Hun skal bekræfte adressen i Broberg ID |
| `not_on_account` | kobl IKKE. Send til `https://id.broberg.ai/no-access?client_id=<dit id>` |

Mønsteret (Contracts F008.1, gennemset af broberg-id 2/10):

1. **Kendt `sub`** → din bruger. **Men tjek at personen STADIG har adgang** —
   står adgangen på en liste (fx `ADMIN_EMAILS`), så tjek at den adresse der
   blev koblet, stadig er på listen. Ellers giver én tidligere kobling adgang
   for altid, også efter du har fjernet personen.
2. **Ukendt `sub`** → spørg address-ownership om kandidat-adresserne. Er listen
   lille (admins, et team), så spørg om hver. Er det en stor brugertabel, så er
   tokenets `email` kandidaten — og address-ownership beviset.
3. Første `verified` → gem koblingen `sub` → bruger (din eksisterende række
   beholder alle sine data). Ingen → `no-access`.
4. **Gem ikke svaret som en tilladelse.** Koblingen `sub` → bruger er identitet;
   adgang slår du op hver gang.

**Alt i try/catch.** address-ownership kaster hvis BID ikke giver et af de tre
svar — det er med vilje, et uklart svar må aldrig blive til «ikke din».
Redirect med en navngivet årsag, aldrig en 500.

---

## 5. Porten: migration-status

Før skiftet skal HVER bruger have et Broberg ID med sin adresse bekræftet.
Ellers står de udenfor den dag `/login` peger på BID — det skete for en
redaktør i CMS den 29/9 2026.

**1. Hvor langt er vi?** Send hele din brugerliste:

```http
POST https://id.broberg.ai/api/app/migration-status
Authorization: Bearer bidk_…
Content-Type: application/json

{ "emails": ["anne@firma.dk", "bo@firma.dk"] }
```

Svaret har `users[]` (pr. adresse en `state`), `counts` og `complete`.

| `state` | gør |
|---|---|
| `ready` | intet — adressen er bekræftet på et Broberg ID |
| `invited` | vent (`expiresAt` siger hvornår invitationen udløber) |
| `expired` | invitér igen |
| `not_invited` | invitér |

**2. Invitér dem der mangler** — samme nøgle:

```http
POST https://id.broberg.ai/api/app/invitations
Authorization: Bearer bidk_…
Content-Type: application/json

{ "customerName": "Firma A/S", "appUrl": "https://app.example/",
  "users": [ { "email": "bo@firma.dk", "name": "Bo Berg" } ] }
```

- `appUrl` skal ligge på et af appens **registrerede** domæner, ellers afvises
  adressen som `invalid`.
- Svaret er pr. adresse: `invited` · `already_invited` · `existing` (har
  allerede et Broberg ID — intet sendt) · `invalid` · `too_soon` /
  `too_many_today`. Kaldet kan gentages uden at nogen får to mails. Højst 500
  pr. kald.

**3. Skift FØRST når `complete` er `true`.** Den er kun sand når HVER adresse er
`ready` (og listen ikke er tom). Imens står det gamle login uændret.

---

## 6. Skiftet — ÉN udrulning

Én commit, én udrulning, der gør begge ting:

1. **`/login` bliver en 302 til BID** — og det samme gør enhver side der kræver
   login. Ingen side renderes, ingen knap.
2. **Det gamle logins KODE slettes**: formularen, magic-link-ruterne,
   GitHub/Google-providerne, kodeords-tjekket. Gennemgå opgørelsen fra afsnit 1
   punkt for punkt.

Behold i denne udrulning det gamle logins **data** (tabeller, kolonner med
kodeords-hashes, magic-link-tokens). De fjernes i afsnit 7, når skiftet har
holdt. Det er det der gør skiftet reversibelt (afsnit 8).

**Log ud** er log ud af APPEN: slet din session og send til BID's dialog med
`prompt=login` (adapteren `0.7.0`+ gør det selv). Ikke `/oauth2/end-session` —
den logger også ud af BID.

**Bevis efter udrulningen**, i drift:

- `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<app>/login`
  → `302` til `https://id.broberg.ai/oauth2/authorize?…` (eller din start-rute,
  der selv 302'er dertil).
- De gamle ruter (`/api/auth/signin/github`, magic-link-ruten …) svarer 404.
- En rigtig bruger logger ind gennem BID og lander med sine egne data —
  bevist i en browser (Lens), ikke kun med curl.
- En person der ikke har adgang, lander på BID's `no-access`-side.

---

## 7. Oprydning — en separat, senere udrulning

Når skiftet har kørt en uge uden at nogen er stået udenfor: fjern de gamle
tabeller og kolonner. **En migrering med `DROP` er en envejsdør og kræver
Christians egne ord** — den rulles ikke tilbage af en ny udrulning.

Fjern også de gamle miljøvariabler (GitHub-hemmeligheder, mail-afsender til
magic-link) og de registreringer der hører til (fx GitHub OAuth-appen).

---

## 8. Rul tilbage

Går skiftet galt, så kør den forrige udgave igen. På Fly findes ingen
`releases rollback`; man redeployer det forrige image:

```bash
flyctl releases --app <app> --image        # find det forrige images reference
flyctl deploy --app <app> --image registry.fly.io/<app>:deployment-<ID>
```

Det virker KUN fordi skiftet ikke rørte data (afsnit 6). Det forrige image
kører det gamle login mod de tabeller der stadig står. **Rul tilbage bringer
ikke data tilbage**: er en tabel droppet eller en kolonne omdøbt, kører den
gamle kode mod et skema den ikke passer til. Derfor er oprydningen en separat
udrulning.

Koblinger (`sub` → bruger) skrevet efter skiftet bliver liggende og skader
ikke; de bruges igen ved næste skift.

---

## 9. Kendte fælder fra tidligere migreringer

| fælde | hvor den kom fra | hvad du gør |
|---|---|---|
| BID som ekstra provider ved siden af det gamle | cronjobs (F084.123) | det er to logins. BID er den eneste vej ind |
| egen login-side med en BID-knap «i overgangen» | Contracts (F084.140) | tilstand A har INGEN BID-knap; `/login` bliver en 302 |
| en kobling giver adgang for altid | Contracts' første udkast (2/10) | kendt `sub` → tjek stadig adgangen |
| tokenets `email` brugt til at matche | flere apps; en afviste ejeren selv (30/9) | address-ownership |
| det gamle login slukket før alle havde et Broberg ID | CMS (29/9) | migration-status `complete: true` først |
| callback-stien én skråstreg forkert | vejledningens fælde 1 | `invalid_redirect` EFTER brugeren har sagt ja — prøv i tilstand A |
| Next.js-callback under `/api/auth/` men registreret uden | vejledningens fælde 5 | registrér den sti du bygger |
| miljøvariablerne aldrig sat i drift | HelpDesk | en tom `BID_ISSUER` giver 503 fra din start-rute; tjek før skiftet |
| login i en skjult ramme | vejledningens fælde 3 | virker på en Mac, fejler på hver iPhone |
| ingen nøddør | CMS (22/9) | er BID nede, kan ingen logge ind PÅ NY. De allerede indloggede arbejder videre |

---

## Tjekliste

Kopiér den ind i dit kort og kryds af med bevis.

- [ ] Opgørelsen fra afsnit 1 står i plan-doc'en (veje, brugerliste, roller, callback-flade)
- [ ] Appen er registreret; redirect, post-logout og `client_uri` læst tilbage fra BID
- [ ] App-nøglen `bidk_…` ligger i serverens env (og i vaulten)
- [ ] BID-ruterne findes og er linket **ingen steder fra**; det gamle login er uændret
- [ ] Et rigtigt login gennem BID-ruten virker i drift (tilstand A), åbnet direkte
- [ ] Kendt `sub` tjekker stadig adgangen; ukendt `sub` kobles kun via address-ownership `verified`
- [ ] Afviste brugere sendes til `no-access`; ingen 500 i callback'en
- [ ] `migration-status` svarer `complete: true` for HELE brugerlisten
- [ ] Skiftet: `/login` → 302 til BID og det gamle logins kode slettet — i ÉN udrulning
- [ ] Efter skiftet: curl af `/login`, gamle ruter 404, et browser-login (Lens), en `no-access`
- [ ] Det forrige image-id er skrevet ned (rul tilbage)
- [ ] Oprydning af data: separat udrulning, med Christians ord hvis den indeholder `DROP`
