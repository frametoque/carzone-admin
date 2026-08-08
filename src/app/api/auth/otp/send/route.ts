import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { sendMail } from "@/lib/mail";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    const users = await sql`SELECT id FROM admin_users WHERE email = ${email}`;
    
    // We return success even if user doesn't exist to prevent email enumeration
    if (users.length > 0) {
      // Generate 6 digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`\n\n=== OTP GENERATED (SMTP NOT CONFIGURED) ===`);
        console.log(`Sending OTP to ${email}: ${otp}`);
        console.log(`=====================\n\n`);
      } else {
        // Try to send email
        try {
          await sendMail({
            to: email,
            subject: "Your Carz ONE Admin Login Code",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Login Verification</h2>
                <p>You requested to sign in from a new device.</p>
                <p>Your 6-digit verification code is:</p>
                <h1 style="letter-spacing: 5px; color: #002f4c;">${otp}</h1>
                <p>This code will expire in 5 minutes.</p>
              </div>
            `,
          });
        } catch (mailErr) {
          console.error("Failed to send OTP email:", mailErr);
          // We could return an error here, but for security against enumeration
          // we might still just say "If an account exists, an OTP has been sent."
          // Or if we know the user exists and it failed, we can return a 500.
          return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
        }
      }

      // Create a short-lived token containing the OTP
      const token = jwt.sign({ email, otp }, JWT_SECRET, { expiresIn: "5m" });
      
      const cookieStore = await cookies();
      cookieStore.set("pending_otp", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 5 * 60, // 5 minutes
      });
    }

    return NextResponse.json({ success: true, message: "If an account exists, an OTP has been sent." });
  } catch (error: any) {
    console.error("OTP Send Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
