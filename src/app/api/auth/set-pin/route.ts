import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { pin } = await request.json();

    if (!pin || pin.length !== 6) {
      return NextResponse.json({ error: "A 6-digit PIN is required" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    await sql`UPDATE admin_users SET pin_hash = ${pinHash} WHERE id = ${userId}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set PIN API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
