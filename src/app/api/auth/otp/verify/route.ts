import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("pending_otp")?.value;

    if (!token) {
      return NextResponse.json({ error: "OTP expired or invalid" }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ error: "OTP expired or invalid" }, { status: 400 });
    }

    if (decoded.email !== email || decoded.otp !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    // Verify user exists in DB
    const users = await sql`
      SELECT id, email, COALESCE(full_name, name, 'Admin') as full_name, COALESCE(role, 'admin') as role 
      FROM admin_users 
      WHERE email = ${email}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: "Account disabled or not found" }, { status: 401 });
    }

    const user = users[0];

    // Clear the pending OTP cookie
    cookieStore.delete("pending_otp");

    // Create full session token
    const sessionToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    const response = NextResponse.json({ success: true });
    
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return response;
  } catch (error: any) {
    console.error("OTP Verify Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
