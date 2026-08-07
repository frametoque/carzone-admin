import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}

export async function GET() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
