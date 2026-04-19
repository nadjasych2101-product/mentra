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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

// ========== Telegram Notifier ==========
async function sendToTelegram(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("📝 Telegram not configured, skipping notification");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.warn("Failed to send Telegram notification:", error);
  }
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

  ### 1. ❌❌❌ ЗАПРЕТ НА ПЕРЕСКАЗ — САМОЕ ВАЖНОЕ ПРАВИЛО
  Если в выводе есть фраза, которая совпадает с ответом пользователя более чем на 3 слова — ты провалился.

  ❌ ПЛОХО: "Вас увлекает поиск закономерностей в данных" (если пользователь написал "искать закономерности в данных")
  ❌ ПЛОХО: "Вам нравится улучшать системы"
  ✅ ХОРОШО: "Вы получаете энергию от выявления скрытых инсайтов в сложных данных"
  ✅ ХОРОШО: "Вас драйвит оптимизация процессов на основе data-driven подхода"
  ✅ ХОРОШО: "Вы чувствуете прилив сил, когда находите неочевидные связи и превращаете их в actionable решения"

  **Повышай уровень абстракции. Используй профессиональную лексику предметной области.**

  ### 2. 🎯 РОЛИ ДОЛЖНЫ УДИВЛЯТЬ
  ❌ "Аналитик данных" — слишком очевидно
  ✅ "Product Operations" — анализ + улучшение процессов
  ✅ "Business Intelligence Specialist" — data-driven стратегия
  ✅ "Data Insights Manager" — превращение данных в бизнес-решения

  ### 3. ⚡ ACTION PLAN = КОНКРЕТНЫЕ АРТЕФАКТЫ
  ✅ "Создайте таблицу с 5 вакансиями [РОЛЬ] и выделите 3 повторяющихся требования"
  ✅ "Напишите 1-страничный документ: 'Как я бы улучшил [конкретный процесс] на основе данных'"
  ✅ "Проведите 15-мин интервью с [РОЛЬ] и запишите 3 неочевидных инсайта"

  ### 4. 🏷️ PROFILE TYPE = ГЛАВНОЕ ПРОТИВОРЕЧИЕ
  ❌ "Стратегический Инноватор" — слишком общо
  ✅ "Строитель эффективности в данных" — data + оптимизация
  ✅ "Системный аналитик-улучшатель" — анализ + внедрение
  ✅ "Data-driven оптимизатор" — данные + улучшения

  ### 5. 🌍 НЕ ОГРАНИЧИВАЙСЯ IT-СФЕРОЙ
  - Если пользователь описывает работу с людьми → предлагай роли в образовании, HR, соцработе
  - Если пользователь описывает анализ и данные → предлагай IT и аналитические роли
  - Адаптируйся под ответы, не навязывай одну сферу

  ### 6. 💪 STRENGTHS — УНИКАЛЬНЫЕ ДЛЯ ЭТОГО ПРОФИЛЯ
  ❌ "креативное решение проблем", "самомотивация" — слишком обще
  ✅ "Превращение размытых брифов в структурированные планы"
  ✅ "Умение объяснять сложные концепции простыми словами"
  ✅ "Выявление скрытых инсайтов в хаотичных данных"

  ### 7. 📚 SKILLS TO DEVELOP — СПЕЦИФИЧНЫЕ ДЛЯ РОЛИ
  Для IT/аналитики:
  - "SQL и работа с базами данных"
  - "Визуализация данных (Tableau/Power BI/Looker)"
  - "A/B тестирование и статистический анализ"
  - "Python для анализа данных (pandas, numpy)"

  Для работы с людьми:
  - "Фасилитация и модерация групп"
  - "Коучинговые техники"
  - "Проектирование образовательных программ"

  **Выбирай навыки, релевантные предложенным ролям.**

  ### 8. 📋 СХЕМА JSON
  {
    "profileType": "главное противоречие (2-4 слова)",
    "profileSummary": "2-3 предложения-ИНТЕРПРЕТАЦИЯ, НЕ ПЕРЕСКАЗ",
    "whyThisResult": ["переформулированный паттерн 1", "паттерн 2", "паттерн 3"],
    "keyStrengths": ["рабочая способность 1", "способность 2", "способность 3"],
    "workStyle": "идеальная среда — интерпретация",
    "bestFitRoles": [
      {"role": "НЕОЧЕВИДНАЯ роль", "explanation": "почему подходит именно этому человеку"}
    ],
    "potentialMismatches": ["роль/среда 1 с объяснением", "роль/среда 2 с объяснением"],
    "actionPlan": {
      "immediate": ["действие → КОНКРЕТНЫЙ АРТЕФАКТ", "действие 2 → АРТЕФАКТ"],
      "exploration": ["способ попробовать → АРТЕФАКТ", "способ 2 → АРТЕФАКТ"],
      "validation": ["способ проверить → АРТЕФАКТ", "способ 2 → АРТЕФАКТ"],
      "skillsToDevelop": [
        {"skill": "конкретный навык для этой роли", "why": "почему важен", "howToLearn": "с чего начать"}
      ],
      "nextMove": "конкретное действие с дедлайном"
    }
  }

  ### 9. 🔥 NEXT MOVE — КОНКРЕТНОЕ ДЕЙСТВИЕ С ДЕДЛАЙНОМ
  ❌ "Изучить роли", "Посмотреть вакансии"
  ✅ "Откликнуться на 3 вакансии в течение 7 дней"
  ✅ "Провести 2 информационных интервью на этой неделе"

  Верни ТОЛЬКО чистый JSON.`
    : `You are Mentra, a premium AI for career navigation. Your goal: SURPRISE with non-obvious but accurate insights.

    ${isLowQuality ? lowQualityNote : ""}

    ## 🔥🔥🔥 CRITICAL RULES (VIOLATION = FAILURE)

    ### 1. ❌❌❌ ABSOLUTE NO REGURGITATION
    If output shares 3+ consecutive words with user's answer — you failed.

    ❌ BAD: "You enjoy finding patterns in data" (if user said "finding patterns in data")
    ❌ BAD: "You like improving systems"
    ✅ GOOD: "You get energy from uncovering hidden insights in complex data"
    ✅ GOOD: "You're driven by data-informed process optimization"
    ✅ GOOD: "You thrive when finding non-obvious connections and turning them into actionable decisions"

    **Increase abstraction level. Use domain-specific professional language.**

    ### 2. 🎯 ROLES MUST SURPRISE
    ❌ "Data Analyst" — too obvious
    ✅ "Product Operations" — analysis + process improvement
    ✅ "Business Intelligence Specialist" — data-driven strategy
    ✅ "Data Insights Manager" — turning data into business decisions

    ### 3. ⚡ ACTION PLAN = CONCRETE ARTIFACTS
    ✅ "Create a spreadsheet with 5 [ROLE] job postings and highlight 3 recurring requirements"
    ✅ "Write a 1-page document: 'How I would improve [specific process] with data'"
    ✅ "Conduct a 15-min interview with a [ROLE] and note 3 non-obvious insights"

    ### 4. 🏷️ PROFILE TYPE = CORE CONTRADICTION
    ❌ "Strategic Innovator" — too generic
    ✅ "Efficiency Builder in Data" — data + optimization
    ✅ "Systematic Analyst-Improver" — analysis + implementation
    ✅ "Data-Driven Optimizer" — data + improvements

    ### 5. 🌍 DON'T LIMIT TO IT
    - If user describes working with people → suggest education, HR, social work roles
    - If user describes analysis and data → suggest IT and analytical roles
    - Adapt to answers, don't force one domain

    ### 6. 💪 STRENGTHS — UNIQUE TO THIS PROFILE
    ❌ "creative problem-solving", "self-motivation" — too generic
    ✅ "Translating ambiguous briefs into structured plans"
    ✅ "Explaining complex concepts in simple terms"
    ✅ "Uncovering hidden insights in chaotic data"

    ### 7. 📚 SKILLS TO DEVELOP — ROLE-SPECIFIC
    For IT/analytics:
    - "SQL and database management"
    - "Data visualization (Tableau/Power BI/Looker)"
    - "A/B testing and statistical analysis"
    - "Python for data analysis (pandas, numpy)"

    For people-oriented roles:
    - "Group facilitation and moderation"
    - "Coaching techniques"
    - "Educational program design"

    **Choose skills relevant to suggested roles.**

    ### 8. 📋 JSON SCHEMA
    {
      "profileType": "core contradiction (2-4 words)",
      "profileSummary": "2-3 sentences of INTERPRETATION, NOT REPETITION",
      "whyThisResult": ["rephrased pattern 1", "pattern 2", "pattern 3"],
      "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
      "workStyle": "ideal environment — interpretation",
      "bestFitRoles": [
        {"role": "NON-OBVIOUS role", "explanation": "why it fits THIS person"}
      ],
      "potentialMismatches": ["role/environment 1 with explanation", "role/environment 2 with explanation"],
      "actionPlan": {
        "immediate": ["action → CONCRETE ARTIFACT", "action 2 → ARTIFACT"],
        "exploration": ["way to try → ARTIFACT", "way 2 → ARTIFACT"],
        "validation": ["way to test → ARTIFACT", "way 2 → ARTIFACT"],
        "skillsToDevelop": [
          {"skill": "specific skill for this role", "why": "why it matters", "howToLearn": "where to start"}
        ],
        "nextMove": "concrete action with deadline"
      }
    }

    ### 9. 🔥 NEXT MOVE — CONCRETE ACTION WITH DEADLINE
    ❌ "Explore roles", "Look into jobs"
    ✅ "Apply to 3 roles within 7 days"
    ✅ "Conduct 2 informational interviews this week"

    Return ONLY clean JSON.`
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
      max_tokens: 3000,
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
      max_tokens: 3000,
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
  const hasPeople = /people|люд|команд|team|клиент|client|support|поддерж|помогать|объяснять/i.test(allText);
  const hasCreate = /creat|твор|созда|дизайн|design|brand|бренд|концеп/i.test(allText);
  const hasStructure = /struct|структур|порядок|организ|process|процесс|predict/i.test(allText);
  const hasAutonomy = /autonom|автоном|свобод|независим|flexib|гибк/i.test(allText);
  const needsStructure = hasCreate && hasStructure;
  const avoidsChaos = /chaos|хаос|uncertain|неопредел/i.test(allText);
  const likesExplaining = /объяснять|обуч|teaching|explain|учить/i.test(allText);

  let profileType = "";
  let roles: Array<{ role: string; explanation: string }> = [];

  if (hasCreate && needsStructure) {
    profileType = isRussian ? "Строитель структуры в хаосе" : "Structure Builder in Chaos";
    roles = [
      { role: isRussian ? "Product Operations" : "Product Operations", explanation: isRussian ? "Создание нового в рамках структуры" : "Creation within structure" },
      { role: isRussian ? "Руководитель проектного офиса" : "PMO Lead", explanation: isRussian ? "Внедрение структуры в креативные процессы" : "Bringing structure to creative processes" },
    ];
  } else if (hasAnalysis && hasStructure) {
    profileType = isRussian ? "Системный визионер" : "Systematic Visionary";
    roles = [
      { role: isRussian ? "Бизнес-аналитик" : "Business Analyst", explanation: isRussian ? "Анализ + стратегия в рамках процессов" : "Analysis + strategy within processes" },
      { role: isRussian ? "Методист образовательных программ" : "Educational Methodologist", explanation: isRussian ? "Структурирование знаний" : "Structuring knowledge" },
    ];
  } else if (hasPeople && likesExplaining) {
    profileType = isRussian ? "Эмпатичный наставник" : "Empathetic Mentor";
    roles = [
      { role: isRussian ? "Координатор волонтёров" : "Volunteer Coordinator", explanation: isRussian ? "Организация и поддержка людей" : "Organizing and supporting people" },
      { role: isRussian ? "Специалист по адаптации персонала" : "Onboarding Specialist", explanation: isRussian ? "Помощь новичкам освоиться" : "Helping newcomers adjust" },
    ];
  } else if (hasPeople && !hasCreate) {
    profileType = isRussian ? "Коммуникатор-поддержка" : "Supportive Communicator";
    roles = [
      { role: isRussian ? "Customer Success" : "Customer Success", explanation: isRussian ? "Помощь клиентам" : "Helping clients" },
      { role: isRussian ? "Социальный работник" : "Social Worker", explanation: isRussian ? "Поддержка людей в трудных ситуациях" : "Supporting people in difficult situations" },
    ];
  } else if (hasCreate && hasAutonomy && avoidsChaos) {
    profileType = isRussian ? "Креатор, которому нужны границы" : "Creator Who Needs Guardrails";
    roles = [
      { role: isRussian ? "Арт-директор в найме" : "In-house Art Director", explanation: isRussian ? "Креатив в структурированной среде" : "Creativity in structured environment" },
      { role: isRussian ? "Редактор издательства" : "Publishing Editor", explanation: isRussian ? "Работа с текстами в рамках" : "Working with texts within frameworks" },
    ];
  } else {
    profileType = isRussian ? "Универсал-практик" : "Practical Generalist";
    roles = [
      { role: isRussian ? "Координатор проектов" : "Project Coordinator", explanation: isRussian ? "Организация и контроль" : "Organization and control" },
      { role: isRussian ? "Специалист по улучшениям" : "Improvement Specialist", explanation: isRussian ? "Оптимизация процессов" : "Process optimization" },
    ];
  }

  const roleExample = roles[0]?.role || (isRussian ? "специалист" : "specialist");

  return {
    profileType,
    profileSummary: isRussian
      ? `Ты получаешь энергию от ${hasCreate ? "создания нового" : "улучшения существующего"}, но тебе нужны чёткие рамки для эффективной работы. ${hasPeople ? "Тебе важно взаимодействие с людьми и возможность помогать." : ""}`
      : `You get energy from ${hasCreate ? "creating new things" : "improving existing systems"}, but you need clear boundaries to work effectively. ${hasPeople ? "People interaction and helping matters to you." : ""}`,
    whyThisResult: isRussian
      ? ["Ты драйвишься созданием, но не хаосом", "Тебе нужна структура для эффективности", hasPeople ? "Тебе важно приносить пользу людям" : "Ты ценишь автономию в рамках процессов"]
      : ["You're driven by creation, not chaos", "You need structure for effectiveness", hasPeople ? "Making a difference for people matters to you" : "You value autonomy within processes"],
    keyStrengths: isRussian
      ? ["Превращение идей в структурированные планы", "Работа в рамках с автономией", hasPeople ? "Умение объяснять сложное простыми словами" : "Создание порядка из хаоса"]
      : ["Turning ideas into structured plans", "Working within frameworks with autonomy", hasPeople ? "Explaining complex concepts simply" : "Creating order from chaos"],
    workStyle: isRussian
      ? `Среда с чёткими границами, но свободой внутри них. Минимум неопределённости, максимум автономии.${hasPeople ? " Возможность взаимодействовать и помогать людям." : ""}`
      : `Environment with clear boundaries but freedom within. Minimal uncertainty, maximum autonomy.${hasPeople ? " Ability to interact and help people." : ""}`,
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
      skillsToDevelop: [
        {
          skill: isRussian ? "Коммуникация и презентация" : "Communication and presentation",
          why: isRussian ? "Умение доносить идеи критически важно для этой роли" : "Ability to convey ideas is critical for this role",
          howToLearn: isRussian ? "Запишите 2-минутное видео с объяснением любой идеи и покажите другу" : "Record a 2-min video explaining any idea and show it to a friend"
        },
        {
          skill: isRussian ? "Аналитическое мышление" : "Analytical thinking",
          why: isRussian ? "Помогает видеть паттерны и принимать решения" : "Helps spot patterns and make decisions",
          howToLearn: isRussian ? "Пройдите бесплатный курс 'Data-driven decision making' на Coursera" : "Take free 'Data-driven decision making' course on Coursera"
        },
      ],
      nextMove: isRussian
        ? `Подайся на 3 вакансии "${roleExample}" в течение 7 дней или проведи 2 информационных интервью`
        : `Apply to 3 "${roleExample}" roles in the next 7 days or conduct 2 informational interviews`,
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

      // Отправляем уведомление в Telegram
      await sendToTelegram(
        `🆕 Новый анализ (fallback)\n` +
        `🌐 Язык: ${language}\n` +
        `📊 Качество: ${isLowQuality ? "низкое" : "среднее"}\n` +
        `👤 Профиль: ${fallbackResult.profileType}`
      );

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
        fallback: isRussian ? "Универсал-практик" : "Practical Generalist",
      }),
      profileSummary: cleanText(rawResult?.profileSummary, {
        maxLength: 400,
        fallback: isRussian ? "Ты получаешь энергию от создания нового, но тебе нужны чёткие рамки." : "You get energy from creating, but need clear boundaries.",
      }),
      whyThisResult: cleanList(rawResult?.whyThisResult, {
        maxItems: 3,
        maxLength: 200,
        removeGeneric: true,
      }),
      keyStrengths: cleanList(rawResult?.keyStrengths, {
        maxItems: 3,
        maxLength: 160,
        removeGeneric: true,
      }),
      workStyle: cleanText(rawResult?.workStyle, {
        maxLength: 400,
        fallback: isRussian ? "Среда с чёткими границами и свободой внутри." : "Clear boundaries with freedom within.",
      }),
      bestFitRoles: Array.isArray(rawResult?.bestFitRoles)
        ? rawResult.bestFitRoles
            .map((item: any) => ({
              role: cleanText(item?.role, { maxLength: 100 }),
              explanation: cleanText(item?.explanation, { maxLength: 300 }),
            }))
            .filter((item: { role: string; explanation: string }) => item.role && item.explanation)
            .slice(0, 5)
        : [],
      potentialMismatches: cleanList(rawResult?.potentialMismatches, {
        maxItems: 2,
        maxLength: 200,
      }),
      actionPlan: {
        immediate: cleanList(rawResult?.actionPlan?.immediate, {
          maxItems: 3,
          maxLength: 250,
          requireAction: true,
          removeVague: true,
        }),
        exploration: cleanList(rawResult?.actionPlan?.exploration, {
          maxItems: 3,
          maxLength: 250,
          requireAction: true,
          removeVague: true,
        }),
        validation: cleanList(rawResult?.actionPlan?.validation, {
          maxItems: 3,
          maxLength: 250,
          requireAction: true,
          removeVague: true,
        }),
        skillsToDevelop: Array.isArray(rawResult?.actionPlan?.skillsToDevelop)
          ? rawResult.actionPlan.skillsToDevelop
              .map((item: any) => ({
                skill: cleanText(item?.skill, { maxLength: 80 }),
                why: cleanText(item?.why, { maxLength: 200 }),
                howToLearn: cleanText(item?.howToLearn, { maxLength: 200 }),
              }))
              .filter((item: any) => item.skill && item.why && item.howToLearn)
              .slice(0, 3)
          : [],
        nextMove: cleanText(rawResult?.actionPlan?.nextMove, {
          maxLength: 300,
          fallback: isRussian ? "Проведи 3 информационных интервью в течение месяца." : "Conduct 3 informational interviews within a month.",
        }),
      },
    };

    // Fallback для пустых полей
    if (normalized.whyThisResult.length < 3) {
      normalized.whyThisResult = isRussian
        ? ["Ты драйвишься созданием, но не хаосом", "Тебе нужна структура для эффективности", "Ты ценишь автономию в рамках процессов"]
        : ["You're driven by creation, not chaos", "You need structure for effectiveness", "You value autonomy within processes"];
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

    if (!normalized.actionPlan.skillsToDevelop.length) {
      normalized.actionPlan.skillsToDevelop = [
        {
          skill: isRussian ? "Коммуникация" : "Communication",
          why: isRussian ? "Умение доносить идеи" : "Ability to convey ideas",
          howToLearn: isRussian ? "Практикуйтесь объяснять сложное простыми словами" : "Practice explaining complex things simply"
        },
      ];
    }

    if (!normalized.actionPlan.nextMove) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.nextMove = isRussian
        ? `Подайся на 3 вакансии "${roleExample}" за 7 дней или проведи 2 интервью`
        : `Apply to 3 "${roleExample}" roles in 7 days or conduct 2 interviews`;
    }

    console.log(`✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`);

    // Отправляем уведомление в Telegram
    const rolesList = normalized.bestFitRoles.map((r: any) => r.role).join(", ");
    await sendToTelegram(
      `✅ <b>Новый анализ!</b>\n` +
      `🤖 Провайдер: ${provider}\n` +
      `🌐 Язык: ${language}\n` +
      `👤 Профиль: ${normalized.profileType}\n` +
      `💼 Роли: ${rolesList}\n` +
      `📊 Качество: ${isLowQuality ? "низкое" : "высокое"}`
    );

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