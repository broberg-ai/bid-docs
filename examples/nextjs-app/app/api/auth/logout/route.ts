/**
 * LOG UD — begge steder, i den rigtige rækkefølge.
 *
 * Vores egen cookie ryddes FØRST, og derefter sendes browseren til BID's
 * /oauth2/end-session. Gøres det omvendt, og brugeren lukker fanen undervejs,
 * er hun logget ud af BID og stadig logget ind hos os.
 */
import { NextResponse } from "next/server";
import { cookieHeader } from "@broberg/sso";
import { sso, config, SESSION_COOKIE, secureCookies } from "@/lib/sso";

export async function GET(request: Request) {
  const idToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("bid_id_token="))
    ?.slice("bid_id_token=".length);

  // MED id_token_hint slipper brugeren for bekræftelsessiden. Uden den SKAL
  // udstederen spørge — det er ikke en indstilling, det er specifikationen.
  const url = await sso.logoutUrl({
    ...(idToken ? { idTokenHint: idToken } : {}),
    ...(config.postLogoutRedirectUri ? { postLogoutRedirectUri: config.postLogoutRedirectUri } : {}),
  });

  const res = NextResponse.redirect(url, 302);
  for (const navn of [SESSION_COOKIE, "bid_id_token"]) {
    res.headers.append(
      "set-cookie",
      cookieHeader(navn, "", { maxAge: 0, secure: secureCookies, sameSite: "Lax", path: "/" }),
    );
  }
  return res;
}
