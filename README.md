# BID — vejledninger og eksempler

> **Automatisk kopi — redigér ikke her.** Alt i dette repo genereres fra
> BID's eget (private) repo ved hver ændring. Rettelser foreslås til
> BID, ikke som pull requests her. Kopieret fra `broberg-id@ce6e348`.

| | |
|---|---|
| **Kobl en app på BID** | [BRUG-BID.md](BRUG-BID.md) · læses bedst på <https://id.broberg.ai/docs> |
| **Flyt en app fra sit eget login** | [MIGRERING.md](MIGRERING.md) · <https://id.broberg.ai/docs/migrering> |
| **Tal med en anden tjeneste uden nøgle (BID-billetter)** | [BILLETTER.md](BILLETTER.md) · eksempel i [examples/billet](examples/billet) |
| **Til AI-assistenter** | <https://id.broberg.ai/llms.txt> · <https://id.broberg.ai/llms-migrering.txt> |
| **Eksempel: Hono (Bun)** | [examples/minimal-app](examples/minimal-app) |
| **Eksempel: Next.js** | [examples/nextjs-app](examples/nextjs-app) |

Eksemplerne er de apps vejledningen er skrevet ud fra. Klientpakken er
[`@broberg/sso`](https://www.npmjs.com/package/@broberg/sso).

Scripts eksemplerne nævner (fx `scripts/fikstur-*.ts`) starter en lokal BID
og findes kun i det private repo. Mod en rigtig BID skal din app være
registreret som klient — se afsnittet «Registrér appen» i vejledningen.
