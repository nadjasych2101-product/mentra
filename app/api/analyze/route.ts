import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { questionsByLanguage } from "@/data/questions";

type Language = "en" | "ru";

type AnswersQualitySummary = {
  emptyCount: number;
  shortCount: number;
  avgLength: number;
};

type BestFitRole = {
  role: string;
  explanation: string;
};

type SkillToDevelop = {
  skill: string;
  why: string;
  howToLearn: string;
};

type MentraResponse = {
  profileType: string;
  profileSummary: string;
  recommendedNextStep: string;
  whyThisResult: string[];
  keyStrengths: string[];
  workStyle: string;
  bestFitRoles: BestFitRole[];
  potentialMismatches: string[];
  actionPlan: {
    immediate: string[];
    exploration: string[];
    validation: string[];
    skillsToDevelop: SkillToDevelop[];
    nextMove: string;
  };
  _note?: string;
};

type MentraRawResult = {
  profileType?: unknown;
  profileSummary?: unknown;
  recommendedNextStep?: unknown;
  whyThisResult?: unknown;
  keyStrengths?: unknown;
  workStyle?: unknown;
  bestFitRoles?: unknown;
  potentialMismatches?: unknown;
  actionPlan?: {
    immediate?: unknown;
    exploration?: unknown;
    validation?: unknown;
    skillsToDevelop?: unknown;
    nextMove?: unknown;
  };
};

const GENERIC_PHRASES = [
  "hardworking",
  "motivated",
  "passionate",
  "responsible",
  "detail-oriented",
  "team player",
  "good communicator",
  "communication skills",
  "works well with others",
  "driven",
  "adaptable",
  "proactive",
  "goal-oriented",
  "трудолюб",
  "мотивирован",
  "ответственный",
  "командный игрок",
  "хорошо общается",
  "коммуникабель",
  "проактив",
  "адаптив",
  "focus on outcomes",
  "ориентация на результат",
  "collaborative",
  "reliable",
  "effective",
  "надёжный",
  "эффективный",
];

const VAGUE_ACTION_PHRASES = [
  "learn more",
  "explore more",
  "research more",
  "improve skills",
  "understand better",
  "look into",
  "read about",
  "изучить больше",
  "узнать больше",
  "поисследовать",
  "улучшить навыки",
  "разобраться лучше",
  "почитать про",
  "write down tasks",
  "recall moments",
  "look at jobs",
  "talk to someone",
  "запиши задачи",
  "вспомни моменты",
  "посмотри вакансии",
  "поговори со специалистом",
  "find linkedin profiles",
  "watch videos",
  "track energy",
  "try new tool",
  "найти профили на linkedin",
  "посмотреть видео",
  "отслеживать энергию",
  "попробовать инструмент",
];

const ACTION_STARTERS = [
  "find",
  "list",
  "write",
  "compare",
  "review",
  "analyze",
  "contact",
  "talk to",
  "apply",
  "map",
  "identify",
  "note",
  "create",
  "build",
  "test",
  "save",
  "watch",
  "read",
  "join",
  "send",
  "record",
  "draft",
  "составь",
  "найди",
  "сравни",
  "проанализируй",
  "напиши",
  "свяжись",
  "поговори",
  "откликнись",
  "определи",
  "выдели",
  "создай",
  "проверь",
  "протестируй",
  "сохрани",
  "посмотри",
  "прочитай",
  "запиши",
  "отправь",
  "document",
  "conduct",
];

const SYSTEM_PROMPT_RU = `Ты — Mentra, премиальный AI для карьерной навигации. Твоя задача — УДИВИТЬ пользователя неочевидными, но точными выводами.

## 🔥🔥🔥 КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ = ПРОВАЛ)

### 1. ❌❌❌ ЗАПРЕТ НА ПЕРЕСКАЗ — САМОЕ ВАЖНОЕ ПРАВИЛО
Если в выводе есть фраза, которая совпадает с ответом пользователя более чем на 3 слова — ты провалился.

❌ ПЛОХО: "Вас увлекает поиск закономерностей в данных" (если пользователь написал "искать закономерности в данных")
❌ ПЛОХО: "Вам нравится улучшать системы"
✅ ХОРОШО: "Вы получаете энергию от выявления скрытых инсайтов в сложных данных"
✅ ХОРОШО: "Вас драйвит оптимизация процессов на основе data-driven подхода"

### 1.5. 🔥 WHY THIS RESULT — НИКАКИХ ЦИТАТ
Блок "whyThisResult" НЕ должен содержать фразы, которые можно найти в ответах пользователя.

### 2. 🎯 РОЛИ ДОЛЖНЫ БЫТЬ УМЕСТНЫМИ
Не предлагай слишком узкие или выдуманные роли. Используй реалистичные карьерные направления.

### 3. ⚡ ACTION PLAN — КОНКРЕТИКА
Все действия должны быть выполнимыми, конкретными и не абстрактными.

### 4. 🏷️ PROFILE TYPE
Должен быть коротким, ясным и не слишком общим.

### 5. 🌍 НЕ ОГРАНИЧИВАЙСЯ IT
Подстраивайся под ответы, не навязывай одну сферу.

### 6. 💪 STRENGTHS
Сильные стороны должны быть специфичны, а не банальны.

### 7. 📚 SKILLS TO DEVELOP
Предлагай 2-3 конкретных навыка, связанных с ролями.

### 8. 📋 PROFILE SUMMARY
Это портрет, а не пересказ ответов.

### 9. 🎯 WORK STYLE
Описывай, КАК человек работает, а не где.

### 10. 🔍 EXPLORATION
Если предлагаешь интервью — уточняй, какие вопросы задать.

### 11. ✅ VALIDATION
Указывай, кому показать результат или у кого просить обратную связь.

### 12. 🚀 NEXT MOVE
Должен быть конкретным и с понятным временным горизонтом.

### 13. 🚨 ОБРАБОТКА ПРОТИВОРЕЧИЙ
Если сигналы противоречат друг другу — не смешивай их без объяснения.

### 14. 🎯 ПРИОРИТЕТ Q10
Последний вопрос — явный сигнал интереса. Учитывай его в ролях и плане.

### 15. 🔄 НЕ ИНВЕРТИРУЙ СМЫСЛ
Если пользователь говорит, что комфортно чувствует себя в хаосе — не пиши, что хаос его парализует.

### 16. 📉 ОСТОРОЖНО С DATA/IT
Не делай узких выводов про BI/data, если этого нет в ответах.

## 📋 СХЕМА JSON
{
  "profileType": "главное противоречие (2-4 слова)",
  "profileSummary": "2-3 предложения-ПОРТРЕТ, НЕ ПЕРЕСКАЗ",
  "recommendedNextStep": "один ясный следующий шаг, который можно сделать в ближайшие 24–72 часа",
  "whyThisResult": ["паттерн 1", "паттерн 2", "паттерн 3"],
  "keyStrengths": ["способность 1", "способность 2", "способность 3"],
  "workStyle": "КАК вы работаете, а не где",
  "bestFitRoles": [
    {"role": "реалистичная роль", "explanation": "почему подходит"}
  ],
  "potentialMismatches": ["роль/среда 1", "роль/среда 2"],
  "actionPlan": {
    "immediate": ["действие 1", "действие 2"],
    "exploration": ["исследование 1", "исследование 2"],
    "validation": ["проверка 1", "проверка 2"],
    "skillsToDevelop": [
      {"skill": "навык", "why": "почему", "howToLearn": "как начать"}
    ],
    "nextMove": "следующий шаг"
  }
}

Верни ТОЛЬКО чистый JSON.`;

const SYSTEM_PROMPT_EN = `You are Mentra, a premium AI for career navigation. Your goal is to provide non-obvious but accurate career insights.

## CRITICAL RULES

1. Do not repeat the user's wording directly.
2. "whyThisResult" must interpret patterns, not quote answers.
3. Recommend realistic roles, not made-up titles.
4. Action steps must be concrete and doable.
5. Do not force everything into IT.
6. Strengths must be specific, not generic.
7. Suggest 2-3 concrete skills to develop.
8. "profileSummary" must be a portrait, not a list of preferences.
9. "workStyle" must describe HOW the person works, not the environment.
10. If suggesting interviews, include concrete questions.
11. Validation steps should specify who to show work to or where to get feedback.
12. "nextMove" must be concrete and time-bound.
13. Handle contradictions honestly.
14. Prioritize Q10 as an explicit interest signal.
15. Do not invert the user's meaning.
16. Be cautious with narrow data/BI conclusions when evidence is weak.

## JSON SCHEMA
{
  "profileType": "core contradiction (2-4 words)",
  "profileSummary": "2-3 sentences portrait, not repetition",
  "recommendedNextStep": "one clear next step within 24-72 hours",
  "whyThisResult": ["pattern 1", "pattern 2", "pattern 3"],
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "workStyle": "HOW the person works",
  "bestFitRoles": [
    {"role": "realistic role", "explanation": "why it fits"}
  ],
  "potentialMismatches": ["mismatch 1", "mismatch 2"],
  "actionPlan": {
    "immediate": ["action 1", "action 2"],
    "exploration": ["exploration 1", "exploration 2"],
    "validation": ["validation 1", "validation 2"],
    "skillsToDevelop": [
      {"skill": "skill", "why": "why it matters", "howToLearn": "how to start"}
    ],
    "nextMove": "next move"
  }
}

Return ONLY clean JSON.`;

function detectAnswerLanguage(text: string): string {
  if (!text.trim()) return "empty";
  return /[а-яА-ЯёЁ]/.test(text) ? "ru" : "en";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isGeneric(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
}

function isVagueAction(text: string): boolean {
  const lower = text.toLowerCase();
  return VAGUE_ACTION_PHRASES.some((phrase) => lower.includes(phrase));
}

function hasActionStarter(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return ACTION_STARTERS.some(
    (verb) => lower.startsWith(verb) || lower.includes(` ${verb}`)
  );
}

function cleanList(
  items: unknown,
  options?: {
    maxItems?: number;
    maxLength?: number;
    removeGeneric?: boolean;
    requireAction?: boolean;
    removeVague?: boolean;
  }
): string[] {
  const {
    maxItems = 3,
    maxLength = 160,
    removeGeneric = false,
    requireAction = false,
    removeVague = false,
  } = options || {};

  if (!Array.isArray(items)) return [];

  return items
    .map(normalizeText)
    .filter(Boolean)
    .map((item) => item.slice(0, maxLength))
    .filter((item) => (removeGeneric ? !isGeneric(item) : true))
    .filter((item) => (removeVague ? !isVagueAction(item) : true))
    .filter((item) => (requireAction ? hasActionStarter(item) : true))
    .slice(0, maxItems);
}

function cleanText(
  value: unknown,
  options?: { maxLength?: number; fallback?: string }
): string {
  const { maxLength = 220, fallback = "" } = options || {};
  const text = normalizeText(value);
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function getSystemPrompt(isRussian: boolean, isLowQuality: boolean): string {
  const base = isRussian ? SYSTEM_PROMPT_RU : SYSTEM_PROMPT_EN;
  if (!isLowQuality) return base;

  const note = isRussian
    ? "⚠️ ВНИМАНИЕ: Ответы очень короткие. Делай осторожные выводы и давай более широкие, но всё ещё конкретные варианты."
    : "⚠️ NOTE: Answers are very short. Make careful inferences and offer broader but still concrete options.";

  return `${base}\n\n${note}`;
}

async function sendToTelegram(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("📝 Telegram not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.warn("Telegram API error:", response.status, text);
    }
  } catch (error) {
    console.warn("Failed to send Telegram notification:", error);
  }
}

function buildPrompt(
  language: Language,
  answers: string[],
  questions: Array<string | { question: string }>
): string {
  const formattedAnswersWithQuestions = answers
    .map((answer, index) => {
      const questionObj = questions[index];
      const question =
        typeof questionObj === "string" ? questionObj : questionObj.question;
      return `Q${index + 1}: ${question}\nA${index + 1}: ${answer || "(no answer)"}`;
    })
    .join("\n\n");

  return language === "ru"
    ? `Проанализируй ответы и верни JSON:\n\n${formattedAnswersWithQuestions}`
    : `Analyze answers and return JSON:\n\n${formattedAnswersWithQuestions}`;
}

function summarizeAnswersQuality(answers: string[]): AnswersQualitySummary {
  const emptyCount = answers.filter((a) => a.trim().length === 0).length;
  const shortCount = answers.filter((a) => {
    const trimmed = a.trim();
    return trimmed.length > 0 && trimmed.length < 30;
  }).length;
  const avgLength =
    answers.reduce((sum, a) => sum + a.trim().length, 0) / answers.length;

  return { emptyCount, shortCount, avgLength };
}

function extractSignals(answers: string[]) {
  const allText = answers.join(" ").toLowerCase();
  const q8 = (answers[7] || "").toLowerCase();
  const q10 = (answers[9] || "").toLowerCase();

  return {
    allText,
    q8,
    q10,
    hasAnalysis: /analy|анализ|данные|data|pattern|паттерн/i.test(allText),
    hasPeople:
      /people|люд|команд|team|клиент|client|support|поддерж|помогать|объяснять/i.test(
        allText
      ),
    hasCreate:
      /creat|твор|созда|дизайн|design|brand|бренд|концеп/i.test(allText),
    hasStructure:
      /struct|структур|порядок|организ|process|процесс|predict/i.test(allText),
    hasAutonomy:
      /autonom|автоном|свобод|независим|flexib|гибк/i.test(allText),
    likesExplaining: /объяснять|обуч|teaching|explain|учить/i.test(allText),
    q8Chaos: /хаос|chaos/i.test(q8),
    dislikesUncertainty: /неопредел|uncertain/i.test(allText),
    q10Jewelry: /ювел|камн|оценк|gem|jewel|gemm|apprais/i.test(q10),
    q10Testing: /тест|qa|quality|test/i.test(q10),
    q10Creative: /креатив|творч|creative|дизайн/i.test(q10),
    q10People: /люд|образован|обучен|тренер|коуч/i.test(q10),
  };
}

function buildFallbackResponse(
  language: Language,
  answersQuality: AnswersQualitySummary,
  signals: ReturnType<typeof extractSignals>
): MentraResponse {
  const isRussian = language === "ru";
  const isLowQuality =
    answersQuality.avgLength < 50 || answersQuality.emptyCount > 3;

  let profileType = "";
  let bestFitRoles: BestFitRole[] = [];

  if (signals.q10Jewelry) {
    profileType = isRussian ? "Исследователь-оценщик" : "Appraiser-Researcher";
    bestFitRoles = [
      {
        role: isRussian
          ? "Специалист по оценке ювелирных изделий"
          : "Jewelry Appraisal Specialist",
        explanation: isRussian
          ? "Подходит для внимательного и точного человека, которому интересны экспертиза, критерии оценки и предметный анализ."
          : "Fits someone detail-oriented who is interested in appraisal, evaluation criteria, and domain-specific analysis.",
      },
      {
        role: isRussian ? "Геммолог-стажёр" : "Junior Gemologist",
        explanation: isRussian
          ? "Даёт вход в сферу оценки и экспертизы через изучение камней, характеристик и стандартов."
          : "Offers an entry point into appraisal and expertise through stones, characteristics, and standards.",
      },
    ];
  } else if (signals.q10Testing) {
    profileType = isRussian ? "Точный проверяющий" : "Precision Checker";
    bestFitRoles = [
      {
        role: "QA Specialist",
        explanation: isRussian
          ? "Хороший вариант для человека, которому близки проверка, поиск несоответствий и работа по понятным критериям."
          : "Strong fit for someone who likes verification, spotting discrepancies, and working with clear criteria.",
      },
      {
        role: isRussian ? "Специалист по качеству" : "Quality Specialist",
        explanation: isRussian
          ? "Подходит, если важно следить за стандартами, точностью и предсказуемостью результата."
          : "Fits someone who values standards, accuracy, and predictable outcomes.",
      },
    ];
  } else if (signals.q10Creative) {
    profileType = isRussian ? "Идейный собиратель" : "Structured Creator";
    bestFitRoles = [
      {
        role: isRussian ? "Контент-стратег" : "Content Strategist",
        explanation: isRussian
          ? "Роль для человека, который любит идеи, но хочет доводить их до понятного результата."
          : "A good role for someone who likes ideas but also wants to turn them into structured outcomes.",
      },
      {
        role: isRussian ? "Креативный продюсер" : "Creative Producer",
        explanation: isRussian
          ? "Подходит, если нравится запускать идеи и собирать их в оформленный проект."
          : "Fits someone who likes launching ideas and shaping them into finished projects.",
      },
    ];
  } else if (signals.q10People) {
    profileType = isRussian ? "Поддерживающий проводник" : "Supportive Guide";
    bestFitRoles = [
      {
        role: isRussian
          ? "Координатор образовательных программ"
          : "Learning Program Coordinator",
        explanation: isRussian
          ? "Подходит человеку, которому важны помощь людям, организация и понятный практический результат."
          : "A fit for someone who values helping people, organizing work, and seeing practical impact.",
      },
      {
        role: isRussian ? "Координатор сообщества" : "Community Coordinator",
        explanation: isRussian
          ? "Хороший вариант, если важны человеческие связи, поддержка и сопровождение."
          : "A strong option if relationships, support, and guidance matter.",
      },
    ];
  } else if (signals.hasAnalysis && signals.hasStructure) {
    profileType = isRussian ? "Системный практик" : "Systematic Practical";
    bestFitRoles = [
      {
        role: isRussian ? "Специалист по качеству" : "Quality Specialist",
        explanation: isRussian
          ? "Подходит для человека, который любит разбираться в процессах и делать их надёжнее."
          : "Fits someone who likes understanding processes and making them more reliable.",
      },
      {
        role: isRussian
          ? "Специалист по улучшению процессов"
          : "Process Improvement Specialist",
        explanation: isRussian
          ? "Подходит, если есть интерес к анализу, порядку и улучшению того, что уже работает."
          : "Fits someone interested in analysis, structure, and improving existing systems.",
      },
    ];
  } else if (signals.hasPeople && signals.likesExplaining) {
    profileType = isRussian ? "Спокойный наставник" : "Practical Mentor";
    bestFitRoles = [
      {
        role: isRussian ? "Специалист по адаптации" : "Onboarding Specialist",
        explanation: isRussian
          ? "Подходит человеку, который умеет объяснять, поддерживать и проводить других через новый опыт."
          : "Fits someone who can explain, support, and guide others through unfamiliar situations.",
      },
      {
        role: isRussian ? "Координатор сообщества" : "Community Coordinator",
        explanation: isRussian
          ? "Подходит, если важны взаимодействие, забота и организация людей."
          : "A good fit if interaction, care, and people coordination matter.",
      },
    ];
  } else if (signals.hasCreate && signals.hasAutonomy) {
    profileType = isRussian ? "Самостоятельный создатель" : "Independent Maker";
    bestFitRoles = [
      {
        role: isRussian ? "Контент-специалист" : "Content Specialist",
        explanation: isRussian
          ? "Подходит, если хочется создавать что-то новое и работать в собственном ритме."
          : "Fits someone who wants to create and work with a degree of autonomy.",
      },
      {
        role: isRussian ? "Проектный координатор" : "Project Coordinator",
        explanation: isRussian
          ? "Подходит, если нравится не только придумывать, но и доводить до результата."
          : "Fits someone who wants not only to ideate, but also to deliver results.",
      },
    ];
  } else {
    profileType = isRussian ? "Универсальный практик" : "Practical Generalist";
    bestFitRoles = [
      {
        role: isRussian ? "Специалист по качеству" : "Quality Specialist",
        explanation: isRussian
          ? "Универсальная роль для внимательного человека, которому важно понимать, что и как работает."
          : "A broad fit for someone observant who wants to understand how things work.",
      },
      {
        role: isRussian ? "Координатор проектов" : "Project Coordinator",
        explanation: isRussian
          ? "Подходит, если важны организация, движение вперёд и понятный результат."
          : "Fits someone who values organization, progress, and concrete outcomes.",
      },
    ];
  }

  const chaosInterpretation = signals.q8Chaos
    ? isRussian
      ? "Вы не теряетесь в динамике и умеете собирать полезный фокус даже там, где много движения и неопределённости."
      : "You do not get lost in fast-moving environments and can still build useful focus amid uncertainty."
    : signals.dislikesUncertainty
      ? isRussian
        ? "Вам проще раскрыться там, где есть понятные ориентиры и ясные критерии."
        : "You perform better when there are clear reference points and understandable criteria."
      : isRussian
        ? "Лучше всего вы работаете там, где есть понятная цель и свобода в способе её достижения."
        : "You work best when there is a clear goal and freedom in how to reach it.";

  const response: MentraResponse = {
    profileType,
    profileSummary: isRussian
      ? signals.q10Jewelry
        ? "Вы тяготеете к точной и предметной работе, где важно не просто делать, а разбираться, сравнивать и оценивать. Вам подходит формат, в котором есть критерии, детали и возможность самостоятельно выстраивать ход анализа."
        : signals.q10Testing
          ? "Вам ближе работа, где ценятся точность, проверка и внимательность к деталям. Вы хорошо проявляетесь там, где нужно замечать несоответствия и доводить результат до более надёжного состояния."
          : signals.q10Creative
            ? "Вас заряжает создание нового, но лучше всего идеи раскрываются у вас тогда, когда их можно собрать в понятную форму. Вам важно не просто придумать, а увидеть, как замысел становится результатом."
            : signals.q10People
              ? "Вы тяготеете к ролям, где можно быть полезной другим людям через объяснение, поддержку и сопровождение. Вам важно чувствовать, что ваша работа имеет понятный человеческий смысл."
              : "Вы лучше всего раскрываетесь там, где можно не просто выполнять задачу, а понимать её логику и влиять на качество результата. Вам подходит сочетание самостоятельности, конкретики и практической пользы."
      : signals.q10Jewelry
        ? "You lean toward precise, object-focused work where it matters not just to do the task, but to compare, assess, and understand. You fit formats with criteria, detail, and enough autonomy to shape your own analysis."
        : signals.q10Testing
          ? "You are drawn to work built on precision, checking, and attention to detail. You perform well where spotting inconsistencies and improving reliability matters."
          : signals.q10Creative
            ? "Creating new things energizes you, but your ideas work best when they can be shaped into something concrete. It matters to you not only to imagine, but to turn ideas into outcomes."
            : signals.q10People
              ? "You are drawn to roles where you can be useful through explanation, support, and guidance. It matters to you that your work has visible human value."
              : "You do best where you are not just executing tasks, but understanding their logic and improving the final result. A mix of autonomy, clarity, and practical usefulness suits you well.",
    recommendedNextStep: isRussian
      ? signals.q10Jewelry
        ? "Найдите 3 источника по теме оценки ювелирных изделий и выпишите, какие знания и инструменты там повторяются чаще всего."
        : signals.q10Testing
          ? "Найдите 3 вакансии QA-специалиста и выделите повторяющиеся требования к навыкам и инструментам."
          : signals.q10Creative
            ? "Оформите одну свою идею в короткий текст или 2-3 слайда и покажите её одному человеку для обратной связи."
            : signals.q10People
              ? "Напишите 3 вопроса человеку из роли, связанной с поддержкой или обучением, и найдите 2-3 профиля, кому их можно отправить."
              : "Найдите 3 подходящие вакансии и выпишите повторяющиеся требования — это даст более реалистичное понимание направления."
      : signals.q10Jewelry
        ? "Find 3 sources about jewelry appraisal and note which knowledge areas and tools appear most often."
        : signals.q10Testing
          ? "Find 3 QA job postings and highlight recurring requirements in skills and tools."
          : signals.q10Creative
            ? "Turn one of your ideas into a short text or 2-3 slides and show it to one person for feedback."
            : signals.q10People
              ? "Write 3 questions for someone in a support or learning-related role and find 2-3 profiles you could send them to."
              : "Find 3 relevant job postings and note recurring requirements to get a more realistic picture of the direction.",
    whyThisResult: isRussian
      ? signals.q10Jewelry
        ? [
            "Вас тянет к предметной экспертизе, а не только к общим рассуждениям.",
            "Вы выглядите как человек, которому важны критерии, детали и точность.",
            "Самостоятельность работает для вас лучше всего, когда есть понятный объект анализа.",
          ]
        : signals.q10Testing
          ? [
              "Вам ближе логика проверки, чем хаотичное движение без критериев.",
              "Вы хорошо проявляетесь там, где ценятся точность и надёжность результата.",
              "Самостоятельность для вас особенно полезна, когда есть понятные стандарты качества.",
            ]
          : signals.q10Creative
            ? [
                "Идеи дают вам энергию, но вам важно не потерять их по дороге к результату.",
                "Лучше всего вы раскрываетесь, когда можно сочетать свободу и рамку.",
                "Для вас важен не только процесс придумывания, но и ощутимый итог.",
              ]
            : signals.q10People
              ? [
                  "Вас тянет к ролям, где можно быть полезной через поддержку и сопровождение.",
                  "Вы выглядите как человек, которому важно объяснять и помогать, а не просто выполнять формальные задачи.",
                  "Вам подходит работа, где есть человеческий контакт и ясная цель.",
                ]
              : [
                  "Вам важно понимать логику задачи, а не просто следовать инструкции.",
                  "Вы лучше раскрываетесь там, где можно сочетать точность и самостоятельность.",
                  "Практический интерес к предмету для вас важнее, чем громкое название роли.",
                ]
      : signals.q10Jewelry
        ? [
            "You are drawn to concrete expertise rather than only abstract discussion.",
            "You come across as someone who values criteria, detail, and precision.",
            "Autonomy works best for you when there is a clear object of analysis.",
          ]
        : signals.q10Testing
          ? [
              "You are more aligned with verification logic than with motion without standards.",
              "You perform well where accuracy and reliability matter.",
              "Autonomy is especially useful for you when quality standards are clear.",
            ]
          : signals.q10Creative
            ? [
                "Ideas energize you, but you also need them to reach a concrete result.",
                "You do best when freedom is balanced by structure.",
                "It matters to you not only to imagine, but to make something real.",
              ]
            : signals.q10People
              ? [
                  "You are drawn to roles where you can support and guide others.",
                  "You seem motivated by helping and explaining rather than only formal execution.",
                  "Work with human contact and a clear purpose fits you well.",
                ]
              : [
                  "You want to understand the logic of the task, not just follow instructions.",
                  "You do best where precision and autonomy can coexist.",
                  "Practical interest in the subject matters more to you than a flashy role title.",
                ],
    keyStrengths: isRussian
      ? [
          "Умение быстро схватывать суть задачи.",
          "Способность сочетать самостоятельность с рабочими рамками.",
          signals.hasPeople
            ? "Умение объяснять сложное простым языком."
            : "Внимание к деталям и качеству результата.",
        ]
      : [
          "Ability to grasp the core of a task quickly.",
          "Ability to combine autonomy with practical structure.",
          signals.hasPeople
            ? "Explaining complex things in simple language."
            : "Attention to detail and quality of outcome.",
        ],
    workStyle: isRussian
      ? `${chaosInterpretation} Вы обычно начинаете с общего понимания задачи, затем отсеиваете лишнее через логику и только потом переходите к реализации.`
      : `${chaosInterpretation} You usually start by building a broad understanding of the task, then filter the noise through logic, and only after that move into execution.`,
    bestFitRoles,
    potentialMismatches: isRussian
      ? [
          "Жёстко регламентированная среда без пространства для собственного подхода.",
          "Работа, где много суеты, но мало ясных критериев качества.",
        ]
      : [
          "A rigid environment with no room for your own approach.",
          "Work with a lot of noise but very few clear quality criteria.",
        ],
    actionPlan: {
      immediate: isRussian
        ? signals.q10Jewelry
          ? [
              "Сохраните 3 источника по теме оценки ювелирных изделий и выпишите по 2-3 повторяющихся требования или знания.",
              "Посмотрите одно вводное видео от геммолога или оценщика и запишите 2 наблюдения.",
            ]
          : signals.q10Testing
            ? [
                "Сохраните 3 вакансии QA и выпишите, какие инструменты и навыки повторяются чаще всего.",
                "Протестируйте одну простую функцию на сайте или в приложении и кратко запишите, что вы проверяли.",
              ]
            : signals.q10Creative
              ? [
                  "Запишите 3 идеи для улучшения знакомого продукта, сервиса или контента.",
                  "Оформите одну идею в короткий текстовый или визуальный набросок.",
                ]
              : signals.q10People
                ? [
                    "Составьте список из 3 организаций или сообществ, где нужны наставники, координаторы или помощники.",
                    "Напишите короткое сообщение о том, чем вы могли бы быть полезны в такой роли.",
                  ]
                : [
                    "Сохраните 3 вакансии и выпишите по одному повторяющемуся требованию из каждой.",
                    "Набросайте 3 пункта о том, как бы вы улучшили знакомый вам процесс.",
                  ]
        : signals.q10Jewelry
          ? [
              "Save 3 sources about jewelry appraisal and note 2-3 recurring requirements or knowledge areas from each.",
              "Watch one introductory video from a gemologist or appraiser and write down 2 observations.",
            ]
          : signals.q10Testing
            ? [
                "Save 3 QA job postings and note which tools and skills appear most often.",
                "Test one simple feature on a site or app and briefly write down what you checked.",
              ]
            : signals.q10Creative
              ? [
                  "Write down 3 ideas for improving a familiar product, service, or piece of content.",
                  "Turn one idea into a short textual or visual draft.",
                ]
              : signals.q10People
                ? [
                    "List 3 organizations or communities that need mentors, coordinators, or helpers.",
                    "Write a short message explaining how you could be useful in such a role.",
                  ]
                : [
                    "Save 3 job postings and note one recurring requirement from each.",
                    "Jot down 3 bullet points on how you would improve a process you know.",
                  ],
      exploration: isRussian
        ? signals.q10Jewelry
          ? [
              "Найдите интервью с геммологом или оценщиком и посмотрите, как люди входят в эту сферу.",
              "Посмотрите 2-3 профиля людей из ювелирной экспертизы и отметьте, какое у них образование и опыт.",
            ]
          : signals.q10Testing
            ? [
                "Посмотрите короткий бесплатный курс по основам тестирования ПО.",
                "Разберите 2-3 профиля QA-специалистов и посмотрите, что у них общего в начале пути.",
              ]
            : signals.q10Creative
              ? [
                  "Разберите 2-3 сильных проекта в интересующей вас творческой сфере и выпишите, что делает их убедительными.",
                  "Найдите одно сообщество, где обсуждают эту сферу, и прочитайте несколько популярных обсуждений.",
                ]
              : signals.q10People
                ? [
                    "Найдите 1-2 программы или сообщества для наставников, координаторов или помощников и посмотрите требования.",
                    "Прочитайте материал от человека, который уже работает в сфере поддержки или сопровождения людей.",
                  ]
                : [
                    `Проведите 15-минутный разговор с человеком, который работает в роли "${roleExample}". Спросите: "Что самое неожиданное в работе?" и "Какой навык недооценивают новички?"`,
                    `Проанализируйте 3 профиля "${roleExample}" и выпишите общие элементы в опыте и навыках.`,
                  ]
        : signals.q10Jewelry
          ? [
              "Find an interview with a gemologist or appraiser and see how people enter this field.",
              "Review 2-3 profiles of people in jewelry appraisal and note their education and experience.",
            ]
          : signals.q10Testing
            ? [
                "Watch a short free course on software testing basics.",
                "Review 2-3 QA profiles and note what they have in common early in their path.",
              ]
            : signals.q10Creative
              ? [
                  "Break down 2-3 strong projects in your creative field of interest and note what makes them convincing.",
                  "Find one community discussing that field and read a few popular threads.",
                ]
              : signals.q10People
                ? [
                    "Find 1-2 programs or communities for mentors, coordinators, or helpers and review the requirements.",
                    "Read a piece written by someone already working in a support or guidance role.",
                  ]
                : [
                    `Conduct a 15-minute conversation with someone working as a "${roleExample}". Ask: "What is the most surprising part of the job?" and "What skill do beginners underestimate?"`,
                    `Analyze 3 "${roleExample}" profiles and note common patterns in experience and skills.`,
                  ],
      validation: isRussian
        ? signals.q10Jewelry
          ? [
              "Попробуйте сделать пробную оценку любого украшения или камня по открытым критериям и запишите ход мыслей.",
              "Покажите свои заметки в тематическом сообществе или знакомому, который разбирается в теме, и попросите комментарий.",
            ]
          : signals.q10Testing
            ? [
                "Составьте чек-лист для тестирования простой функции и попросите кого-то оценить его понятность.",
                "Напишите короткий баг-репорт по найденной проблеме и проверьте, насколько он ясен со стороны.",
              ]
            : signals.q10Creative
              ? [
                  "Оформите одну идею в виде короткой презентации или поста и покажите её 1-2 людям.",
                  'Спросите: "Что здесь самое сильное, а что пока неубедительно?"',
                ]
              : signals.q10People
                ? [
                    "Проведите пробное объяснение сложной темы простыми словами другу или коллеге.",
                    "Попросите обратную связь о том, насколько это было понятно и полезно.",
                  ]
                : [
                    `Создайте короткую мини-презентацию для роли "${roleExample}" и покажите её знакомому или в тематическом чате.`,
                    'Попросите обратную связь с вопросом: "Что здесь пока самое слабое место?"',
                  ]
        : signals.q10Jewelry
          ? [
              "Try making a rough appraisal of any piece of jewelry or gemstone using public criteria and write down your reasoning.",
              "Share your notes with a relevant community or someone knowledgeable and ask for feedback.",
            ]
          : signals.q10Testing
            ? [
                "Create a checklist for testing a simple feature and ask someone to judge how clear it is.",
                "Write a short bug report for an issue you found and see whether it is understandable to someone else.",
              ]
            : signals.q10Creative
              ? [
                  "Turn one idea into a short presentation or post and show it to 1-2 people.",
                  'Ask: "What feels strongest here, and what still feels weak?"',
                ]
              : signals.q10People
                ? [
                    "Try explaining a complex topic in simple terms to a friend or colleague.",
                    "Ask for feedback on how clear and useful the explanation was.",
                  ]
                : [
                    `Create a short mini-presentation for the role "${roleExample}" and share it with someone relevant or in a community.`,
                    'Ask for feedback with the question: "What feels weakest here so far?"',
                  ],
      skillsToDevelop: isRussian
        ? signals.q10Jewelry
          ? [
              {
                skill: "Базовая геммология",
                why: "Нужна для понимания свойств камней и критериев оценки.",
                howToLearn:
                  "Начните с открытых вводных материалов, видео и коротких статей по основам геммологии.",
              },
              {
                skill: "Навык предметного анализа",
                why: "Помогает сравнивать признаки, опираться на критерии и делать выводы.",
                howToLearn:
                  "Тренируйтесь описывать объекты по признакам и фиксировать, на чём основана оценка.",
              },
            ]
          : signals.q10Testing
            ? [
                {
                  skill: "Основы тестирования ПО",
                  why: "Это база для понимания логики QA-работы.",
                  howToLearn:
                    "Возьмите короткий бесплатный курс по основам QA и терминологии.",
                },
                {
                  skill: "Тест-дизайн и баг-репорты",
                  why: "Это главный практический навык для реальной работы.",
                  howToLearn:
                    "Потренируйтесь составлять чек-листы и описывать найденные проблемы понятным языком.",
                },
              ]
            : signals.q10Creative
              ? [
                  {
                    skill: "Структурирование идей",
                    why: "Помогает доводить замысел до понятного результата.",
                    howToLearn:
                      "Практикуйтесь переводить идеи в короткие концепты, схемы или 2-3 слайда.",
                  },
                  {
                    skill: "Презентация замысла",
                    why: "Важно уметь объяснить, почему идея работает.",
                    howToLearn:
                      "Пробуйте короткие устные или текстовые питчи для друзей и знакомых.",
                  },
                ]
              : signals.q10People
                ? [
                    {
                      skill: "Активное слушание",
                      why: "Это база для поддержки, наставничества и сопровождения.",
                      howToLearn:
                        "Практикуйтесь в разговорах: сначала уточнить, потом пересказать смысл своими словами.",
                    },
                    {
                      skill: "Фасилитация и объяснение",
                      why: "Помогает удерживать людей в процессе и делать информацию понятной.",
                      howToLearn:
                        "Пробуйте объяснять сложные темы коротко и просить обратную связь о ясности.",
                    },
                  ]
                : [
                    {
                      skill: "Коммуникация и презентация",
                      why: "Помогает объяснять идеи, выводы и решения понятным способом.",
                      howToLearn:
                        "Запишите 2-минутное объяснение одной идеи и покажите его знакомому.",
                    },
                    {
                      skill: "Аналитическое мышление",
                      why: "Позволяет видеть закономерности и делать более точные выводы.",
                      howToLearn:
                        "Берите простые кейсы и тренируйтесь разбирать, от чего зависит результат.",
                    },
                  ]
        : signals.q10Jewelry
          ? [
              {
                skill: "Basic gemology",
                why: "It helps you understand stone properties and evaluation criteria.",
                howToLearn:
                  "Start with open introductory materials, videos, and short articles on gemology basics.",
              },
              {
                skill: "Object-based analysis",
                why: "It helps you compare traits, use criteria, and make grounded judgments.",
                howToLearn:
                  "Practice describing objects by characteristics and writing down what supports your judgment.",
              },
            ]
          : signals.q10Testing
            ? [
                {
                  skill: "Software testing basics",
                  why: "This is the foundation for understanding QA work.",
                  howToLearn:
                    "Take a short free course on QA basics and terminology.",
                },
                {
                  skill: "Test design and bug reporting",
                  why: "This is the key practical skill for real testing work.",
                  howToLearn:
                    "Practice making checklists and describing issues in clear language.",
                },
              ]
            : signals.q10Creative
              ? [
                  {
                    skill: "Structuring ideas",
                    why: "It helps you turn ideas into something concrete.",
                    howToLearn:
                      "Practice turning ideas into short concepts, sketches, or 2-3 slides.",
                  },
                  {
                    skill: "Presenting ideas",
                    why: "It matters to explain why an idea works.",
                    howToLearn:
                      "Try short spoken or written pitches with friends or peers.",
                  },
                ]
              : signals.q10People
                ? [
                    {
                      skill: "Active listening",
                      why: "It is foundational for support, mentoring, and guidance.",
                      howToLearn:
                        "Practice clarifying first, then restating the meaning in your own words.",
                    },
                    {
                      skill: "Facilitation and explanation",
                      why: "It helps you support people through a process and make information understandable.",
                      howToLearn:
                        "Practice explaining complex topics briefly and ask for feedback on clarity.",
                    },
                  ]
                : [
                    {
                      skill: "Communication and presentation",
                      why: "It helps you explain ideas, conclusions, and decisions clearly.",
                      howToLearn:
                        "Record a 2-minute explanation of one idea and show it to someone you trust.",
                    },
                    {
                      skill: "Analytical thinking",
                      why: "It helps you notice patterns and make sharper judgments.",
                      howToLearn:
                        "Take simple cases and practice breaking down what drives the outcome.",
                    },
                  ],
      nextMove: isRussian
        ? signals.q10Jewelry
          ? "В течение недели выберите один вводный материал по геммологии и попробуйте применить его к оценке одного реального объекта."
          : signals.q10Testing
            ? "В течение недели пройдите один короткий вводный материал по QA и оформите один пробный баг-репорт."
            : signals.q10Creative
              ? "В течение недели доведите одну идею до короткого оформленного результата и получите хотя бы один внешний комментарий."
              : signals.q10People
                ? "В течение недели найдите одну реальную возможность попробовать себя в роли помощника, наставника или координатора хотя бы в небольшом формате."
                : "Выберите один небольшой проект и доведите его до законченного результата в течение двух недель."
        : signals.q10Jewelry
          ? "Within a week, choose one introductory gemology resource and apply it to evaluating one real object."
          : signals.q10Testing
            ? "Within a week, complete one short QA introduction and write one trial bug report."
            : signals.q10Creative
              ? "Within a week, take one idea to a short finished format and get at least one external comment on it."
              : signals.q10People
                ? "Within a week, find one real opportunity to try a helper, mentor, or coordinator role, even in a small format."
                : "Choose one small project and bring it to a finished result within two weeks.",
    },
    _note: isLowQuality
      ? isRussian
        ? "⚠️ Анализ основан на коротких ответах."
        : "⚠️ Analysis based on short answers."
      : undefined,
  };

  return response;
}

function generateSmartFallback(
  language: Language,
  answers: string[],
  answersQuality: AnswersQualitySummary
): MentraResponse {
  return buildFallbackResponse(language, answersQuality, extractSignals(answers));
}

async function callGroq(
  prompt: string,
  isRussian: boolean,
  answersQuality: AnswersQualitySummary
): Promise<{ result: MentraRawResult; isLowQuality: boolean } | null> {
  if (!process.env.GROQ_API_KEY) {
    console.log("❌ Groq API key not configured");
    return null;
  }

  try {
    console.log("🤖 Calling Groq (primary)...");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const isLowQuality =
      answersQuality.avgLength < 50 || answersQuality.emptyCount > 3;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(isRussian, isLowQuality),
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const result = JSON.parse(jsonStr) as MentraRawResult;

    console.log("✅ Groq succeeded");
    return { result, isLowQuality };
  } catch (error: unknown) {
    console.error("❌ Groq failed:", error);
    return null;
  }
}

async function callDeepSeek(
  prompt: string,
  isRussian: boolean,
  answersQuality: AnswersQualitySummary
): Promise<{ result: MentraRawResult; isLowQuality: boolean } | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("❌ DeepSeek API key not configured");
    return null;
  }

  try {
    console.log("🤖 Calling DeepSeek (fallback)...");
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const isLowQuality =
      answersQuality.avgLength < 50 || answersQuality.emptyCount > 3;

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(isRussian, isLowQuality),
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from DeepSeek");

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const result = JSON.parse(jsonStr) as MentraRawResult;

    console.log("✅ DeepSeek succeeded");
    return { result, isLowQuality };
  } catch (error: unknown) {
    console.error("❌ DeepSeek failed:", error);
    return null;
  }
}

function mergeRoles(
  modelRoles: BestFitRole[],
  fallbackRoles: BestFitRole[],
  maxItems = 3
): BestFitRole[] {
  const merged = [...modelRoles];

  for (const fallbackRole of fallbackRoles) {
    if (!merged.some((role) => role.role === fallbackRole.role)) {
      merged.push(fallbackRole);
    }
    if (merged.length >= maxItems) break;
  }

  return merged.slice(0, maxItems);
}

function normalizeModelResult(
  rawResult: MentraRawResult,
  smartFallback: MentraResponse,
  isRussian: boolean
): MentraResponse {
  const normalized: MentraResponse = {
    profileType: cleanText(rawResult.profileType, {
      maxLength: 60,
      fallback: smartFallback.profileType,
    }),
    profileSummary: cleanText(rawResult.profileSummary, {
      maxLength: 400,
      fallback: smartFallback.profileSummary,
    }),
    recommendedNextStep: cleanText(rawResult.recommendedNextStep, {
      maxLength: 220,
      fallback: smartFallback.recommendedNextStep,
    }),
    whyThisResult: cleanList(rawResult.whyThisResult, {
      maxItems: 3,
      maxLength: 220,
      removeGeneric: true,
    }),
    keyStrengths: cleanList(rawResult.keyStrengths, {
      maxItems: 3,
      maxLength: 180,
      removeGeneric: true,
    }),
    workStyle: cleanText(rawResult.workStyle, {
      maxLength: 400,
      fallback: smartFallback.workStyle,
    }),
    bestFitRoles: Array.isArray(rawResult.bestFitRoles)
      ? rawResult.bestFitRoles
          .map((item: unknown) => {
            const roleItem = item as { role?: unknown; explanation?: unknown };
            return {
              role: cleanText(roleItem?.role, { maxLength: 100 }),
              explanation: cleanText(roleItem?.explanation, { maxLength: 300 }),
            };
          })
          .filter((item) => item.role && item.explanation)
          .slice(0, 3)
      : [],
    potentialMismatches: cleanList(rawResult.potentialMismatches, {
      maxItems: 2,
      maxLength: 220,
    }),
    actionPlan: {
      immediate: cleanList(rawResult.actionPlan?.immediate, {
        maxItems: 3,
        maxLength: 320,
        requireAction: true,
        removeVague: true,
      }),
      exploration: cleanList(rawResult.actionPlan?.exploration, {
        maxItems: 3,
        maxLength: 320,
        requireAction: true,
        removeVague: true,
      }),
      validation: cleanList(rawResult.actionPlan?.validation, {
        maxItems: 3,
        maxLength: 320,
        requireAction: true,
        removeVague: true,
      }),
      skillsToDevelop: Array.isArray(rawResult.actionPlan?.skillsToDevelop)
        ? rawResult.actionPlan!.skillsToDevelop
            .map((item: unknown) => {
              const skillItem = item as {
                skill?: unknown;
                why?: unknown;
                howToLearn?: unknown;
              };
              return {
                skill: cleanText(skillItem?.skill, { maxLength: 80 }),
                why: cleanText(skillItem?.why, { maxLength: 220 }),
                howToLearn: cleanText(skillItem?.howToLearn, {
                  maxLength: 220,
                }),
              };
            })
            .filter((item) => item.skill && item.why && item.howToLearn)
            .slice(0, 3)
        : [],
      nextMove: cleanText(rawResult.actionPlan?.nextMove, {
        maxLength: 350,
        fallback: smartFallback.actionPlan.nextMove,
      }),
    },
    _note: smartFallback._note,
  };

  if (normalized.whyThisResult.length < 3) {
    normalized.whyThisResult = smartFallback.whyThisResult;
  }

  if (normalized.keyStrengths.length < 2) {
    normalized.keyStrengths = smartFallback.keyStrengths;
  }

  if (!normalized.bestFitRoles.length) {
    normalized.bestFitRoles = smartFallback.bestFitRoles;
  } else if (normalized.bestFitRoles.length < 2) {
    normalized.bestFitRoles = mergeRoles(
      normalized.bestFitRoles,
      smartFallback.bestFitRoles
    );
  }

  if (!normalized.potentialMismatches.length) {
    normalized.potentialMismatches = smartFallback.potentialMismatches;
  }

  if (!normalized.actionPlan.immediate.length) {
    normalized.actionPlan.immediate = smartFallback.actionPlan.immediate;
  }

  if (!normalized.actionPlan.exploration.length) {
    normalized.actionPlan.exploration = smartFallback.actionPlan.exploration;
  }

  if (!normalized.actionPlan.validation.length) {
    normalized.actionPlan.validation = smartFallback.actionPlan.validation;
  }

  if (!normalized.actionPlan.skillsToDevelop.length) {
    normalized.actionPlan.skillsToDevelop = smartFallback.actionPlan.skillsToDevelop;
  }

  if (!normalized.actionPlan.nextMove) {
    normalized.actionPlan.nextMove = smartFallback.actionPlan.nextMove;
  }

  if (!normalized.recommendedNextStep) {
    normalized.recommendedNextStep = smartFallback.recommendedNextStep;
  }

  if (!normalized.profileType) {
    normalized.profileType = isRussian
      ? "Универсал-практик"
      : "Practical Generalist";
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const answers = body.answers as string[];
    const language = (body.language as Language) || "en";

    if (!Array.isArray(answers) || answers.length !== 10) {
      return NextResponse.json(
        { error: "Invalid answers payload" },
        { status: 400 }
      );
    }

    const isRussian = language === "ru";
    const questions = questionsByLanguage[language];

    if (process.env.NODE_ENV !== "production") {
      console.log("📝 Received answers:");
      answers.forEach((ans, i) => {
        console.log(
          `  Q${i + 1}: ${ans.substring(0, 100)}${ans.length > 100 ? "..." : ""}`
        );
      });
    }

    const answersQuality = summarizeAnswersQuality(answers);
    const isLowQuality =
      answersQuality.avgLength < 50 || answersQuality.emptyCount > 3;
    const smartFallback = generateSmartFallback(language, answers, answersQuality);

    console.log(
      `📊 Quality: ${answersQuality.emptyCount} empty, ${answersQuality.shortCount} short, avg length: ${Math.round(
        answersQuality.avgLength
      )}`
    );

    const prompt = buildPrompt(language, answers, questions);

    let rawResult: MentraRawResult | null = null;
    let provider: "groq" | "deepseek" | "fallback" = "fallback";

    const groqResponse = await callGroq(prompt, isRussian, answersQuality);
    if (groqResponse) {
      rawResult = groqResponse.result;
      provider = "groq";
    }

    if (!rawResult) {
      const deepseekResponse = await callDeepSeek(
        prompt,
        isRussian,
        answersQuality
      );
      if (deepseekResponse) {
        rawResult = deepseekResponse.result;
        provider = "deepseek";
      }
    }

    if (!rawResult) {
      console.log("📋 Using smart fallback");

      await sendToTelegram(
        `🆕 Новый анализ (fallback)\n` +
          `🌐 Язык: ${language}\n` +
          `📊 Качество: ${isLowQuality ? "низкое" : "среднее"}\n` +
          `👤 Профиль: ${escapeHtml(smartFallback.profileType)}`
      );

      return NextResponse.json({
        ...smartFallback,
        provider: "fallback",
        confidence: isLowQuality ? "low" : "medium",
      });
    }

    const normalized = normalizeModelResult(rawResult, smartFallback, isRussian);

    console.log(
      `✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`
    );

    const rolesList = normalized.bestFitRoles.map((r) => r.role).join(", ");
    await sendToTelegram(
      `✅ <b>Новый анализ!</b>\n` +
        `🤖 Провайдер: ${provider}\n` +
        `🌐 Язык: ${language}\n` +
        `👤 Профиль: ${escapeHtml(normalized.profileType)}\n` +
        `💼 Роли: ${escapeHtml(rolesList)}\n` +
        `📊 Качество: ${isLowQuality ? "низкое" : "высокое"}`
    );

    return NextResponse.json({
      ...normalized,
      provider,
      confidence: isLowQuality ? "low" : "medium",
      _note: normalized._note,
    });
  } catch (error) {
    console.error("💥 Fatal error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}