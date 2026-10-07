/**
 * HJEMTUREN FRA BROBERG ID.
 *
 * `completeLogin()` veksler koden til tokens OG verificerer id-tokenet mod
 * BID's /jwks — signatur, issuer, audience og nonce. Returnerer den, er
 * identiteten bevist; kaster den, er der ikke noget at logge ind på.
 */
import { NextResponse } from "next/server";
import { verifyValue, signSession, cookieHeader } from "@broberg/sso";
import { sso, config, FLOW_COOKIE, FLOW_MAX_AGE, SESSION_COOKIE, secureCookies } from "@/lib/sso";

/**
 * `returnTo` ER EN ADRESSE EN FREMMED MÅ SKRIVE.
 *
 * Lad browserens EGEN parser afgøre det, to gange, frem for at liste farlige
 * tegn. En tegn-liste er altid ét trick bagud: `//evil.dk` blev lukket, og så
 * slap `/\evil.dk` igennem — en omvendt skråstreg er ikke en sti-adskiller
 * for RFC 3986 og ER det for den parser browsere faktisk bruger.
 *
 * To gange, fordi `..` normaliserer en sti til noget protokol-relativt: en
 * enkelt kontrol lukker skråstregen og lækker på `/..//evil.dk`.
 */
function sikkerReturnTo(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  const maalestok = "https://maalestok.invalid";
  try {
    const en = new URL(raw, maalestok);
    if (en.origin !== maalestok) return fallback;
    const normaliseret = en.pathname + en.search + en.hash;
    const to = new URL(normaliseret, maalestok);
    if (to.origin !== maalestok) return fallback;
    if (!normaliseret.startsWith("/") || normaliseret.startsWith("//")) return fallback;
    return normaliseret;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = request.headers.get("cookie");
  const flowCookie = raw
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${FLOW_COOKIE}=`))
    ?.slice(FLOW_COOKIE.length + 1);

  // INGEN COOKIE ANKOM. Hun har ikke startet et login her — eller cookien er
  // ældre end FLOW_COOKIE_MAX_AGE og browseren har smidt den væk for længst.
  if (!flowCookie) {
    return NextResponse.redirect(new URL("/?error=no_login_in_progress", url.origin), 302);
  }

  // SAMME GRÆNSE I BEGGE ENDER. Står den kun på signaturen, er den et løfte
  // ingen kontrollerer; står den kun her, findes der intet stempel at måle.
  const flowJson = await verifyValue(flowCookie, config.cookieSecret, {
    maxAgeSeconds: FLOW_MAX_AGE,
  });
  if (!flowJson) {
    // DEN ANKOM, men holder ikke. Browseren får ÉT svar, uanset om den er
    // for gammel eller slet ikke vores (@broberg/sso 0.12.0, Christian 7/10).
    // Et særskilt «for gammel» fortalte en fremmed at en fundet cookies
    // signatur holdt mod den nuværende hemmelighed (helpdesk 22/9, F084.55).
    // ÅRSAGEN går kun i serverens log — dér hjælper den driften, og dér kan
    // ingen udefra læse den.
    //
    // Cookien lever stadig længere end vinduet: en cookie browseren har smidt
    // væk ankommer aldrig, og så stod vi tilbage med «intet login i gang» på
    // et login der faktisk var i gang.
    const aarsag = (await verifyValue(flowCookie, config.cookieSecret)) !== null ? "expired" : "bad_signature";
    console.warn(`[callback] login-cookie afvist: ${aarsag}`);
    const afvist = NextResponse.redirect(new URL("/?error=login_failed", url.origin), 302);
    // RYD DEN. Cookien lever tre gange længere end vinduet, netop så den når
    // frem og kan navngives — men når den ér navngivet, er den færdig. Lader
    // man den ligge, svarer hvert eneste forsøg de næste tyve minutter det
    // samme, og brugeren kan ikke komme videre ved at prøve igen.
    afvist.headers.append(
      "set-cookie",
      cookieHeader(FLOW_COOKIE, "", { maxAge: 0, secure: secureCookies, sameSite: "Lax", path: "/" }),
    );
    return afvist;
  }
  const flow = JSON.parse(flowJson) as {
    state: string;
    codeVerifier: string;
    nonce: string;
    returnTo?: string;
  };

  // `completeLogin()` KASTER naar noget ikke stemmer: en brugt kode, en
  // udloebet kode, et nonce der ikke passer, eller /jwks der ikke svarer.
  // Uden dette hegn bliver et mislykket login en 500 med et stakspor — og
  // 500 er praecis den kode der faar nogen til at lede efter fejlen i BID.
  let resultat;
  try {
    resultat = await sso.completeLogin({
      params: url.searchParams,
      state: flow.state,
      codeVerifier: flow.codeVerifier,
      nonce: flow.nonce,
    });
  } catch (fejl) {
    // Logges SERVERSIDE og vises aldrig: teksten fra en token-veksling kan
    // baere koden eller en del af tokenet, og brugeren kan ikke bruge den til
    // noget. Hun faar en adresse der siger hvad hun skal goere.
    console.error("[callback] login kunne ikke fuldfoeres:", fejl);
    return NextResponse.redirect(new URL("/?error=login_failed", url.origin), 302);
  }
  const { claims, idToken } = resultat;

  // `sub` ER IDENTITETEN. email og name er bekvemmeligheder vi må VISE — ikke
  // noget vi må nøgle på. Et menneske kan eje flere adresser og kan skifte
  // sin primære; sub skifter aldrig.
  const session = await signSession(
    {
      sub: claims.sub,
      exp: Math.floor(Date.now() / 1000) + config.sessionMaxAge,
      ...(claims.email ? { email: claims.email } : {}),
      ...(claims.name ? { name: claims.name } : {}),
    },
    config.cookieSecret,
  );

  const res = NextResponse.redirect(
    new URL(sikkerReturnTo(flow.returnTo, "/mine-data"), url.origin),
    302,
  );
  res.headers.append(
    "set-cookie",
    cookieHeader(SESSION_COOKIE, session, {
      maxAge: config.sessionMaxAge,
      secure: secureCookies,
      sameSite: "Lax",
      path: "/",
    }),
  );
  // Flow-cookien er BRUGT. Lader man den ligge, kan den prøves igen.
  res.headers.append(
    "set-cookie",
    cookieHeader(FLOW_COOKIE, "", { maxAge: 0, secure: secureCookies, sameSite: "Lax", path: "/" }),
  );
  // id-tokenet gemmes så logout kan sende `id_token_hint` med. Uden det SKAL
  // udstederen spørge brugeren «vil du logge ud?» — sådan er RP-initieret
  // logout specificeret.
  res.headers.append(
    "set-cookie",
    cookieHeader("bid_id_token", idToken, {
      maxAge: config.sessionMaxAge,
      secure: secureCookies,
      sameSite: "Lax",
      path: "/",
    }),
  );
  return res;
}
