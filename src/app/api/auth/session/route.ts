import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify JWT
    try {
      const decoded: any = jwt.verify(sessionCookie.value, JWT_SECRET);
      return NextResponse.json({
        authenticated: true,
        user: {
          id: decoded.id,
          email: decoded.email,
          fullName: decoded.fullName,
          role: decoded.role,
        },
      });
    } catch (err) {
      // Clear the invalid session cookie to break the redirect loop
      cookieStore.delete("session");
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }
  } catch (error) {
    console.error("Session GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
