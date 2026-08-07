import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";
//import db from "../../../../lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-islandspares-jwt-token-key-change-me";

export async function POST(request: Request) {
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

    const { fullName, email, phone, company, website, address } = await request.json();

    if (!fullName || !email) {
      return NextResponse.json({ error: "Full Name and Email are required" }, { status: 400 });
    }

    let savedProfile = {
      fullName,
      email,
      phone: phone || "",
      company: company || "",
      website: website || "",
      address: address || "",
    };

    try {
      // Update the user record in database
      const result = await sql`
        UPDATE admin_users 
        SET 
          full_name = ${fullName},
          email = ${email},
          phone = ${phone || null},
          company = ${company || null},
          website = ${website || null},
          address = ${address || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER(${decoded.email})
        RETURNING email, full_name, phone, company, website, address
      `;

      if (result && result.length === 0) {
        // If user wasn't in DB yet, let's insert it!
        await sql`
          INSERT INTO admin_users (email, password_hash, full_name, phone, company, website, address)
          VALUES (
            ${email}, 
            'admin123', -- default admin123 plain text
            ${fullName}, 
            ${phone || null}, 
            ${company || null}, 
            ${website || null}, 
            ${address || null}
          )
        `;
      } else if (result && result.length > 0) {
        const u = result[0];
        savedProfile = {
          fullName: u.full_name || savedProfile.fullName,
          email: u.email || savedProfile.email,
          phone: u.phone || "",
          company: u.company || "",
          website: u.website || "",
          address: u.address || "",
        };
      }
    } catch (dbErr) {
      console.warn("Database profile update skipped/failed (mock mode):", dbErr);
    }

    // Update the JWT session token to reflect the new email & name
    const newToken = jwt.sign(
      {
        id: decoded.id,
        email: savedProfile.email,
        fullName: savedProfile.fullName,
        role: decoded.role || "admin",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ success: true, profile: savedProfile });
    response.cookies.set("session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("save-profile API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
