import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

type Language = "en" | "ru";

const analysisSchema = z.object({
  profileType: z.string(),
  profileSummary: z.string(),
  whyThisResult: z.array(z.string()),
  keyStrengths: z.array(z.string()),
  workStyle: z.string(),
  bestFitRoles: z.array(
    z.object({
      role: z.string(),
      explanation: z.string(),
    })
  ),
  potentialMismatches: z.array(z.string()),
  recommendedNextStep: z.string(),
});

const responseJsonSchema = {
  type: "object",
  properties: {
    profileType: { type: "string" },
    profileSummary: { type: "string" },
    whyThisResult: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    keyStrengths: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    workStyle: { type: "string" },
    bestFitRoles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["role", "explanation"],
        additionalProperties: false,
      },
      minItems: 2,
      maxItems: 3,
    },
    potentialMismatches: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 2,
    },
    recommendedNextStep: { type: "string" },
  },
  required: [
    "profileType",
    "profileSummary",
    "whyThisResult",
    "keyStrengths",
    "workStyle",
    "bestFitRoles",
    "potentialMismatches",
    "recommendedNextStep",
  ],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in .env.local" },
        { status: 500 }
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const body = await req.json();
    const answers = body.answers as string[];
    const language = (body.language as Language) || "en";

    if (
      !answers ||
      !Array.isArray(answers) ||
      answers.length !== 10 ||
      answers.some((a) => typeof a !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid answers payload" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const formattedAnswers = answers
      .map((answer, index) => `${index + 1}. ${answer}`)
      .join("\n");

    const prompt =
      language === "ru"
        ? `
    Ты — Mentra, точный и наблюдательный AI, который помогает человеку лучше понять себя через работу.

    Твоя задача — не просто описать, а выявить паттерны мышления, поведения и мотивации.

    ВАЖНО:
    - Не предполагай, что пользователь из IT
    - Учитывай разные сферы: бизнес, образование, психология, креатив, операции и т.д.
    - Не используй шаблонные фразы
    - Не пиши как гороскоп
    - Не льсти пользователю
    - Пиши как умный человек, который внимательно прочитал ответы

    СТИЛЬ:
    - Конкретно
    - Спокойно
    - Без воды
    - Без общих фраз
    - С причинно-следственными связями ("потому что...", "это видно из того, что...")

    ТРЕБОВАНИЯ К ОТВЕТУ:
    - Верни ТОЛЬКО JSON
    - Никакого текста вне JSON
    - Пиши на русском

    СТРУКТУРА:
    - whyThisResult → объяснение, почему ты пришёл к этому выводу (3 пункта, с опорой на ответы)
    - keyStrengths → не абстрактные, а поведенческие
    - bestFitRoles → не только названия, но и логика, почему именно они
    - potentialMismatches → где человеку будет плохо (реалистично)
    - recommendedNextStep → конкретное действие, а не совет

    Дополнительно:
    - избегай банальных ролей без обоснования
    - если ответы противоречивые — отрази это
    - Избегай формулировок, которые могли бы подойти любому человеку

    Ответы пользователя:
    ${formattedAnswers}
    `
        : `
        You are Mentra, a sharp and perceptive AI that helps a person understand themselves through their work patterns.

        Your goal is not just to describe, but to infer thinking patterns, behavior, and motivation.

        IMPORTANT:
        - Do not assume the user is in tech
        - Consider a wide range of domains (business, education, psychology, creative, operations, etc.)
        - Avoid generic phrasing
        - Do not sound like a horoscope
        - Do not flatter
        - Write like a thoughtful human who carefully read the answers

        STYLE:
        - Specific
        - Calm
        - No fluff
        - No generic advice
        - Use causal reasoning ("this suggests...", "this is visible from...")

        OUTPUT RULES:
        - Return ONLY JSON
        - No text outside JSON
        - Write in English

        STRUCTURE:
        - whyThisResult → explain why you reached this conclusion (3 points, grounded in answers)
        - keyStrengths → behavioral, not abstract
        - bestFitRoles → include reasoning, not just titles
        - potentialMismatches → where the user may struggle (realistically)
        - recommendedNextStep → one concrete action, not vague advice

        Additionally:
        - avoid defaulting to generic roles without justification
        - reflect contradictions if present in answers
        - Avoid statements that could apply to almost anyone

        User answers:
        ${formattedAnswers}
        `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema,
      },
    });

    const text = response.text;

    if (!text) {
      return NextResponse.json(
        { error: "Empty response from Gemini" },
        { status: 500 }
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      console.error("Gemini returned non-JSON text:", text);
      return NextResponse.json(
        { error: "Gemini returned non-JSON text" },
        { status: 500 }
      );
    }

    // Мягкая нормализация на случай, если модель слегка отклонилась
    const normalized = {
      profileType: String((raw as any)?.profileType ?? ""),
      profileSummary: String((raw as any)?.profileSummary ?? ""),
      whyThisResult: Array.isArray((raw as any)?.whyThisResult)
        ? (raw as any).whyThisResult.map(String).slice(0, 3)
        : [],
      keyStrengths: Array.isArray((raw as any)?.keyStrengths)
        ? (raw as any).keyStrengths.map(String).slice(0, 3)
        : [],
      workStyle: String((raw as any)?.workStyle ?? ""),
      bestFitRoles: Array.isArray((raw as any)?.bestFitRoles)
        ? (raw as any).bestFitRoles.slice(0, 3).map((item: any) => ({
            role: String(item?.role ?? ""),
            explanation: String(item?.explanation ?? ""),
          }))
        : [],
      potentialMismatches: Array.isArray((raw as any)?.potentialMismatches)
        ? (raw as any).potentialMismatches.map(String).slice(0, 2)
        : [],
      recommendedNextStep: String((raw as any)?.recommendedNextStep ?? ""),
    };

    const parsed = analysisSchema.safeParse(normalized);

    if (!parsed.success) {
      console.error("Gemini validation error:", parsed.error.flatten());
      console.error("Gemini raw text:", text);

      return NextResponse.json(
        { error: "Gemini returned invalid structured JSON" },
        { status: 500 }
      );
    }

    console.log("assessment_completed", {
      language,
      answersLength: answers.length,
      profileType: parsed.data.profileType,
      provider: "gemini",
    });

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error("Analyze error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}