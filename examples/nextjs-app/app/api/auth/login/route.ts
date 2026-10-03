/**
 * START ET LOGIN.
 *
 * `beginLogin()` bygger authorize-adressen OG giver de tre engangsværdier
 * tilbage. De skal overleve turen til BID og hjem igen, og de må ikke kunne
 * ændres undervejs — derfor en SIGNERET cookie frem for en server-side Map.
 *
 * En Map ville dø ved hver udrulning: hvert push genstarter processen, og så
 * fejler ethvert login der var i gang, med en besked der ikke navngiver
 * årsagen. Cookien overlever, fordi den ligger i browseren.
 */
import { NextResponse } from "next/server";
import { signValue, cookieHeader } from "@broberg/sso";
import { sso, config, FLOW_COOKIE, FLOW_MAX_AGE, FLOW_COOKIE_MAX_AGE, secureCookies } from "@/lib/sso";

export async function GET(request: Request) {
  const start = await sso.beginLogin();

  // returnTo kommer fra en URL og er dermed skrevet af hvem som helst der kan
  // få nogen til at klikke. Den valideres i /callback — se kommentaren dér.
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/mine-data";

  const flow = await signValue(
    JSON.stringify({
      state: start.state,
      codeVerifier: start.codeVerifier,
      nonce: start.nonce,
      returnTo,
    }),
    config.cookieSecret,
    // STEMPLET LIGGER INDE I SIGNATUREN (@broberg/sso 0.2.3+). Cookiens
    // Max-Age er BROWSERENS løfte om hvornår den holder op med at gælde — og
    // en klient kan lade være med at give det løfte. Uden stempel tager
    // serveren imod en korrekt signeret flow-værdi for evigt.
    { maxAgeSeconds: FLOW_MAX_AGE },
  );

  // FULDT SIDESKIFT, aldrig en skjult ramme. Safari har blokeret
  // tredjepartskontekst i årevis, så en ramme virker i Chrome på en Mac og
  // fejler for hver eneste bruger på iPhone.
  const res = NextResponse.redirect(start.url, 302);
  res.headers.append(
    "set-cookie",
    cookieHeader(FLOW_COOKIE, flow, { maxAge: FLOW_COOKIE_MAX_AGE, secure: secureCookies, sameSite: "Lax", path: "/" }),
  );
  return res;
}
