import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const { email, pin } = await request.json();

    if (!email || !pin || pin.length !== 6) {
      return NextResponse.json({ error: "Email and a 6-digit PIN are required" }, { status: 400 });
    }

    const users = await sql`
      SELECT id, email, pin_hash, COALESCE(full_name, name, 'Admin') as full_name, COALESCE(role, 'admin') as role 
      FROM admin_users 
      WHERE LOWER(email) = LOWER(${email.trim()})
    `;

    const user = users[0];

    if (!user || !user.pin_hash) {
      return NextResponse.json({ error: "Invalid PIN or not set up" }, { status: 401 });
    }

    // Compare PIN
    const isValid = await bcrypt.compare(pin, user.pin_hash);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // Create Session JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set secure Cookie
    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, fullName: user.full_name } });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("PIN Login API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
