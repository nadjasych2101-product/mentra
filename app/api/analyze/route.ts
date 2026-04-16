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
    ? "⚠️ ВНИМАНИЕ: Ответы очень короткие. Делай осторожные выводы, давай более широкие варианты ролей, фокусируйся на exploration шагах."
    : "⚠️ NOTE: Answers are very short. Make careful inferences, give broader role options, focus on exploration steps.";

  return isRussian
    ? `Ты — Mentra, премиальный AI для глубинной карьерной навигации. Твоя задача — дать анализ, который УДИВЛЯЕТ пользователя, а не пересказывает его ответы.

${isLowQuality ? lowQualityNote : ""}

## 🔥 КРИТИЧЕСКИЕ ПРАВИЛА

### 1. ❌ ЗАПРЕТ НА ПЕРЕСКАЗ
Каждый вывод должен синтезировать минимум 2 разных ответа.

### 2. 🔥 ACTION PLAN — САМАЯ ВАЖНАЯ ЧАСТЬ
❌ НИКОГДА не используй пассивные действия: "посмотрите видео", "почитайте статьи", "изучите профили LinkedIn"
✅ ВМЕСТО ЭТОГО — активные действия с КОНКРЕТНЫМ measurable outcome:
- "Создайте сравнительную таблицу 5 компаний по [критерий]"
- "Напишите 1-страничный концепт-бриф для [проект]"
- "Проведите 15-минутную мок-сессию с коллегой по теме [тема]"

### 3. 🎯 РЕКОМЕНДАЦИИ ДОЛЖНЫ БЫТЬ НЕОЧЕВИДНЫМИ
❌ "Вам подходит роль аналитика, потому что вы любите анализировать"
✅ "Вам подходит роль Product Operations — вы получаете аналитику без изоляции и структуру без микроменеджмента"

### 4. СИЛЬНЫЕ СТОРОНЫ — ЭТО РАБОЧИЕ СПОСОБНОСТИ
❌ "командный игрок", "ответственный", "хороший коммуникатор"
✅ "Умение превращать хаотичные вводные в структурированный план"

Верни ТОЛЬКО чистый JSON:
{
  "profileType": "уникальный ярлык (2-4 слова)",
  "profileSummary": "2-3 предложения-ИНТЕРПРЕТАЦИЯ",
  "whyThisResult": ["паттерн 1", "паттерн 2", "паттерн 3"],
  "keyStrengths": ["рабочая способность 1", "способность 2", "способность 3"],
  "workStyle": "идеальная среда — интерпретация",
  "bestFitRoles": [{"role": "роль", "explanation": "почему подходит"}],
  "potentialMismatches": ["роль/среда 1", "роль/среда 2"],
  "recommendedNextStep": "ОДНО действие с measurable outcome на 24-48 часов",
  "actionPlan": {
    "immediate": ["активное действие с форматом результата", "действие 2"],
    "exploration": ["способ попробовать роль с output", "способ 2"],
    "validation": ["способ проверить fit", "способ 2"],
    "nextMove": "карьерный шаг на 1-3 месяца"
  }
}`
    : `You are Mentra, a premium AI for deep career navigation. Provide analysis that SURPRISES the user.

${isLowQuality ? lowQualityNote : ""}

## 🔥 CRITICAL RULES

### 1. ❌ NO REGURGITATION
Every conclusion must synthesize at least 2 different answers.

### 2. 🔥 ACTION PLAN IS THE MOST IMPORTANT PART
❌ NEVER use passive actions: "watch videos", "read articles", "find LinkedIn profiles"
✅ INSTEAD — active actions with CONCRETE measurable outcomes:
- "Create a comparison spreadsheet of 5 companies on [criteria]"
- "Write a 1-page concept brief for [project]"
- "Conduct a 15-min mock session with a peer on [topic]"

### 3. 🎯 RECOMMENDATIONS MUST BE NON-OBVIOUS
❌ "You'd fit an analyst role because you like analysis"
✅ "Product Operations fits you — analysis without isolation, structure without micromanagement"

### 4. STRENGTHS ARE WORK CAPABILITIES
❌ "team player", "responsible", "good communicator"
✅ "Ability to turn chaotic inputs into structured action plans"

Return ONLY clean JSON:
{
  "profileType": "unique label (2-4 words)",
  "profileSummary": "2-3 sentences of INTERPRETATION",
  "whyThisResult": ["pattern 1", "pattern 2", "pattern 3"],
  "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
  "workStyle": "ideal environment",
  "bestFitRoles": [{"role": "role", "explanation": "why it fits"}],
  "potentialMismatches": ["role/environment 1", "role/environment 2"],
  "recommendedNextStep": "ONE action with measurable outcome",
  "actionPlan": {
    "immediate": ["active action with output format", "action 2"],
    "exploration": ["way to try role with output", "way 2"],
    "validation": ["way to test fit", "way 2"],
    "nextMove": "career move for 1-3 months"
  }
}`;
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
      temperature: 0.85,
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
      temperature: 0.85,
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
  const avoidsMeetings = /meeting|встреч|coordination|координац/i.test(allText);

  let profileType = "";
  let roles: Array<{ role: string; explanation: string }> = [];

  if (hasAnalysis && hasStructure && avoidsMeetings) {
    profileType = isRussian ? "Аналитик-оптимизатор" : "Analytical Optimizer";
    roles = [
      { role: isRussian ? "Бизнес-аналитик" : "Business Analyst", explanation: isRussian ? "Анализ процессов и поиск точек роста" : "Process analysis and improvement" },
      { role: isRussian ? "Системный аналитик" : "Systems Analyst", explanation: isRussian ? "Оптимизация сложных систем" : "Complex systems optimization" },
    ];
  } else if (hasPeople && hasCreate) {
    profileType = isRussian ? "Креативный коммуникатор" : "Creative Communicator";
    roles = [
      { role: isRussian ? "Креативный стратег" : "Creative Strategist", explanation: isRussian ? "Разработка концепций и работа с людьми" : "Concept development and people work" },
      { role: isRussian ? "Community Manager" : "Community Manager", explanation: isRussian ? "Построение сообществ" : "Community building" },
    ];
  } else if (hasPeople && !hasCreate) {
    profileType = isRussian ? "Коммуникатор-поддержка" : "Supportive Communicator";
    roles = [
      { role: isRussian ? "Customer Success" : "Customer Success", explanation: isRussian ? "Помощь клиентам" : "Helping clients" },
      { role: isRussian ? "Карьерный коуч" : "Career Coach", explanation: isRussian ? "Поддержка в развитии" : "Development support" },
    ];
  } else if (hasCreate && hasAutonomy) {
    profileType = isRussian ? "Независимый творец" : "Independent Creator";
    roles = [
      { role: isRussian ? "Концепт-разработчик" : "Concept Developer", explanation: isRussian ? "Создание идей с автономией" : "Creating with autonomy" },
      { role: isRussian ? "Бренд-стратег" : "Brand Strategist", explanation: isRussian ? "Разработка стратегии" : "Strategy development" },
    ];
  } else {
    profileType = isRussian ? "Универсал-практик" : "Practical Generalist";
    roles = [
      { role: isRussian ? "Специалист по улучшениям" : "Improvement Specialist", explanation: isRussian ? "Оптимизация процессов" : "Process optimization" },
      { role: isRussian ? "Координатор" : "Coordinator", explanation: isRussian ? "Организация задач" : "Task organization" },
    ];
  }

  const roleExample = roles[0]?.role || (isRussian ? "специалист" : "specialist");

  return {
    profileType,
    profileSummary: isRussian
      ? `Вы ${hasStructure ? "цените порядок" : "ориентированы на результат"}. ${hasAnalysis ? "Склонны к анализу." : ""}`
      : `You ${hasStructure ? "value structure" : "are result-oriented"}. ${hasAnalysis ? "Tend toward analysis." : ""}`,
    whyThisResult: isRussian
      ? ["Практический подход", "Ориентация на результат", "Избегание хаоса"]
      : ["Practical approach", "Focus on outcomes", "Avoidance of chaos"],
    keyStrengths: isRussian
      ? ["Аналитическое мышление", "Системный подход", "Надёжность"]
      : ["Analytical thinking", "Systematic approach", "Reliability"],
    workStyle: isRussian
      ? `Среда с ${hasStructure ? "чёткой структурой" : "гибкостью"} и автономией.`
      : `Environment with ${hasStructure ? "clear structure" : "flexibility"} and autonomy.`,
    bestFitRoles: roles,
    potentialMismatches: isRussian
      ? ["Хаотичные среды", "Монотонная работа"]
      : ["Chaotic environments", "Monotonous work"],
    recommendedNextStep: isRussian
      ? "Составьте список из 5 задач, которые приносят удовлетворение."
      : "List 5 tasks that bring satisfaction.",
    actionPlan: {
      immediate: isRussian
        ? ["Определите 2 типа задач, дающих энергию", "Запланируйте эксперимент"]
        : ["Identify 2 energizing task types", "Plan an experiment"],
      exploration: isRussian
        ? [`Проанализируйте профили "${roleExample}" на LinkedIn`, `Изучите рабочий день ${roleExample}`]
        : [`Analyze "${roleExample}" LinkedIn profiles`, `Study ${roleExample} workday`],
      validation: isRussian
        ? ["Отслеживайте энергию 3 дня", "Попробуйте новый подход"]
        : ["Track energy for 3 days", "Try a new approach"],
      nextMove: isRussian
        ? `Изучите роль "${roleExample}" в течение месяца`
        : `Explore "${roleExample}" role over the next month`,
    },
    _note: isLowQuality
      ? (isRussian
          ? "⚠️ Анализ основан на коротких ответах."
          : "⚠️ Analysis based on short answers.")
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
        maxLength: 50,
        fallback: isRussian ? "Рабочий профиль" : "Work Profile",
      }),
      profileSummary: cleanText(rawResult?.profileSummary, {
        maxLength: 350,
        fallback: isRussian ? "Анализ на основе ответов." : "Analysis based on answers.",
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
        fallback: isRussian ? "Комфортная среда с понятными ожиданиями." : "Comfortable environment.",
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
      recommendedNextStep: cleanText(rawResult?.recommendedNextStep, {
        maxLength: 250,
        fallback: isRussian ? "Составьте список задач, которые приносили удовлетворение." : "List tasks that brought satisfaction.",
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
          fallback: isRussian ? "Выберите направление и протестируйте." : "Choose a direction and test it.",
        }),
      },
    };

    // Fallback для пустых полей
    if (normalized.whyThisResult.length < 3) {
      normalized.whyThisResult = isRussian
        ? ["Ориентация на результат", "Предпочтение структуры", "Важность автономии"]
        : ["Focus on outcomes", "Preference for structure", "Importance of autonomy"];
    }

    if (normalized.keyStrengths.length < 3) {
      normalized.keyStrengths = isRussian
        ? ["Аналитическое мышление", "Системный подход", "Надёжность"]
        : ["Analytical thinking", "Systematic approach", "Reliability"];
    }

    if (normalized.bestFitRoles.length < 2) {
      const smartFallback = generateSmartFallback(language, answers, qualityInfo);
      normalized.bestFitRoles = smartFallback.bestFitRoles;
    }

    if (!normalized.actionPlan.immediate.length) {
      normalized.actionPlan.immediate = isRussian
        ? ["Определите 2 типа задач, дающих энергию", "Запланируйте эксперимент"]
        : ["Identify 2 energizing task types", "Plan an experiment"];
    }

    if (!normalized.actionPlan.exploration.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.exploration = isRussian
        ? [`Проанализируйте профили "${roleExample}" на LinkedIn`, `Изучите рабочий день ${roleExample}`]
        : [`Analyze "${roleExample}" LinkedIn profiles`, `Study ${roleExample} workday`];
    }

    if (!normalized.actionPlan.validation.length) {
      normalized.actionPlan.validation = isRussian
        ? ["Отслеживайте энергию 3 дня", "Попробуйте новый подход"]
        : ["Track energy for 3 days", "Try a new approach"];
    }

    if (!normalized.actionPlan.nextMove) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.nextMove = isRussian
        ? `Изучите роль "${roleExample}" в течение месяца`
        : `Explore "${roleExample}" role over the next month`;
    }

    console.log(`✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`);

    return NextResponse.json({
      ...normalized,
      provider,
      confidence: isLowQuality ? "low" : "high",
      _note: isLowQuality
        ? (isRussian
            ? "⚠️ Анализ основан на коротких ответах."
            : "⚠️ Analysis based on short answers.")
        : undefined,
    });
  } catch (error) {
    console.error("💥 Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}