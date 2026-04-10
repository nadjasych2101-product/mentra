import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
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

// ========== DeepSeek Provider ==========
async function callDeepSeek(prompt: string, isRussian: boolean, answersQuality: any) {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("❌ DeepSeek API key not configured");
    return null;
  }

  try {
    console.log("🤖 Calling DeepSeek...");
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const { emptyCount, shortCount, avgLength } = answersQuality;
    const isLowQuality = avgLength < 50 || emptyCount > 3;

    const systemPrompt = isRussian
      ? `Ты — Mentra, премиальный AI для карьерной навигации. Твоя задача — дать персонализированный, конкретный и практически полезный анализ, который нельзя спутать с шаблоном.

${isLowQuality ? "⚠️ ВНИМАНИЕ: Ответы пользователя очень короткие. Будь особенно внимателен к тому, что НЕ сказано. Делай осторожные выводы." : ""}

## 🔥 КРИТИЧЕСКИ ВАЖНО

### 1. Action Plan должен быть УНИКАЛЬНЫМ для каждого профиля
❌ НИКОГДА не используй:
- "запишите задачи", "вспомните моменты", "посмотрите вакансии", "поговорите со специалистом"
- "найти профили на LinkedIn", "посмотреть видео", "отслеживать энергию", "попробовать новый инструмент"

✅ Вместо этого давай КОНКРЕТНЫЕ действия с measurable outcome:
- Для аналитика: "Найдите 3 вакансии бизнес-аналитика и выпишите 5 повторяющихся требований к hard skills"
- Для креатора: "Создайте концепт-бриф на 1 страницу для бренда, который вам нравится"
- Для коммуникатора: "Проведите 15-минутную мок-сессию коучинга по карьерному вопросу"
- Для оператора: "Задокументируйте один сломанный процесс с метриками до/после"

### 2. Why This Result должен отражать ПАТТЕРНЫ, а не общие фразы
❌ Избегай: "ориентация на результат", "важность автономии", "фокус на outcomes"
✅ Пиши: "Явное предпочтение анализа данных встречам" (если это видно из ответов)

### 3. Recommended Next Step — конкретное действие на 24-48 часов
❌ "Research roles in X"
✅ "Найдите 3 вакансии Product Manager и сравните их требования к опыту и навыкам"

### 4. Best Fit Roles должны быть ОБОСНОВАНЫ
Каждая роль должна содержать объяснение, почему она подходит ИМЕННО этому человеку.

### 5. Сильные стороны должны быть РАБОЧИМИ СПОСОБНОСТЯМИ, а не комплиментами
❌ Избегай: "командный игрок", "надёжный", "хороший коммуникатор"
✅ Пиши: "Выявление закономерностей в сложных данных", "Оптимизация процессов без бюрократии", "Превращение неопределённости в план действий"

### 6. Action Plan НЕ должен быть шаблонным
Каждое действие должно давать пользователю ощущение: "Я это сделал, и у меня есть конкретный результат".

## 📋 СХЕМА JSON
{
  "profileType": "короткий уникальный ярлык (2-4 слова)",
  "profileSummary": "2-3 предложения, отражающих СУТЬ профиля",
  "whyThisResult": ["конкретная причина 1", "причина 2", "причина 3"],
  "keyStrengths": ["конкретная рабочая способность 1", "способность 2", "способность 3"],
  "workStyle": "детальное описание идеальной среды",
  "bestFitRoles": [
    {"role": "конкретная роль", "explanation": "почему подходит именно этому человеку"}
  ],
  "potentialMismatches": ["конкретный тип роли/среды 1", "тип 2"],
  "recommendedNextStep": "ОДНО максимально конкретное действие на 24-48 часов",
  "actionPlan": {
    "immediate": ["действие с measurable outcome", "действие 2"],
    "exploration": ["способ попробовать роль", "способ 2"],
    "validation": ["способ проверить fit", "способ 2"],
    "nextMove": "карьерный шаг на 1-3 месяца"
  }
}

Верни ТОЛЬКО чистый JSON, без markdown.`
      : `You are Mentra, a premium AI for career navigation. Your job is to provide personalized, specific, and practically useful analysis.

${isLowQuality ? "⚠️ NOTE: User answers are very short. Make careful inferences." : ""}

## 🔥 CRITICAL RULES

### 1. Action Plan must be UNIQUE for each profile
❌ NEVER use: "write down tasks", "recall moments", "find LinkedIn profiles", "watch videos", "track energy", "try new tool"

✅ Give SPECIFIC actions with measurable outcomes:
- For analyst: "Find 3 business analyst job descriptions and list 5 recurring hard skill requirements"
- For creative: "Create a 1-page concept brief for a brand you like"
- For communicator: "Conduct a 15-minute mock coaching session on a career topic"
- For operator: "Document one broken process with before/after metrics"

### 2. Why This Result must reflect PATTERNS, not generic phrases
❌ Avoid: "focus on outcomes", "importance of autonomy"
✅ Write: "Clear preference for data analysis over meetings"

### 3. Recommended Next Step — concrete action for 24-48 hours
✅ "Find 3 Product Manager job descriptions and compare requirements"

### 4. Best Fit Roles must be JUSTIFIED
Explain why each role fits THIS person specifically.

### 5. Strengths must be WORK CAPABILITIES, not compliments
❌ Avoid: "collaborative team member", "reliable", "good communicator"
✅ Write: "Pattern recognition in complex data", "Process optimization without bureaucracy", "Translating ambiguity into action plans"

### 6. Action Plan must NOT be templated
Each action should make the user feel: "I did this, and now I have a concrete output."

## 📋 JSON SCHEMA
{
  "profileType": "short unique label (2-4 words)",
  "profileSummary": "2-3 sentences capturing the ESSENCE",
  "whyThisResult": ["specific reason 1", "reason 2", "reason 3"],
  "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
  "workStyle": "detailed ideal environment",
  "bestFitRoles": [
    {"role": "specific role", "explanation": "why it fits THIS person"}
  ],
  "potentialMismatches": ["specific mismatch 1", "mismatch 2"],
  "recommendedNextStep": "ONE specific action for 24-48 hours",
  "actionPlan": {
    "immediate": ["action with measurable outcome", "action 2"],
    "exploration": ["way to try the role", "way 2"],
    "validation": ["way to test fit", "way 2"],
    "nextMove": "career move for 1-3 months"
  }
}

Return ONLY clean JSON, no markdown.`;

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

// ========== Gemini Provider (Fallback) ==========
async function tryGemini(prompt: string) {
  if (!process.env.GEMINI_API_KEY) {
    console.log("❌ Gemini API key not configured");
    return null;
  }

  try {
    console.log("🤖 Trying Gemini (fallback)...");
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

    for (const model of models) {
      try {
        console.log(`  Trying ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.85,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2500,
          },
        });

        const text = response.text;
        if (!text) continue;

        const result = JSON.parse(text);
        console.log(`✅ Gemini succeeded with ${model}`);
        return { result, isLowQuality: false };
      } catch (e: any) {
        if (e?.status === 429 || e?.message?.includes("quota")) {
          console.warn("❌ Gemini quota exceeded");
          return null;
        }
        continue;
      }
    }

    console.warn("❌ All Gemini models failed");
    return null;
  } catch (error) {
    console.warn("❌ Gemini failed:", error instanceof Error ? error.message : error);
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
  const hasStructure = /struct|структур|порядок|организ|process|процесс|predict/i.test(allText);
  const hasAutonomy = /autonom|автоном|свобод|независим|flexib|гибк/i.test(allText);
  const avoidsMeetings = /meeting|встреч|coordination|координац/i.test(allText);
  const avoidsRoutine = /routin|рутин|repetitive|повтор/i.test(allText);
  const avoidsChaos = /chaos|хаос|uncertain|неопредел/i.test(allText);

  let profileType = "";
  let roles: Array<{ role: string; explanation: string }> = [];

  if (hasAnalysis && hasStructure && avoidsMeetings) {
    profileType = isRussian ? "Аналитик-оптимизатор" : "Analytical Optimizer";
    roles = [
      { role: isRussian ? "Бизнес-аналитик" : "Business Analyst", explanation: isRussian ? "Анализ процессов и поиск точек роста" : "Process analysis and improvement identification" },
      { role: isRussian ? "Системный аналитик" : "Systems Analyst", explanation: isRussian ? "Оптимизация сложных систем" : "Complex systems optimization" },
    ];
  } else if (hasPeople && hasCreate) {
    profileType = isRussian ? "Креативный коммуникатор" : "Creative Communicator";
    roles = [
      { role: isRussian ? "Креативный стратег" : "Creative Strategist", explanation: isRussian ? "Разработка концепций и работа с людьми" : "Concept development and people work" },
      { role: isRussian ? "Community Manager" : "Community Manager", explanation: isRussian ? "Построение и поддержка сообществ" : "Building and supporting communities" },
    ];
  } else if (hasPeople && !hasCreate) {
    profileType = isRussian ? "Коммуникатор-поддержка" : "Supportive Communicator";
    roles = [
      { role: isRussian ? "Customer Success Manager" : "Customer Success Manager", explanation: isRussian ? "Помощь клиентам в достижении целей" : "Helping clients achieve goals" },
      { role: isRussian ? "Карьерный коуч" : "Career Coach", explanation: isRussian ? "Поддержка людей в развитии" : "Supporting people's development" },
    ];
  } else if (hasCreate && hasAutonomy) {
    profileType = isRussian ? "Независимый творец" : "Independent Creator";
    roles = [
      { role: isRussian ? "Концепт-разработчик" : "Concept Developer", explanation: isRussian ? "Создание идей с автономией" : "Creating ideas with autonomy" },
      { role: isRussian ? "Бренд-стратег" : "Brand Strategist", explanation: isRussian ? "Разработка стратегии бренда" : "Brand strategy development" },
    ];
  } else if (hasStructure && avoidsChaos) {
    profileType = isRussian ? "Процессный организатор" : "Process Organizer";
    roles = [
      { role: isRussian ? "Операционный менеджер" : "Operations Manager", explanation: isRussian ? "Наведение порядка в процессах" : "Bringing order to processes" },
      { role: isRussian ? "Координатор проектов" : "Project Coordinator", explanation: isRussian ? "Структурирование проектной работы" : "Structuring project work" },
    ];
  } else {
    profileType = isRussian ? "Универсал-практик" : "Practical Generalist";
    roles = [
      { role: isRussian ? "Специалист по улучшениям" : "Improvement Specialist", explanation: isRussian ? "Оптимизация существующих процессов" : "Optimizing existing processes" },
      { role: isRussian ? "Координатор" : "Coordinator", explanation: isRussian ? "Организация и контроль задач" : "Task organization and control" },
    ];
  }

  const roleExample = roles[0]?.role || (isRussian ? "специалист" : "specialist");

  return {
    profileType,
    profileSummary: isRussian
      ? `Вы ${hasStructure ? "цените порядок и " : ""}${hasAutonomy ? "предпочитаете самостоятельность" : "ориентированы на практический результат"}. ${hasAnalysis ? "Склонны к анализу." : ""} ${avoidsMeetings ? "Избегаете излишних встреч." : ""}`
      : `You ${hasStructure ? "value structure and " : ""}${hasAutonomy ? "prefer autonomy" : "are practically oriented"}. ${hasAnalysis ? "Tend toward analysis." : ""} ${avoidsMeetings ? "Avoid excessive meetings." : ""}`,

    whyThisResult: isRussian
      ? [
          hasAnalysis ? "Склонность к анализу информации" : "Практический подход к задачам",
          hasStructure ? "Потребность в структуре" : (avoidsChaos ? "Избегание хаоса" : "Ориентация на результат"),
          hasPeople ? "Важность взаимодействия" : (avoidsMeetings ? "Предпочтение глубокой работы" : "Фокус на задачах"),
        ]
      : [
          hasAnalysis ? "Analytical inclination" : "Practical approach",
          hasStructure ? "Need for structure" : (avoidsChaos ? "Avoidance of chaos" : "Focus on outcomes"),
          hasPeople ? "Importance of interaction" : (avoidsMeetings ? "Preference for deep work" : "Task focus"),
        ],

    keyStrengths: isRussian
      ? [
          hasAnalysis ? "Аналитическое мышление" : "Системный подход",
          hasStructure ? "Организационные способности" : "Адаптивность",
          hasPeople ? "Эмпатия и коммуникация" : (hasCreate ? "Креативное мышление" : "Надёжность"),
        ]
      : [
          hasAnalysis ? "Analytical thinking" : "Systematic approach",
          hasStructure ? "Organizational skills" : "Adaptability",
          hasPeople ? "Empathy and communication" : (hasCreate ? "Creative thinking" : "Reliability"),
        ],

    workStyle: isRussian
      ? `Идеальная среда: ${hasStructure ? "чёткие процессы" : "гибкость"}${hasAutonomy ? " с автономией" : ""}${avoidsMeetings ? ", минимум встреч" : ""}${hasPeople ? ", взаимодействие с людьми" : ", фокус на задачах"}.`
      : `Ideal environment: ${hasStructure ? "clear processes" : "flexibility"}${hasAutonomy ? " with autonomy" : ""}${avoidsMeetings ? ", minimal meetings" : ""}${hasPeople ? ", people interaction" : ", task focus"}.`,

    bestFitRoles: roles,

    potentialMismatches: isRussian
      ? [
          avoidsMeetings ? "Роли с большим количеством встреч" : (hasStructure ? "Хаотичные среды" : "Жёстко регламентированные позиции"),
          avoidsRoutine ? "Монотонная работа" : (hasPeople ? "Изолированная работа" : "Постоянные переключения"),
        ]
      : [
          avoidsMeetings ? "Meeting-heavy roles" : (hasStructure ? "Chaotic environments" : "Highly regimented positions"),
          avoidsRoutine ? "Monotonous work" : (hasPeople ? "Isolated work" : "Constant context switching"),
        ],

    recommendedNextStep: isRussian
      ? (hasAnalysis
          ? "Найдите 3 вакансии бизнес-аналитика и выпишите 5 требований к навыкам"
          : hasCreate
            ? "Создайте мини-концепцию для бренда (2-3 слайда)"
            : hasPeople
              ? "Проведите 1 информационное интервью"
              : "Составьте список из 5 задач, которые принесли удовлетворение")
      : (hasAnalysis
          ? "Find 3 business analyst job descriptions and list 5 skill requirements"
          : hasCreate
            ? "Create a mini-concept for a brand (2-3 slides)"
            : hasPeople
              ? "Conduct 1 informational interview"
              : "List 5 tasks that brought satisfaction"),

    actionPlan: {
      immediate: isRussian
        ? [
            hasAnalysis ? "Выпишите 3 процесса для улучшения" : "Определите 2 типа задач, дающих энергию",
            hasCreate ? "Набросайте 3 идеи для улучшения продукта" : "Запланируйте эксперимент в текущей работе",
          ]
        : [
            hasAnalysis ? "List 3 processes to improve" : "Identify 2 energizing task types",
            hasCreate ? "Sketch 3 product improvement ideas" : "Plan one work experiment",
          ],
      exploration: isRussian
        ? [
            `Проанализируйте 2-3 профиля "${roleExample}" на LinkedIn`,
            `Изучите 2 статьи о рабочем дне ${roleExample}`,
          ]
        : [
            `Analyze 2-3 "${roleExample}" LinkedIn profiles`,
            `Read 2 articles about a ${roleExample} workday`,
          ],
      validation: isRussian
        ? [
            "Отслеживайте энергию от задач 3 дня",
            "Попробуйте новый метод работы на неделю",
          ]
        : [
            "Track task energy for 3 days",
            "Try a new work method for a week",
          ],
      nextMove: isRussian
        ? (isLowQuality
            ? "Дайте более развёрнутые ответы для точного анализа"
            : `Изучите роль "${roleExample}" в течение месяца`)
        : (isLowQuality
            ? "Provide more detailed answers"
            : `Explore the "${roleExample}" role over the next month`),
    },

    _note: isLowQuality
      ? (isRussian
          ? "⚠️ Анализ основан на коротких ответах. Для более точного результата дайте более развёрнутые ответы."
          : "⚠️ Analysis based on short answers. Provide more detailed answers for a more accurate result.")
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
    const mixedLangCount = answersQuality.filter((q) => !q.isEmpty && q.detectedLang !== language).length;
    const avgLength = answers.reduce((sum, a) => sum + a.length, 0) / answers.length;

    const qualityInfo = { emptyCount, shortCount, mixedLangCount, avgLength };
    const isLowQuality = avgLength < 50 || emptyCount > 3;

    console.log(`📊 Quality: ${emptyCount} empty, ${shortCount} short, avg length: ${Math.round(avgLength)}`);

    const formattedAnswersWithQuestions = answers
      .map((answer, index) => {
        const question = questions[index];
        const quality = answersQuality[index];
        let note = "";
        if (quality.isEmpty) note = " [EMPTY]";
        else if (quality.isShort) note = " [VERY SHORT]";
        if (quality.detectedLang !== language && !quality.isEmpty) {
          note += ` [ANSWERED IN ${quality.detectedLang.toUpperCase()}]`;
        }
        return `Q${index + 1}: ${question}\nA${index + 1}: ${answer || "(no answer)"}${note}`;
      })
      .join("\n\n");

    const qualityNote = isRussian
      ? `\n${isLowQuality ? "⚠️ ВНИМАНИЕ: Ответы очень короткие.\n" : ""}`
      : `\n${isLowQuality ? "⚠️ NOTE: Answers are very short.\n" : ""}`;

    const prompt = isRussian
      ? `${qualityNote}\nПроанализируй ответы и верни JSON по схеме.\n\n${formattedAnswersWithQuestions}`
      : `${qualityNote}\nAnalyze answers and return JSON per schema.\n\n${formattedAnswersWithQuestions}`;

    let rawResult: any = null;
    let provider = "fallback";
    let responseIsLowQuality = isLowQuality;

    // 1. DeepSeek
    const deepseekResponse = await callDeepSeek(prompt, isRussian, qualityInfo);
    if (deepseekResponse) {
      rawResult = deepseekResponse.result;
      responseIsLowQuality = deepseekResponse.isLowQuality;
      provider = "deepseek";
    }

    // 2. Gemini fallback
    if (!rawResult) {
      const geminiResponse = await tryGemini(prompt);
      if (geminiResponse) {
        rawResult = geminiResponse.result;
        provider = "gemini";
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

    // Нормализация результата
    const normalized = {
      profileType: cleanText(rawResult?.profileType, {
        maxLength: 50,
        fallback: isRussian ? "Рабочий профиль" : "Work Profile",
      }),

      profileSummary: cleanText(rawResult?.profileSummary, {
        maxLength: 350,
        fallback: isRussian ? "Есть несколько устойчивых рабочих паттернов." : "There are some visible work patterns.",
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
        fallback: isRussian ? "Комфортная среда с понятными ожиданиями." : "Comfortable environment with clear expectations.",
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
          fallback: isRussian ? "Выберите направление и протестируйте его." : "Choose a direction and test it.",
        }),
      },
    };

    // Fallback для пустых полей
    if (normalized.whyThisResult.length < 3) {
      normalized.whyThisResult = isRussian
        ? ["Ориентация на практический результат", "Предпочтение структурированной работы", "Важность автономии"]
        : ["Focus on practical outcomes", "Preference for structured work", "Importance of autonomy"];
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
        ? ["Определите 2 типа задач, которые дают вам энергию", "Запланируйте эксперимент в текущей работе"]
        : ["Identify 2 types of tasks that energize you", "Plan an experiment in your current work"];
    }

    if (!normalized.actionPlan.exploration.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.exploration = isRussian
        ? [
            `Проанализируйте 2-3 профиля "${roleExample}" на LinkedIn`,
            `Изучите 1-2 статьи о рабочем дне ${roleExample}`,
          ]
        : [
            `Analyze 2-3 "${roleExample}" LinkedIn profiles`,
            `Read 1-2 articles about a ${roleExample} workday`,
          ];
    }

    if (!normalized.actionPlan.validation.length) {
      normalized.actionPlan.validation = isRussian
        ? [
            "Отслеживайте энергию от задач в течение 3 дней",
            "Попробуйте новый подход к работе на неделю",
          ]
        : [
            "Track task energy for 3 days",
            "Try a new work approach for a week",
          ];
    }

    if (!normalized.actionPlan.nextMove) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.nextMove = isRussian
        ? `Сфокусируйтесь на изучении роли "${roleExample}" в течение месяца`
        : `Focus on exploring the "${roleExample}" role over the next month`;
    }

    console.log(`✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`);

    return NextResponse.json({
      ...normalized,
      provider,
      confidence: responseIsLowQuality ? "low" : "high",
      _note: responseIsLowQuality
        ? (isRussian
            ? "⚠️ Анализ основан на коротких ответах. Для более точного результата дайте более развёрнутые ответы."
            : "⚠️ Analysis based on short answers. Provide more detailed answers for a more accurate result.")
        : undefined,
    });
  } catch (error) {
    console.error("💥 Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}