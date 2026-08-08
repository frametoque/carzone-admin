import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

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

    const devices = await sql`
      SELECT credential_id, device_name, device_type, created_at
      FROM passkeys
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ devices });
  } catch (error: any) {
    console.error("Get Devices Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credential_id");

    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID is required" }, { status: 400 });
    }

    await sql`
      DELETE FROM passkeys
      WHERE credential_id = ${credentialId} AND user_id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Device Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
