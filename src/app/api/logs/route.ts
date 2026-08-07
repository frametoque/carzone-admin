import { NextResponse, NextRequest } from "next/server";
import sql from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

// GET /api/logs — fetch all activity logs, newest first
export async function GET() {
  try {
    const logs = await sql`
      SELECT id, timestamp, user_email, ip_address, action, os, client
      FROM system_activity_logs
      ORDER BY timestamp DESC
      LIMIT 500
    `;
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

// POST /api/logs — create a new activity log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, os, client: clientBrowser } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Get user email from session
    let userEmail = "Unknown";
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("session");
      if (sessionCookie?.value) {
        const decoded: any = jwt.verify(sessionCookie.value, JWT_SECRET);
        userEmail = decoded.email || "Unknown";
      }
    } catch {}

    // Get IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "Unknown";

    await sql`
      INSERT INTO system_activity_logs (user_email, ip_address, action, os, client)
      VALUES (${userEmail}, ${ip}, ${action}, ${os || null}, ${clientBrowser || null})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to create activity log:", error);
    return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  }
}

// DELETE /api/logs — clear all activity logs
export async function DELETE() {
  try {
    await sql`DELETE FROM system_activity_logs`;
    return NextResponse.json({ success: true, message: "All logs cleared" });
  } catch (error) {
    console.error("Failed to clear activity logs:", error);
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
  }
}
