import { NextResponse } from "next/server";
import sql from "@/lib/db";

// DELETE /api/logs/cleanup — auto-delete logs older than 3 months
export async function DELETE() {
  try {
    const result = await sql`
      DELETE FROM system_activity_logs
      WHERE timestamp < NOW() - INTERVAL '3 months'
    `;
    return NextResponse.json({ 
      success: true, 
      message: "Old logs cleaned up",
      deleted: result.count || 0
    });
  } catch (error) {
    console.error("Failed to cleanup old logs:", error);
    return NextResponse.json({ error: "Failed to cleanup logs" }, { status: 500 });
  }
}
