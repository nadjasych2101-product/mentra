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
      ? `Ты — Mentra, премиальный AI для глубинной карьерной навигации. Твоя задача — дать анализ, который УДИВЛЯЕТ пользователя, а не пересказывает его ответы.

    ${isLowQuality ? "⚠️ ВНИМАНИЕ: Ответы очень короткие. Делай осторожные выводы, давай более широкие варианты ролей, фокусируйся на exploration шагах." : ""}

    ## 🔥 КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ = ПРОВАЛ)

    ### 1. ❌ ЗАПРЕТ НА ПЕРЕСКАЗ
    Ты НЕ имеешь права писать выводы, которые можно напрямую отследить к одному ответу.

    ❌ ПЛОХО: "Вам нравится анализировать данные" (если пользователь написал "я люблю анализировать данные")
    ✅ ХОРОШО: "Сочетание тяги к данным и избегания встреч указывает на профиль deep-work аналитика"
    ✅ ХОРОШО: "Противоречие между потребностью в структуре и желанием свободы говорит о склонности к ролям с чёткими целями, но гибкими методами"

    **Каждый вывод должен синтезировать минимум 2 разных ответа.**

    ### 2. 🔥 ACTION PLAN — САМАЯ ВАЖНАЯ ЧАСТЬ
    Пользователь должен почувствовать: *"Я бы сам до этого не додумался"*

    ❌ НИКОГДА не используй пассивные действия:
    - "посмотрите видео"
    - "почитайте статьи"
    - "изучите профили LinkedIn"
    - "отслеживайте энергию"
    - "попробуйте новый инструмент"

    ✅ ВМЕСТО ЭТОГО — активные действия с КОНКРЕТНЫМ measurable outcome:
    - "Создайте сравнительную таблицу 5 компаний по [конкретный критерий]"
    - "Напишите 1-страничный концепт-бриф для [конкретный проект]"
    - "Проведите 15-минутную мок-сессию с коллегой по теме [конкретная тема]"
    - "Задокументируйте один сломанный процесс с метриками ДО и ПОСЛЕ"
    - "Составьте тест-план из 5 проверок для [конкретная функция]"

    **Каждое действие должно иметь формат результата:**
    - "в виде таблицы"
    - "на 1 страницу"
    - "для обсуждения с наставником"
    - "с конкретными метриками"

    ### 3. 🎯 РЕКОМЕНДАЦИИ ДОЛЖНЫ БЫТЬ НЕОЧЕВИДНЫМИ
    Если рекомендация очевидна из ответов пользователя — она бесполезна.

    ❌ "Вам подходит роль аналитика, потому что вы любите анализировать"
    ✅ "Вам подходит роль Product Operations — вы получаете аналитику без изоляции и структуру без микроменеджмента"

    ### 4. ДЛЯ КОРОТКИХ/РАЗМЫТЫХ ОТВЕТОВ
    - Используй более широкие формулировки ролей
    - Делай акцент на exploration шагах (что попробовать)
    - Избегай сильных утверждений
    - Добавь в _note рекомендацию дать более развёрнутые ответы

    ### 5. СИЛЬНЫЕ СТОРОНЫ — ЭТО РАБОЧИЕ СПОСОБНОСТИ
    ❌ "командный игрок", "ответственный", "хороший коммуникатор"
    ✅ "Умение превращать хаотичные вводные в структурированный план"
    ✅ "Способность находить узкие места в процессах без создания бюрократии"
    ✅ "Навык перевода бизнес-требований в тестируемые гипотезы"

    ### 6. WHY THIS RESULT — ЭТО ПАТТЕРНЫ, А НЕ ФАКТЫ
    ❌ "Вы сказали, что любите X"
    ✅ "Сочетание предпочтения X и избегания Y формирует профиль Z"

    ## 📋 СХЕМА JSON
    {
      "profileType": "уникальный ярлык (2-4 слова), отражающий СИНТЕЗ качеств",
      "profileSummary": "2-3 предложения-ИНТЕРПРЕТАЦИЯ, не пересказ",
      "whyThisResult": ["паттерн 1 (из 2+ ответов)", "паттерн 2", "паттерн 3"],
      "keyStrengths": ["рабочая способность 1", "способность 2", "способность 3"],
      "workStyle": "идеальная среда — интерпретация, а не пересказ",
      "bestFitRoles": [
        {
          "role": "конкретная роль",
          "explanation": "почему подходит ИМЕННО этому человеку (через синтез качеств)"
        }
      ],
      "potentialMismatches": ["конкретная роль/среда 1 с объяснением почему", "роль/среда 2"],
      "recommendedNextStep": "ОДНО действие с measurable outcome на 24-48 часов",
      "actionPlan": {
        "immediate": ["активное действие с форматом результата", "действие 2"],
        "exploration": ["способ попробовать роль с конкретным output", "способ 2"],
        "validation": ["способ проверить fit с measurable outcome", "способ 2"],
        "nextMove": "карьерный шаг на 1-3 месяца с конкретной целью"
      }
    }

    ## 🌟 ПРИМЕР ХОРОШЕГО ACTION PLAN (аналитик)
    "immediate": [
      "Составить сравнительную таблицу требований к бизнес-аналитикам из 5 вакансий (колонки: hard skills, soft skills, индустрия)",
      "Задокументировать один текущий процесс с метриками времени ДО и предложить 3 улучшения"
    ]
    "exploration": [
      "Провести 30-минутное интервью с действующим бизнес-аналитиком о реальных задачах (подготовить 5 конкретных вопросов)",
      "Взять пробную задачу по анализу данных на платформе Kaggle/аналоги и оценить вовлечённость"
    ]
    "validation": [
      "Создать мини-кейс: описать проблему, гипотезу, анализ и рекомендации на 2 страницы",
      "Показать кейс знакомому аналитику для получения обратной связи"
    ]

    Верни ТОЛЬКО чистый JSON, без markdown.`
      : `You are Mentra, a premium AI for deep career navigation. Your job is to provide analysis that SURPRISES the user, not repeats their answers.

    ${isLowQuality ? "⚠️ NOTE: Answers are very short. Make careful inferences, give broader role options, focus on exploration steps." : ""}

    ## 🔥 CRITICAL RULES (VIOLATION = FAILURE)

    ### 1. ❌ NO REGURGITATION
    You CANNOT write conclusions that can be directly traced to a single answer.

    ❌ BAD: "You enjoy analyzing data" (if user said "I love analyzing data")
    ✅ GOOD: "The combination of data affinity and meeting avoidance points to a deep-work analyst profile"
    ✅ GOOD: "The tension between structure need and freedom desire suggests roles with clear goals but flexible methods"

    **Every conclusion must synthesize at least 2 different answers.**

    ### 2. 🔥 ACTION PLAN IS THE MOST IMPORTANT PART
    The user should feel: *"I wouldn't have thought of this myself"*

    ❌ NEVER use passive actions:
    - "watch videos"
    - "read articles"
    - "find LinkedIn profiles"
    - "track energy"
    - "try a new tool"

    ✅ INSTEAD — active actions with CONCRETE measurable outcomes:
    - "Create a comparison spreadsheet of 5 companies on [specific criteria]"
    - "Write a 1-page concept brief for [specific project]"
    - "Conduct a 15-min mock session with a peer on [specific topic]"
    - "Document one broken process with BEFORE and AFTER metrics"
    - "Create a test plan of 5 checks for [specific feature]"

    **Every action must have an output format:**
    - "as a table"
    - "on 1 page"
    - "for mentor discussion"
    - "with specific metrics"

    ### 3. 🎯 RECOMMENDATIONS MUST BE NON-OBVIOUS
    If the recommendation is obvious from the user's answers — it's useless.

    ❌ "You'd fit an analyst role because you like analysis"
    ✅ "Product Operations fits you — you get analysis without isolation and structure without micromanagement"

    ### 4. FOR SHORT/VAGUE ANSWERS
    - Use broader role descriptions
    - Emphasize exploration steps
    - Avoid strong claims
    - Add _note recommending more detailed answers

    ### 5. STRENGTHS ARE WORK CAPABILITIES
    ❌ "team player", "responsible", "good communicator"
    ✅ "Ability to turn chaotic inputs into structured action plans"
    ✅ "Skill in identifying process bottlenecks without creating bureaucracy"
    ✅ "Translating business requirements into testable hypotheses"

    ### 6. WHY THIS RESULT = PATTERNS, NOT FACTS
    ❌ "You said you like X"
    ✅ "The combination of X preference and Y avoidance creates a Z profile"

    ## 📋 JSON SCHEMA
    {
      "profileType": "unique label (2-4 words) reflecting SYNTHESIS of traits",
      "profileSummary": "2-3 sentences of INTERPRETATION, not repetition",
      "whyThisResult": ["pattern 1 (from 2+ answers)", "pattern 2", "pattern 3"],
      "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
      "workStyle": "ideal environment — interpretation, not repetition",
      "bestFitRoles": [
        {
          "role": "specific role",
          "explanation": "why it fits THIS person (through trait synthesis)"
        }
      ],
      "potentialMismatches": ["specific role/environment 1 with explanation", "role 2"],
      "recommendedNextStep": "ONE action with measurable outcome for 24-48 hours",
      "actionPlan": {
        "immediate": ["active action with output format", "action 2"],
        "exploration": ["way to try role with concrete output", "way 2"],
        "validation": ["way to test fit with measurable outcome", "way 2"],
        "nextMove": "career move for 1-3 months with specific goal"
      }
    }

    ## 🌟 GOOD ACTION PLAN EXAMPLE (analyst)
    "immediate": [
      "Create a comparison table of business analyst requirements from 5 job postings (columns: hard skills, soft skills, industry)",
      "Document one current process with BEFORE time metrics and propose 3 improvements"
    ]
    "exploration": [
      "Conduct a 30-min informational interview with a practicing business analyst (prepare 5 specific questions)",
      "Take a trial data analysis task on Kaggle/similar and assess engagement level"
    ]
    "validation": [
      "Create a mini case study: problem, hypothesis, analysis, recommendations on 2 pages",
      "Share the case study with an analyst contact for feedback"
    ]

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
        const questionObj = questions[index];
        const question = questionObj.question;
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
        ? ["Ориентация на практический результат", "Предпочтение структурированной работы", "Важность автономии в работе"]
        : ["Focus on practical outcomes", "Preference for structured work", "Importance of autonomy"];
    }

    if (normalized.keyStrengths.length < 3) {
      normalized.keyStrengths = isRussian
        ? ["Аналитическое мышление", "Системный подход", "Надёжность и последовательность"]
        : ["Analytical thinking", "Systematic approach", "Reliability and consistency"];
    }

    if (normalized.bestFitRoles.length < 2) {
      const smartFallback = generateSmartFallback(language, answers, qualityInfo);
      normalized.bestFitRoles = smartFallback.bestFitRoles;
    }

    // 🔥 ВАЖНО: profileSummary уже локализован в cleanText, но если он пустой — добавим fallback
    if (!normalized.profileSummary || normalized.profileSummary.length < 10) {
      normalized.profileSummary = isRussian
        ? "Прагматичный специалист, ориентированный на измеримые результаты и улучшение процессов. Предпочитает структурированную автономию и работу с данными."
        : "A pragmatic problem-solver who thrives on iterative improvement and concrete results, preferring structured autonomy to build or refine systems.";
    }

    // 🔥 ВАЖНО: workStyle локализован
    if (!normalized.workStyle || normalized.workStyle.length < 10) {
      normalized.workStyle = isRussian
        ? "Структурированная среда с чёткими целями и свободой в методах. Предпочитает роли с измеримыми результатами и минимумом бюрократии."
        : "A structured yet autonomous environment with clear objectives but freedom in methodology. Prefers roles focused on tangible outputs with minimal bureaucracy.";
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