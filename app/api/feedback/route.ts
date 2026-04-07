import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("MENTRA_FEEDBACK", {
      usefulnessFeedback: body.usefulnessFeedback ?? null,
      deeperVersionInterest: body.deeperVersionInterest ?? null,
      textFeedback: body.textFeedback ?? "",
      profileType: body.profileType ?? null,
      language: body.language ?? null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}