/**
 * MODTAGEREN — en tjeneste tager imod BID-billetter og tjekker dem LOKALT mod
 * BID's offentlige nøgler. Samme mønster som discovery.broberg.ai bruger.
 */
import { createTicketVerifier, JwksUnavailableError, SsoError } from "@broberg/sso";

const verifier = createTicketVerifier({
  issuer: "https://id.broberg.ai",
  audience: "https://discovery.broberg.ai",
});

export async function modtag(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response("billet mangler", { status: 401 });
  try {
    const { principal, scopes } = await verifier.verify(auth.slice(7), { scope: "discovery:read" });
    return Response.json({ hvem: principal, scopes });
  } catch (err) {
    // BID et øjeblik væk OG en ukendt nøgle: prøv igen, afvis ikke kalderen.
    if (err instanceof JwksUnavailableError) return new Response("prøv igen", { status: 503 });
    if (err instanceof SsoError) return new Response("billet afvist", { status: 401 });
    throw err;
  }
}
