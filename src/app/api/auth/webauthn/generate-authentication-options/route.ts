import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import sql from "@/lib/db";

const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const users = await sql`SELECT id, email, webauthn_user_id FROM admin_users WHERE LOWER(email) = LOWER(${email.trim()})`;
    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passkeys = await sql`SELECT * FROM passkeys WHERE user_id = ${user.id}`;
    
    // It's possible the user doesn't have passkeys yet
    if (passkeys.length === 0) {
      return NextResponse.json({ error: "No passkeys registered for this user" }, { status: 404 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(passkey => ({
        id: passkey.credential_id,
        transports: passkey.transports ? passkey.transports.split(",") as any[] : [],
      })),
      userVerification: "preferred",
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
    console.error("Generate Authentication Options Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
