import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import sql from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const rpName = "IslandSpares Admin";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get user from DB
    const users = await sql`SELECT id, email, webauthn_user_id FROM admin_users WHERE id = ${userId}`;
    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's existing passkeys
    const passkeys = await sql`SELECT * FROM passkeys WHERE user_id = ${userId}`;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.webauthn_user_id ? Buffer.from(user.webauthn_user_id) : Buffer.from(userId.toString()),
      userName: user.email,
      // Don't prompt users for their authenticator if they've already registered it
      excludeCredentials: passkeys.map(passkey => ({
        id: passkey.credential_id,
        transports: passkey.transports ? passkey.transports.split(",") as any[] : [],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const response = NextResponse.json(options);
    response.cookies.set("webauthn_challenge", options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 mins
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Generate Registration Options Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
