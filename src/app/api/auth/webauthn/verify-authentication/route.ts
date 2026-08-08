import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const host = request.headers.get("host") || "localhost:3000";
    const rpID = host.split(":")[0];
    const expectedOrigin = process.env.NODE_ENV === "production" ? `https://${host}` : `http://${host}`;

    const { email, response: body } = await request.json();

    const users = await sql`SELECT id, email, full_name, role FROM admin_users WHERE LOWER(email) = LOWER(${email.trim()})`;
    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get("webauthn_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 400 });
    }

    const passkeys = await sql`SELECT * FROM passkeys WHERE user_id = ${user.id} AND credential_id = ${body.id}`;
    const passkey = passkeys[0];

    if (!passkey) {
      return NextResponse.json({ error: "Authenticator not registered with this user" }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credential_id,
          publicKey: Buffer.from(passkey.public_key, 'base64'),
          counter: passkey.counter,
          transports: passkey.transports ? passkey.transports.split(",") as any[] : [],
        },
      });
    } catch (error: any) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Create Session JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          fullName: user.full_name || "Admin",
          role: user.role || "admin",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Set secure Cookie
      const response = NextResponse.json({ verified: true, user: { id: user.id, email: user.email, fullName: user.full_name } });
      response.cookies.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      response.cookies.delete("webauthn_challenge");
      return response;
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error("Verify Authentication Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
