import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import sql from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const host = request.headers.get("host") || "localhost:3000";
    const rpID = host.split(":")[0];
    const expectedOrigin = process.env.NODE_ENV === "production" ? `https://${host}` : `http://${host}`;

    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const body = await request.json();
    
    const userAgent = request.headers.get("user-agent") || "";
    let deviceName = "Unknown Device";
    if (userAgent.includes("iPhone")) deviceName = "iPhone";
    else if (userAgent.includes("iPad")) deviceName = "iPad";
    else if (userAgent.includes("Mac OS")) deviceName = "Mac";
    else if (userAgent.includes("Windows")) deviceName = "Windows PC";
    else if (userAgent.includes("Android")) deviceName = "Android Device";
    else if (userAgent.includes("Linux")) deviceName = "Linux PC";
    
    const expectedChallenge = cookieStore.get("webauthn_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      });
    } catch (error: any) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType } = registrationInfo;
      const transports = credential.transports ? credential.transports.join(",") : "";
      
      // Save the passkey to DB
      await sql`
        INSERT INTO passkeys (credential_id, user_id, public_key, counter, device_type, transports, device_name) 
        VALUES (${credential.id}, ${userId}, ${Buffer.from(credential.publicKey).toString('base64')}, ${credential.counter}, ${credentialDeviceType}, ${transports}, ${deviceName})
      `;

      const response = NextResponse.json({ verified: true });
      response.cookies.delete("webauthn_challenge");
      return response;
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error("Verify Registration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
