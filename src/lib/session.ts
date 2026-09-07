import { cookies } from "next/headers";

export interface SessionPayload {
  id: string;
  role: string;
  name: string;
}

// A simple mock session manager. In a real app, use jose or iron-session to cryptographically sign this.
export async function createSession(payload: SessionPayload) {
  const cookieStore = await cookies();
  const sessionValue = Buffer.from(JSON.stringify(payload)).toString("base64");
  cookieStore.set("crwn_session", sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("crwn_session");

  if (!sessionCookie) return null;

  try {
    const payloadStr = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    return JSON.parse(payloadStr) as SessionPayload;
  } catch (err) {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("crwn_session");
}
