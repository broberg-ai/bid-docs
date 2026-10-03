/**
 * LÆS SESSIONEN — ét sted, så to sider ikke kan være uenige om hvem der er
 * logget ind.
 *
 * `verifySession` returnerer null for ENHVER grund cookien ikke kan stoles på:
 * manipuleret, udløbet, forkert signeret, fraværende. Der er derfor ingen
 * gren hvor en halvt gyldig session slipper igennem.
 */
import { cookies } from "next/headers";
import { verifySession, type SessionPayload } from "@broberg/sso";
import { config, SESSION_COOKIE } from "./sso";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, config.cookieSecret);
}
