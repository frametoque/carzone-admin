import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";
//import db from "../../../../lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-islandspares-jwt-token-key-change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@islandspares.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }



    // 2. Validate Credentials against DB (admin_users) or Fallback to Environment
    let authenticatedUser: any = null;

    try {
      const dbUsers = await sql`
        SELECT id, email, password_hash, full_name, role 
        FROM admin_users 
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;

      if (dbUsers && dbUsers.length > 0) {
        const user = dbUsers[0];
        const passMatch = password === user.password_hash;
        if (passMatch) {
          authenticatedUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name || "Admin",
            role: user.role || "admin",
          };
        }
      }
    } catch (dbErr) {
      console.error("Database auth lookup failed (falling back to env credentials):", dbErr);
    }

    // Fallback if DB lookup failed or didn't authenticate
    if (!authenticatedUser) {
      if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        authenticatedUser = {
          id: 999,
          email: ADMIN_EMAIL,
          fullName: "IslandSpares Admin",
          role: "admin",
        };
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 3. Create Session JWT
    const token = jwt.sign(
      {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        fullName: authenticatedUser.fullName,
        role: authenticatedUser.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Set secure Cookie
    const response = NextResponse.json({ success: true, user: authenticatedUser });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
