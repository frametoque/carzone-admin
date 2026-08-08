import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";
//import db from "../../../../lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }

    // Load profile from admin_users
    let profile = {
      fullName: decoded.fullName || "Carz ONE Admin",
      email: decoded.email || "admin@carzone.lk",
      phone: "",
      company: "Carz ONE",
      website: "https://carzone.lk",
      address: "Colombo, Sri Lanka",
    };

    try {
      const dbUsers = await sql`
        SELECT email, COALESCE(full_name, name) as full_name, phone, company, website, address 
        FROM admin_users 
        WHERE LOWER(email) = LOWER(${decoded.email})
      `;

      if (dbUsers && dbUsers.length > 0) {
        const u = dbUsers[0];
        profile = {
          fullName: u.full_name || profile.fullName,
          email: u.email || profile.email,
          phone: u.phone || "",
          company: u.company || "",
          website: u.website || "",
          address: u.address || "",
        };
      }
    } catch (dbErr) {
      console.warn("Database lookup failed for profile, using default session data.");
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("get-profile API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
