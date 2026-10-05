# Broberg ID — vejledninger og eksempler

> **Automatisk kopi — redigér ikke her.** Alt i dette repo genereres fra
> Broberg ID's eget (private) repo ved hver ændring. Rettelser foreslås til
> Broberg ID, ikke som pull requests her. Kopieret fra `broberg-id@634e76b`.

| | |
|---|---|
| **Kobl en app på Broberg ID** | [BRUG-BID.md](BRUG-BID.md) · læses bedst på <https://id.broberg.ai/docs> |
| **Flyt en app fra sit eget login** | [MIGRERING.md](MIGRERING.md) · <https://id.broberg.ai/docs/migrering> |
| **Til AI-assistenter** | <https://id.broberg.ai/llms.txt> · <https://id.broberg.ai/llms-migrering.txt> |
| **Eksempel: Hono (Bun)** | [examples/minimal-app](examples/minimal-app) |
| **Eksempel: Next.js** | [examples/nextjs-app](examples/nextjs-app) |

Eksemplerne er de apps vejledningen er skrevet ud fra. Klientpakken er
[`@broberg/sso`](https://www.npmjs.com/package/@broberg/sso).

Scripts eksemplerne nævner (fx `scripts/fikstur-*.ts`) starter en lokal Broberg ID
og findes kun i det private repo. Mod en rigtig Broberg ID skal din app være
registreret som klient — se afsnittet «Registrér appen» i vejledningen.
