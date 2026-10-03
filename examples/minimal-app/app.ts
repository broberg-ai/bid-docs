/**
 * THE MINIMAL APP — an app that had never been connected to Broberg ID, and
 * now is. It exists so `docs/BRUG-BID.md` can be COPIED out of running code
 * instead of written from memory (F084.25 AC#1, AC#2).
 *
 * ── WHY IT HAS NO DESIGN ──────────────────────────────────────────────────
 *
 * There is deliberately no stylesheet, no component library and no build step
 * here. This is not a product surface and must not be read as one: the house
 * rule that every screen is Stack A (Next.js) or Stack B (Vite+Preact) still
 * holds for YOUR app. What is worth copying out of this file is the four
 * routes and the twelve lines that wire them — anything more would invite
 * someone to copy a layout too, and this layout is not one we would ship.
 *
 * ── AND WHY IT HAS ITS OWN package.json ───────────────────────────────────
 *
 * BID is the ISSUER. `@broberg/sso` is the CLIENT. They are opposite ends of
 * one wire, and the identity service must never quietly grow a dependency on
 * the library its consumers use — so the example installs the package for
 * itself, which is also exactly what a real app does on its first day.
 */
import { Hono } from "hono";
import { getSession, ssoRoutes } from "@broberg/sso/hono";

/**
 * THE APP'S OWN DATA, keyed on BID's `sub` and nothing else.
 *
 * A Map here because the point is the KEY, not the storage. In a real app this
 * is a table — and the column that joins it to a person is still `sub`.
 *
 * What is NOT in here is the part worth noticing: no email address, no name.
 * Both arrive on every login and both can change (BID lets a person own many
 * addresses and promote any of them). Copy one into your own table and you now
 * hold a second opinion about who somebody is, which nothing will ever tell
 * you has gone stale.
 */
const notesBySubject = new Map<string, string>();

const page = (body: string) =>
  `<!doctype html><html lang="da"><head><meta charset="utf-8">` +
  `<title>Minimal app</title></head><body data-testid="minimal-app-root">${body}</body></html>`;

export function createApp() {
  // ssoRoutes() reads its configuration from the environment — see BRUG-BID.md.
  // It hands back three things: the routes to mount, and two middlewares.
  const { app: authRoutes, attach, require: requireLogin } = ssoRoutes();

  const app = new Hono();

  // /auth/login, /auth/callback and /auth/logout. The path prefix must match
  // what you registered: SSO_REDIRECT_URI ends in /auth/callback.
  app.route("/auth", authRoutes);

  // `attach` reads the session if there is one and never redirects — the right
  // middleware for a page that is public but says hello when it can.
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
    return c.html(
      page(
        `<h1>Minimal app</h1>` +
          `<p data-testid="minimal-app-greeting">Logget ind som ${session.name ?? session.sub}</p>` +
          `<p><a data-testid="minimal-app-mydata" href="/mine-data">Mine data</a></p>` +
          `<p><a data-testid="minimal-app-logout" href="/auth/logout">Log ud</a></p>`,
      ),
    );
  });

  // `require` sends a user who is not logged in to BID and back to THIS page.
  // A FULL page redirect — never a hidden frame. Safari has blocked
  // third-party context for years, so the frame version works on your Mac and
  // fails for every user on an iPhone.
  app.get("/mine-data", requireLogin, (c) => {
    const session = getSession(c)!;
    const note = notesBySubject.get(session.sub) ?? "";
    return c.html(
      page(
        `<h1>Mine data</h1>` +
          // The id is what the app stores against. It is shown here because it
          // is the whole point of the page, not because a real app would.
          `<p data-testid="minimal-app-subject">${session.sub}</p>` +
          `<form method="post" action="/mine-data">` +
          `<input data-testid="minimal-app-note" name="note" value="${note.replace(/"/g, "&quot;")}">` +
          `<button data-testid="minimal-app-save" type="submit">Gem</button>` +
          `</form>` +
          `<p><a data-testid="minimal-app-home" href="/">Forside</a></p>`,
      ),
    );
  });

  app.post("/mine-data", requireLogin, async (c) => {
    const session = getSession(c)!;
    const form = await c.req.formData();
    notesBySubject.set(session.sub, String(form.get("note") ?? ""));
    // Redirect after save, so what the next page shows is what was STORED —
    // not what the form just sent. A page that echoes its own input cannot
    // tell a successful save from a silent no-op.
    return c.redirect("/mine-data", 302);
  });

  return app;
}
