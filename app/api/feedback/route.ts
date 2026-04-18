import { NextRequest, NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const usefulnessFeedback = body.usefulnessFeedback ?? null;
    const deeperVersionInterest = body.deeperVersionInterest ?? null;
    const textFeedback = body.textFeedback ?? "";
    const profileType = body.profileType ?? null;
    const language = body.language ?? null;
    const timestamp = new Date().toISOString();

    console.log("MENTRA_FEEDBACK", {
      usefulnessFeedback,
      deeperVersionInterest,
      textFeedback,
      profileType,
      language,
      timestamp,
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const message = [
        "📝 <b>New Mentra feedback</b>",
        "",
        `<b>Time:</b> ${escapeHtml(timestamp)}`,
        `<b>Language:</b> ${escapeHtml(String(language ?? "unknown"))}`,
        `<b>Profile:</b> ${escapeHtml(String(profileType ?? "unknown"))}`,
        `<b>Accurate?:</b> ${escapeHtml(String(usefulnessFeedback ?? "—"))}`,
        `<b>Wants deeper version?:</b> ${escapeHtml(String(deeperVersionInterest ?? "—"))}`,
        "",
        "<b>Text feedback:</b>",
        escapeHtml(String(textFeedback || "—")),
      ].join("\n");

      const tgResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );

      if (!tgResponse.ok) {
        const tgError = await tgResponse.text();
        console.error("Telegram send error:", tgError);
      }
    } else {
      console.warn("Telegram env vars are missing");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}