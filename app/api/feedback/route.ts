import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("MENTRA_FEEDBACK", {
      usefulnessFeedback: body.usefulnessFeedback,
      deeperVersionInterest: body.deeperVersionInterest,
      textFeedback: body.textFeedback,
      profileType: body.profileType,
      language: body.language,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}