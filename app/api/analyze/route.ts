import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { questionsByLanguage } from "@/data/questions";

type Language = "en" | "ru";

// ========== Константы ==========
const GENERIC_PHRASES = [
  "hardworking", "motivated", "passionate", "responsible", "detail-oriented",
  "team player", "good communicator", "communication skills", "works well with others",
  "driven", "adaptable", "proactive", "goal-oriented", "трудолюб", "мотивирован",
  "ответственный", "командный игрок", "хорошо общается", "коммуникабель",
  "проактив", "адаптив", "focus on outcomes", "ориентация на результат",
  "collaborative", "reliable", "effective", "надёжный", "эффективный",
];

const VAGUE_ACTION_PHRASES = [
  "learn more", "explore more", "research more", "improve skills", "understand better",
  "look into", "read about", "изучить больше", "узнать больше", "поисследовать",
  "улучшить навыки", "разобраться лучше", "почитать про", "write down tasks",
  "recall moments", "look at jobs", "talk to someone", "запиши задачи",
  "вспомни моменты", "посмотри вакансии", "поговори со специалистом",
  "find linkedin profiles", "watch videos", "track energy", "try new tool",
  "найти профили на linkedin", "посмотреть видео", "отслеживать энергию", "попробовать инструмент",
  "изучите рабочий день", "отслеживайте энергию", "разработайте план",
];

const ACTION_STARTERS = [
  "find", "list", "write", "compare", "review", "analyze", "contact", "talk to",
  "apply", "map", "identify", "note", "create", "build", "test", "составь", "найди",
  "сравни", "проанализируй", "напиши", "свяжись", "поговори", "откликнись",
  "определи", "выдели", "создай", "проверь", "протестируй", "document", "conduct",
];

// ========== Helpers ==========
function detectAnswerLanguage(text: string): string {
  if (!text.trim()) return "empty";
  const russianChars = /[а-яА-ЯёЁ]/;
  return russianChars.test(text) ? "ru" : "en";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isGeneric(text: string) {
  const lower = text.toLowerCase();
  return GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
}

function isVagueAction(text: string) {
  const lower = text.toLowerCase();
  return VAGUE_ACTION_PHRASES.some((phrase) => lower.includes(phrase));
}

function hasActionStarter(text: string) {
  const lower = text.toLowerCase();
  return ACTION_STARTERS.some((verb) => lower.startsWith(verb));
}

function cleanList(items: unknown, options?: {
  maxItems?: number;
  maxLength?: number;
  removeGeneric?: boolean;
  requireAction?: boolean;
  removeVague?: boolean;
}): string[] {
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
    .filter((item) => item.length <= maxLength)
    .filter((item) => (removeGeneric ? !isGeneric(item) : true))
    .filter((item) => (removeVague ? !isVagueAction(item) : true))
    .filter((item) => (requireAction ? hasActionStarter(item) : true))
    .slice(0, maxItems);
}

function cleanText(value: unknown, options?: { maxLength?: number; fallback?: string }): string {
  const { maxLength = 220, fallback = "" } = options || {};
  const text = normalizeText(value);
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

// ========== System Prompt ==========
function getSystemPrompt(isRussian: boolean, isLowQuality: boolean) {
  const lowQualityNote = isRussian
    ? "⚠️ ВНИМАНИЕ: Ответы очень короткие. Делай осторожные выводы, давай более широкие варианты."
    : "⚠️ NOTE: Answers are very short. Make careful inferences, broader options.";

  return isRussian
    ? `Ты — Mentra, премиальный AI для карьерной навигации. Твоя задача — УДИВИТЬ пользователя неочевидными, но точными выводами.

${isLowQuality ? lowQualityNote : ""}

## 🔥🔥🔥 КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ = ПРОВАЛ)

### ❌❌❌ 1. АБСОЛЮТНЫЙ ЗАПРЕТ НА ПЕРЕСКАЗ
Если вывод можно найти в ответах — ты провалился.

❌ "Создание с нуля увлекает тебя" (если пользователь написал "создание с нуля")
✅ "Ты получаешь энергию от ролей ранней стадии, где можно заложить фундамент"
✅ "Тебя драйвит быть у истоков, а не просто улучшать существующее"

**Переформулируй каждый ответ пользователя. Никаких цитат.**

### 🎯 2. РОЛИ ДОЛЖНЫ УДИВЛЯТЬ
❌ "Менеджер продукта" — слишком очевидно
✅ "Product Operations" — создание нового в рамках структуры
✅ "Innovation Program Manager" — драйв изменений без хаоса
✅ "Technical Founder in Residence" — для тех, кто хочет строить с нуля

**Предлагай роли, до которых пользователь сам бы не додумался.**

### ⚡ 3. ACTION PLAN = КОНКРЕТНЫЕ АРТЕФАКТЫ
❌ "изучите рабочий день", "отслеживайте энергию", "разработайте план"

✅ "Создайте таблицу с 5 вакансиями [РОЛЬ] и выделите 3 повторяющихся требования"
✅ "Напишите 1-страничный документ: 'Как я бы улучшил [конкретный продукт]'"
✅ "Проведите 15-мин интервью с [РОЛЬ] и запишите 3 неочевидных инсайта"
✅ "Сделайте мини-презентацию о себе для роли [РОЛЬ] на 3 слайда"

**Каждое действие заканчивается КОНКРЕТНЫМ АРТЕФАКТОМ.**

### 🏷️ 4. PROFILE TYPE = ГЛАВНОЕ ПРОТИВОРЕЧИЕ
❌ "Стратегический Инноватор" — слишком общо
✅ "Строитель структуры в хаосе" — если человеку нужны рамки для креатива
✅ "Креатор, которому нужны границы" — если свобода пугает
✅ "Системный визионер" — если стратегия + порядок

**Profile type должен сразу раскрывать ГЛАВНОЕ ПРОТИВОРЕЧИЕ профиля.**

### 📋 5. СХЕМА JSON
{
  "profileType": "главное противоречие (2-4 слова)",
  "profileSummary": "2-3 предложения-ИНТЕРПРЕТАЦИЯ, НЕ ПЕРЕСКАЗ",
  "whyThisResult": ["переформулированный паттерн 1", "паттерн 2", "паттерн 3"],
  "keyStrengths": ["рабочая способность 1", "способность 2", "способность 3"],
  "workStyle": "идеальная среда — интерпретация",
  "bestFitRoles": [{"role": "НЕОЧЕВИДНАЯ роль", "explanation": "почему подходит"}],
  "potentialMismatches": ["роль/среда 1", "роль/среда 2"],
  "actionPlan": {
    "immediate": ["действие → КОНКРЕТНЫЙ АРТЕФАКТ", "действие 2 → АРТЕФАКТ"],
    "exploration": ["способ попробовать → АРТЕФАКТ", "способ 2 → АРТЕФАКТ"],
    "validation": ["способ проверить → АРТЕФАКТ", "способ 2 → АРТЕФАКТ"],
    "nextMove": "карьерный шаг на 1-3 месяца"
  }
}

Верни ТОЛЬКО чистый JSON.`
    : `You are Mentra, a premium AI for career navigation. Your goal: SURPRISE with non-obvious but accurate insights.

${isLowQuality ? lowQualityNote : ""}

## 🔥🔥🔥 CRITICAL RULES (VIOLATION = FAILURE)

### ❌❌❌ 1. ABSOLUTE NO REGURGITATION
If a conclusion can be found in the answers — you failed.

❌ "You enjoy creating from scratch" (if user said "creating from scratch")
✅ "You get energy from early-stage roles where you can lay the foundation"
✅ "You're driven by being at the origin, not just improving"

**Rephrase every user answer. No quotes.**

### 🎯 2. ROLES MUST SURPRISE
❌ "Product Manager" — too obvious
✅ "Product Operations" — creation within structure
✅ "Innovation Program Manager" — driving change without chaos
✅ "Technical Founder in Residence" — building from zero

**Suggest roles the user wouldn't think of themselves.**

### ⚡ 3. ACTION PLAN = CONCRETE ARTIFACTS
❌ "study the workday", "track energy", "develop a plan"

✅ "Create a spreadsheet with 5 [ROLE] job postings and highlight 3 recurring requirements"
✅ "Write a 1-page document: 'How I would improve [specific product]'"
✅ "Conduct a 15-min interview with a [ROLE] and note 3 non-obvious insights"
✅ "Create a 3-slide mini-pitch about yourself for a [ROLE] role"

**Every action must end with a CONCRETE ARTIFACT.**

### 🏷️ 4. PROFILE TYPE = CORE CONTRADICTION
❌ "Strategic Innovator" — too generic
✅ "Structure Builder in Chaos" — if creativity needs boundaries
✅ "Creator Who Needs Guardrails" — if freedom is scary
✅ "Systematic Visionary" — if strategy + order

**Profile type must reveal the CORE CONTRADICTION.**

### 📋 5. JSON SCHEMA
{
  "profileType": "core contradiction (2-4 words)",
  "profileSummary": "2-3 sentences of INTERPRETATION, NOT REPETITION",
  "whyThisResult": ["rephrased pattern 1", "pattern 2", "pattern 3"],
  "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
  "workStyle": "ideal environment — interpretation",
  "bestFitRoles": [{"role": "NON-OBVIOUS role", "explanation": "why it fits"}],
  "potentialMismatches": ["role/environment 1", "role/environment 2"],
  "actionPlan": {
    "immediate": ["action → CONCRETE ARTIFACT", "action 2 → ARTIFACT"],
    "exploration": ["way to try → ARTIFACT", "way 2 → ARTIFACT"],
    "validation": ["way to test → ARTIFACT", "way 2 → ARTIFACT"],
    "nextMove": "career move for 1-3 months"
  }
}

Return ONLY clean JSON.`;
}

// ========== Groq Provider (ОСНОВНОЙ) ==========
async function callGroq(prompt: string, isRussian: boolean, answersQuality: any) {
  if (!process.env.GROQ_API_KEY) {
    console.log("❌ Groq API key not configured");
    return null;
  }

  try {
    console.log("🤖 Calling Groq (primary)...");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const { emptyCount, avgLength } = answersQuality;
    const isLowQuality = avgLength < 50 || emptyCount > 3;

    const systemPrompt = getSystemPrompt(isRussian, isLowQuality);

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from Groq");

    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr);

    console.log("✅ Groq succeeded");
    return { result, isLowQuality };
  } catch (error: any) {
    console.error("❌ Groq failed:", error?.message || error);
    return null;
  }
}

// ========== DeepSeek Provider (FALLBACK) ==========
async function callDeepSeek(prompt: string, isRussian: boolean, answersQuality: any) {
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

    const { emptyCount, avgLength } = answersQuality;
    const isLowQuality = avgLength < 50 || emptyCount > 3;

    const systemPrompt = getSystemPrompt(isRussian, isLowQuality);

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from DeepSeek");

    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr);

    console.log("✅ DeepSeek succeeded");
    return { result, isLowQuality };
  } catch (error: any) {
    console.error("❌ DeepSeek failed:", error?.message || error);
    if (error?.status === 402) {
      console.error("💳 DeepSeek: Insufficient balance");
    }
    return null;
  }
}

// ========== Smart Fallback Response ==========
function generateSmartFallback(language: Language, answers: string[], answersQuality: any) {
  const isRussian = language === "ru";
  const allText = answers.join(" ").toLowerCase();
  const { avgLength, emptyCount } = answersQuality;
  const isLowQuality = avgLength < 50 || emptyCount > 3;

  const hasAnalysis = /analy|анализ|данные|data|pattern|паттерн/i.test(allText);
  const hasPeople = /people|люд|команд|team|клиент|client|support|поддерж/i.test(allText);
  const hasCreate = /creat|твор|созда|дизайн|design|brand|бренд|концеп/i.test(allText);
  const hasStructure = /struct|структур|порядок|организ|process|процесс/i.test(allText);
  const hasAutonomy = /autonom|автоном|свобод|независим|flexib|гибк/i.test(allText);
  const needsStructure = hasCreate && hasStructure;
  const avoidsChaos = /chaos|хаос|uncertain|неопредел/i.test(allText);

  let profileType = "";
  let roles: Array<{ role: string; explanation: string }> = [];

  if (hasCreate && needsStructure) {
    profileType = isRussian ? "Строитель структуры в хаосе" : "Structure Builder in Chaos";
    roles = [
      { role: isRussian ? "Product Operations" : "Product Operations", explanation: isRussian ? "Создание нового в рамках структуры" : "Creation within structure" },
      { role: isRussian ? "Innovation Program Manager" : "Innovation Program Manager", explanation: isRussian ? "Драйв изменений без хаоса" : "Driving change without chaos" },
    ];
  } else if (hasAnalysis && hasStructure) {
    profileType = isRussian ? "Системный визионер" : "Systematic Visionary";
    roles = [
      { role: isRussian ? "Business Operations Strategist" : "Business Operations Strategist", explanation: isRussian ? "Анализ + стратегия в рамках процессов" : "Analysis + strategy within processes" },
      { role: isRussian ? "Technical Program Manager" : "Technical Program Manager", explanation: isRussian ? "Системное мышление для сложных проектов" : "Systems thinking for complex projects" },
    ];
  } else if (hasCreate && hasAutonomy && avoidsChaos) {
    profileType = isRussian ? "Креатор, которому нужны границы" : "Creator Who Needs Guardrails";
    roles = [
      { role: isRussian ? "Design Operations" : "Design Operations", explanation: isRussian ? "Креатив в структурированной среде" : "Creativity in structured environment" },
      { role: isRussian ? "Creative Producer" : "Creative Producer", explanation: isRussian ? "Управление креативными проектами" : "Managing creative projects" },
    ];
  } else {
    profileType = isRussian ? "Универсал-стратег" : "Strategic Generalist";
    roles = [
      { role: isRussian ? "Chief of Staff" : "Chief of Staff", explanation: isRussian ? "Стратегия + операции" : "Strategy + operations" },
      { role: isRussian ? "Business Operations" : "Business Operations", explanation: isRussian ? "Улучшение процессов" : "Process improvement" },
    ];
  }

  const roleExample = roles[0]?.role || (isRussian ? "специалист" : "specialist");

  return {
    profileType,
    profileSummary: isRussian
      ? `Ты получаешь энергию от ${hasCreate ? "создания нового" : "улучшения существующего"}, но тебе нужны чёткие рамки для эффективной работы.`
      : `You get energy from ${hasCreate ? "creating new things" : "improving existing systems"}, but you need clear boundaries to work effectively.`,
    whyThisResult: isRussian
      ? ["Ты драйвишься созданием, но не хаосом", "Тебе нужна структура для креатива", "Ты ценишь автономию в рамках процессов"]
      : ["You're driven by creation, not chaos", "You need structure for creativity", "You value autonomy within processes"],
    keyStrengths: isRussian
      ? ["Превращение идей в структурированные планы", "Работа в рамках с автономией", "Создание порядка из хаоса"]
      : ["Turning ideas into structured plans", "Working within frameworks with autonomy", "Creating order from chaos"],
    workStyle: isRussian
      ? `Среда с чёткими границами, но свободой внутри них. Минимум неопределённости, максимум автономии.`
      : `Environment with clear boundaries but freedom within. Minimal uncertainty, maximum autonomy.`,
    bestFitRoles: roles,
    potentialMismatches: isRussian
      ? ["Полностью неструктурированные стартапы", "Жёстко регламентированные роли без автономии"]
      : ["Completely unstructured startups", "Rigidly defined roles without autonomy"],
    actionPlan: {
      immediate: isRussian
        ? [`Создайте таблицу с 5 вакансиями "${roleExample}" и выделите 3 повторяющихся требования`, `Напишите 1-страничный документ о том, как вы бы улучшили процесс в текущей работе`]
        : [`Create a spreadsheet with 5 "${roleExample}" job postings and highlight 3 recurring requirements`, `Write a 1-page document on how you'd improve a process in your current work`],
      exploration: isRussian
        ? [`Проведите 15-мин интервью с ${roleExample} и запишите 3 неочевидных инсайта`, `Проанализируйте 3 профиля ${roleExample} на LinkedIn и найдите общие паттерны`]
        : [`Conduct a 15-min interview with a ${roleExample} and note 3 non-obvious insights`, `Analyze 3 ${roleExample} LinkedIn profiles and find common patterns`],
      validation: isRussian
        ? [`Сделайте мини-презентацию о себе для роли ${roleExample} на 3 слайда`, `Покажите презентацию знакомому из индустрии для обратной связи`]
        : [`Create a 3-slide mini-pitch about yourself for a ${roleExample} role`, `Share the pitch with someone in the industry for feedback`],
      nextMove: isRussian
        ? `В течение месяца проведи 3 информационных интервью с ${roleExample} и определи, какие навыки нужно прокачать в первую очередь`
        : `Within a month, conduct 3 informational interviews with ${roleExample} and identify which skills to develop first`,
    },
    _note: isLowQuality
      ? (isRussian ? "⚠️ Анализ основан на коротких ответах." : "⚠️ Analysis based on short answers.")
      : undefined,
  };
}

// ========== Main POST Handler ==========
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const answers = body.answers as string[];
    const language = (body.language as Language) || "en";

    if (!answers || !Array.isArray(answers) || answers.length !== 10) {
      return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 });
    }

    const isRussian = language === "ru";
    const questions = questionsByLanguage[language];

    console.log("📝 Received answers:");
    answers.forEach((ans, i) => {
      console.log(`  Q${i + 1}: ${ans.substring(0, 50)}${ans.length > 50 ? "..." : ""}`);
    });

    const answersQuality = answers.map((a) => ({
      text: a,
      length: a.trim().length,
      isEmpty: a.trim().length === 0,
      isShort: a.trim().length > 0 && a.trim().length < 30,
      detectedLang: detectAnswerLanguage(a),
    }));

    const emptyCount = answersQuality.filter((q) => q.isEmpty).length;
    const shortCount = answersQuality.filter((q) => q.isShort).length;
    const avgLength = answers.reduce((sum, a) => sum + a.length, 0) / answers.length;

    const qualityInfo = { emptyCount, shortCount, avgLength };
    const isLowQuality = avgLength < 50 || emptyCount > 3;

    console.log(`📊 Quality: ${emptyCount} empty, ${shortCount} short, avg length: ${Math.round(avgLength)}`);

    const formattedAnswersWithQuestions = answers
      .map((answer, index) => {
        const questionObj = questions[index];
        const question = typeof questionObj === 'string' ? questionObj : questionObj.question;
        return `Q${index + 1}: ${question}\nA${index + 1}: ${answer || "(no answer)"}`;
      })
      .join("\n\n");

    const prompt = isRussian
      ? `Проанализируй ответы и верни JSON:\n\n${formattedAnswersWithQuestions}`
      : `Analyze answers and return JSON:\n\n${formattedAnswersWithQuestions}`;

    let rawResult: any = null;
    let provider = "fallback";

    // 1. Groq (основной, быстрый)
    const groqResponse = await callGroq(prompt, isRussian, qualityInfo);
    if (groqResponse) {
      rawResult = groqResponse.result;
      provider = "groq";
    }

    // 2. DeepSeek (fallback)
    if (!rawResult) {
      const deepseekResponse = await callDeepSeek(prompt, isRussian, qualityInfo);
      if (deepseekResponse) {
        rawResult = deepseekResponse.result;
        provider = "deepseek";
      }
    }

    // 3. Smart fallback
    if (!rawResult) {
      console.log("📋 Using smart fallback");
      const fallbackResult = generateSmartFallback(language, answers, qualityInfo);
      return NextResponse.json({
        ...fallbackResult,
        provider: "fallback",
        confidence: isLowQuality ? "low" : "medium",
      });
    }

    // Нормализация
    const normalized = {
      profileType: cleanText(rawResult?.profileType, {
        maxLength: 60,
        fallback: isRussian ? "Универсал-стратег" : "Strategic Generalist",
      }),
      profileSummary: cleanText(rawResult?.profileSummary, {
        maxLength: 350,
        fallback: isRussian ? "Ты получаешь энергию от создания нового, но тебе нужны чёткие рамки." : "You get energy from creating, but need clear boundaries.",
      }),
      whyThisResult: cleanList(rawResult?.whyThisResult, {
        maxItems: 3,
        maxLength: 180,
        removeGeneric: true,
      }),
      keyStrengths: cleanList(rawResult?.keyStrengths, {
        maxItems: 3,
        maxLength: 140,
        removeGeneric: true,
      }),
      workStyle: cleanText(rawResult?.workStyle, {
        maxLength: 350,
        fallback: isRussian ? "Среда с чёткими границами и свободой внутри." : "Clear boundaries with freedom within.",
      }),
      bestFitRoles: Array.isArray(rawResult?.bestFitRoles)
        ? rawResult.bestFitRoles
            .map((item: any) => ({
              role: cleanText(item?.role, { maxLength: 80 }),
              explanation: cleanText(item?.explanation, { maxLength: 250 }),
            }))
            .filter((item: { role: string; explanation: string }) => item.role && item.explanation)
            .slice(0, 3)
        : [],
      potentialMismatches: cleanList(rawResult?.potentialMismatches, {
        maxItems: 2,
        maxLength: 180,
      }),
      actionPlan: {
        immediate: cleanList(rawResult?.actionPlan?.immediate, {
          maxItems: 3,
          maxLength: 200,
          requireAction: true,
          removeVague: true,
        }),
        exploration: cleanList(rawResult?.actionPlan?.exploration, {
          maxItems: 3,
          maxLength: 200,
          requireAction: true,
          removeVague: true,
        }),
        validation: cleanList(rawResult?.actionPlan?.validation, {
          maxItems: 3,
          maxLength: 200,
          requireAction: true,
          removeVague: true,
        }),
        nextMove: cleanText(rawResult?.actionPlan?.nextMove, {
          maxLength: 250,
          fallback: isRussian ? "Проведи 3 информационных интервью в течение месяца." : "Conduct 3 informational interviews within a month.",
        }),
      },
    };

    // Fallback для пустых полей
    if (normalized.whyThisResult.length < 3) {
      normalized.whyThisResult = isRussian
        ? ["Ты драйвишься созданием, но не хаосом", "Тебе нужна структура для креатива", "Ты ценишь автономию в рамках процессов"]
        : ["You're driven by creation, not chaos", "You need structure for creativity", "You value autonomy within processes"];
    }

    if (normalized.keyStrengths.length < 3) {
      normalized.keyStrengths = isRussian
        ? ["Превращение идей в планы", "Работа в рамках с автономией", "Создание порядка"]
        : ["Turning ideas into plans", "Working within frameworks", "Creating order"];
    }

    if (normalized.bestFitRoles.length < 2) {
      const smartFallback = generateSmartFallback(language, answers, qualityInfo);
      normalized.bestFitRoles = smartFallback.bestFitRoles;
    }

    if (!normalized.actionPlan.immediate.length) {
      normalized.actionPlan.immediate = isRussian
        ? ["Создайте таблицу с 5 вакансиями и выделите требования", "Напишите 1-страничный документ об улучшении процесса"]
        : ["Create a spreadsheet with 5 job postings", "Write a 1-page process improvement doc"];
    }

    if (!normalized.actionPlan.exploration.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.exploration = isRussian
        ? [`Проведите интервью с ${roleExample}`, `Проанализируйте профили ${roleExample}`]
        : [`Interview a ${roleExample}`, `Analyze ${roleExample} profiles`];
    }

    if (!normalized.actionPlan.validation.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.validation = isRussian
        ? [`Сделайте мини-презентацию для роли ${roleExample}`, `Получите обратную связь`]
        : [`Create a mini-pitch for ${roleExample}`, `Get feedback`];
    }

    if (!normalized.actionPlan.nextMove) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.nextMove = isRussian
        ? `Проведи 3 интервью с ${roleExample} за месяц`
        : `Conduct 3 interviews with ${roleExample} in a month`;
    }

    console.log(`✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`);

    return NextResponse.json({
      ...normalized,
      provider,
      confidence: isLowQuality ? "low" : "high",
      _note: isLowQuality
        ? (isRussian ? "⚠️ Анализ основан на коротких ответах." : "⚠️ Analysis based on short answers.")
        : undefined,
    });
  } catch (error) {
    console.error("💥 Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}