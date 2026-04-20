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

// ========== Склонение русских ролей ==========
function declineRole(role: string, preposition: "with" | "for" = "with"): string {
  if (preposition === "with") {
    const declensions: Record<string, string> = {
      "Продуктовый менеджер": "продуктовым менеджером",
      "Бизнес-аналитик": "бизнес-аналитиком",
      "Методист образовательных программ": "методистом образовательных программ",
      "Координатор волонтёров": "координатором волонтёров",
      "Специалист по адаптации персонала": "специалистом по адаптации персонала",
      "Customer Success": "Customer Success специалистом",
      "Социальный работник": "социальным работником",
      "Арт-директор в найме": "арт-директором в найме",
      "Редактор издательства": "редактором издательства",
      "Координатор проектов": "координатором проектов",
      "Специалист по улучшениям": "специалистом по улучшениям",
      "Product Operations": "Product Operations специалистом",
      "Innovation Program Manager": "Innovation Program Manager",
      "Technical Program Manager": "Technical Program Manager",
      "Chief of Staff": "Chief of Staff",
      "Business Operations": "Business Operations специалистом",
      "Образовательный методист": "образовательным методистом",
      "Data Insights Manager": "Data Insights Manager",
      "Business Intelligence Specialist": "Business Intelligence специалистом",
    };
    return declensions[role] || role;
  }
  return role;
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

**Повышай уровень абстракции. Используй профессиональную лексику предметной области.**

### 1.5. 🔥 WHY THIS RESULT — НИКАКИХ ЦИТАТ (ОСОБОЕ ПРАВИЛО)
Блок "whyThisResult" НЕ должен содержать фразы, которые можно найти в ответах пользователя.

❌ ПЛОХО: "наведение порядка в хаотичных процессах" (если Q1: "наведение порядка в хаотичных процессах")
❌ ПЛОХО: "оптимизация сломанных процессов" (если Q4: "оптимизировать сломанный процесс")
❌ ПЛОХО: "необходимость свободы" (если Q5: "Мне важна полная свобода")

✅ ХОРОШО: "Вас драйвит превращение хаоса в работающие системы"
✅ ХОРОШО: "Вы чувствуете прилив сил, когда видите неэффективность и знаете, как её исправить"
✅ ХОРОШО: "Вам нужен простор для экспериментов в рамках понятной цели"

**Этот блок — интерпретация паттернов, а не список ответов пользователя.**

### 2. 🎯 РОЛИ ДОЛЖНЫ УДИВЛЯТЬ
❌ "Аналитик данных" — слишком очевидно
✅ "Product Operations" — анализ + улучшение процессов
✅ "Business Intelligence Specialist" — data-driven стратегия
✅ "Data Insights Manager" — превращение данных в бизнес-решения

### 3. ⚡ ACTION PLAN = КОНКРЕТНЫЕ АРТЕФАКТЫ + ОБЪЯСНЕНИЕ ЗАЧЕМ
Для каждого действия указывай:
- Что сделать (конкретный артефакт)
- Зачем это нужно (какую проблему решает)

❌ "Создайте таблицу с 5 вакансиями"
✅ "Составьте таблицу с 5 вакансиями [РОЛЬ] и выделите 3 повторяющихся требования — это покажет, какие навыки реально нужны рынку, а не просто описаны в книгах"

### 4. 🏷️ PROFILE TYPE = ГЛАВНОЕ ПРОТИВОРЕЧИЕ
❌ "Стратегический Инноватор" — слишком общо
✅ "Строитель эффективности в данных" — data + оптимизация
✅ "Создатель, которому нужны границы" — креатив + структура

### 5. 🌍 НЕ ОГРАНИЧИВАЙСЯ IT-СФЕРОЙ
- Если пользователь описывает работу с людьми → предлагай роли в образовании, HR, соцработе
- Если пользователь описывает анализ и данные → предлагай IT и аналитические роли
- Адаптируйся под ответы, не навязывай одну сферу

### 6. 💪 STRENGTHS — УНИКАЛЬНЫЕ ДЛЯ ЭТОГО ПРОФИЛЯ
❌ "креативное решение проблем", "самомотивация" — слишком обще
✅ "Превращение размытых брифов в структурированные планы"
✅ "Умение объяснять сложные концепции простыми словами"

### 7. 📚 SKILLS TO DEVELOP — СПЕЦИФИЧНЫЕ ДЛЯ РОЛИ
Для IT/аналитики: SQL, визуализация данных, A/B тестирование, Python
Для работы с людьми: фасилитация, коучинговые техники, проектирование обучения

### 8. 📋 PROFILE SUMMARY — ПОРТРЕТ, А НЕ ПЕРЕЧЕНЬ ПРЕДПОЧТЕНИЙ
❌ "Вам важна полная свобода исследовать и экспериментировать" (пересказ)
❌ "Вы цените стабильность и смысл в своей работе" (пересказ)
✅ "Вы расцветаете, когда есть простор для манёвра, но при этом понятна конечная цель"
✅ "Вам важно видеть, что ваша работа приносит реальную пользу, а не просто движет метрики"

**Описывай, КАК предпочтения проявляются в работе, а не просто перечисляй их.**

### 9. 🎯 WORK STYLE — ЭТО НЕ СРЕДА, А КАК ВЫ РАБОТАЕТЕ
❌ "Идеальная среда — свобода действий"
✅ "Вы работаете итерациями: генерация идей → логический фильтр → реализация. Лучшая продуктивность — утром, в тишине, с одним фокусом. Вам важно видеть прогресс и иметь право на эксперимент."

### 10. 🔍 EXPLORATION — УТОЧНЯЙ ЦЕЛЬ ИНТЕРВЬЮ
❌ "Проведите интервью с [РОЛЬ]"
✅ "Проведите 15-минутное интервью с [РОЛЬ]. Спросите: 'Что самое неожиданное в вашей работе?' и 'Какой навык вы считаете самым недооценённым?' — это покажет реальность профессии."

### 11. ✅ VALIDATION — ВСЕГДА УКАЗЫВАЙ АДРЕСАТА
❌ "Создайте мини-презентацию"
✅ "Создайте мини-презентацию (3 слайда) о том, как бы вы улучшили конкретный продукт/процесс. Покажите знакомому из индустрии или в тематическом чате. Попросите: 'Что здесь самое слабое место?'"

### 12. 🚀 NEXT MOVE — УЧИТЫВАЙ УРОВЕНЬ
Если пользователь только исследует направление — предлагай небольшие, конкретные проекты с измеримым результатом.

## 📋 СХЕМА JSON
{
  "profileType": "главное противоречие (2-4 слова)",
  "profileSummary": "2-3 предложения-ПОРТРЕТ, НЕ ПЕРЕСКАЗ",
  "whyThisResult": ["переформулированный паттерн 1", "паттерн 2", "паттерн 3"],
  "keyStrengths": ["рабочая способность 1", "способность 2", "способность 3"],
  "workStyle": "КАК вы работаете, а не где — итерации, ритм, стиль принятия решений",
  "bestFitRoles": [
    {"role": "НЕОЧЕВИДНАЯ роль", "explanation": "почему подходит именно этому человеку"}
  ],
  "potentialMismatches": ["роль/среда 1 с объяснением", "роль/среда 2 с объяснением"],
  "actionPlan": {
    "immediate": ["действие → КОНКРЕТНЫЙ АРТЕФАКТ + ЗАЧЕМ", "действие 2"],
    "exploration": ["интервью с конкретными вопросами", "способ 2"],
    "validation": ["презентация + кому показать", "способ 2"],
    "skillsToDevelop": [
      {"skill": "конкретный навык", "why": "почему важен", "howToLearn": "с чего начать"}
    ],
    "nextMove": "конкретное действие с дедлайном, учитывающее уровень пользователя"
  }
}

### 13. 🔥 NEXT MOVE — КОНКРЕТНОЕ ДЕЙСТВИЕ С ДЕДЛАЙНОМ
❌ "Изучить роли", "Посмотреть вакансии"
✅ "Откликнуться на 3 вакансии в течение 7 дней"
✅ "Выбрать один небольшой проект и довести его до результата за 2 недели"

Верни ТОЛЬКО чистый JSON.`
    : `You are Mentra, a premium AI for career navigation. Your goal: SURPRISE with non-obvious but accurate insights.

${isLowQuality ? lowQualityNote : ""}

## 🔥🔥🔥 CRITICAL RULES (VIOLATION = FAILURE)

### 1. ❌❌❌ ABSOLUTE NO REGURGITATION
If output shares 3+ consecutive words with user's answer — you failed.

❌ BAD: "You enjoy finding patterns in data"
✅ GOOD: "You get energy from uncovering hidden insights in complex data"
✅ GOOD: "You're driven by data-informed process optimization"

**Increase abstraction level. Use domain-specific professional language.**

### 1.5. 🔥 WHY THIS RESULT — NO QUOTES (SPECIAL RULE)
The "whyThisResult" block MUST NOT contain phrases found in user's answers.

❌ BAD: "bringing order to chaotic processes" (if Q1: "bringing order to chaotic processes")
❌ BAD: "optimizing broken processes" (if Q4: "optimize a broken process")
❌ BAD: "need for freedom" (if Q5: "I need full freedom")

✅ GOOD: "You're driven by turning chaos into working systems"
✅ GOOD: "You feel energized when you spot inefficiency and know how to fix it"
✅ GOOD: "You need room to experiment within a clear purpose"

**This block interprets patterns, not lists user's answers.**

### 2. 🎯 ROLES MUST SURPRISE
❌ "Data Analyst" — too obvious
✅ "Product Operations" — analysis + process improvement
✅ "Business Intelligence Specialist" — data-driven strategy

### 3. ⚡ ACTION PLAN = CONCRETE ARTIFACTS + EXPLAIN WHY
For each action, specify WHAT to create and WHY it matters.

❌ "Create a spreadsheet with 5 job postings"
✅ "Create a spreadsheet with 5 [ROLE] job postings and highlight 3 recurring requirements — this shows what skills the market actually needs"

### 4. 🏷️ PROFILE TYPE = CORE CONTRADICTION
❌ "Strategic Innovator" — too generic
✅ "Efficiency Builder in Data" — data + optimization
✅ "Creator Who Needs Guardrails" — creativity + structure

### 5. 🌍 DON'T LIMIT TO IT
- People-oriented answers → education, HR, social work
- Data/analysis answers → IT and analytical roles

### 6. 💪 STRENGTHS — UNIQUE TO THIS PROFILE
❌ "creative problem-solving", "self-motivation" — too generic
✅ "Translating ambiguous briefs into structured plans"
✅ "Explaining complex concepts in simple terms"

### 7. 📚 SKILLS TO DEVELOP — ROLE-SPECIFIC
For IT/analytics: SQL, data visualization, A/B testing, Python
For people-oriented: facilitation, coaching, educational design

### 8. 📋 PROFILE SUMMARY — PORTRAIT, NOT PREFERENCE LIST
❌ "You value full freedom to explore and experiment" (regurgitation)
❌ "You value stability and meaning in your work" (regurgitation)
✅ "You thrive when there's room to maneuver, but with a clear end goal in sight"
✅ "You need to see that your work makes a real difference, not just moves metrics"

**Describe HOW preferences show up in work, not just list them.**

### 9. 🎯 WORK STYLE — HOW YOU WORK, NOT WHERE
❌ "Ideal environment — freedom to create"
✅ "You work iteratively: idea generation → logical filtering → execution. Best productivity — mornings, quiet, single focus. You need to see progress and have room to experiment."

### 10. 🔍 EXPLORATION — SPECIFY INTERVIEW QUESTIONS
❌ "Interview a [ROLE]"
✅ "Conduct a 15-min interview with a [ROLE]. Ask: 'What's the most surprising part of your job?' and 'What skill do you consider most underrated?' — this reveals the real profession."

### 11. ✅ VALIDATION — ALWAYS SPECIFY WHO TO SHOW
❌ "Create a mini-pitch"
✅ "Create a mini-pitch (3 slides) about improving a specific product/process. Share with someone in the industry or in a relevant community. Ask: 'What's the weakest part here?'"

### 12. 🚀 NEXT MOVE — CONSIDER USER LEVEL
If answers suggest exploration phase — suggest small, concrete projects with measurable outcomes.

## 📋 JSON SCHEMA
{
  "profileType": "core contradiction (2-4 words)",
  "profileSummary": "2-3 sentences PORTRAIT, NOT REPETITION",
  "whyThisResult": ["rephrased pattern 1", "pattern 2", "pattern 3"],
  "keyStrengths": ["work capability 1", "capability 2", "capability 3"],
  "workStyle": "HOW you work — iterations, rhythm, decision style",
  "bestFitRoles": [
    {"role": "NON-OBVIOUS role", "explanation": "why it fits THIS person"}
  ],
  "potentialMismatches": ["role/environment 1 with explanation", "role/environment 2"],
  "actionPlan": {
    "immediate": ["action → ARTIFACT + WHY", "action 2"],
    "exploration": ["interview with specific questions", "way 2"],
    "validation": ["pitch + who to show", "way 2"],
    "skillsToDevelop": [
      {"skill": "specific skill", "why": "why it matters", "howToLearn": "where to start"}
    ],
    "nextMove": "concrete action with deadline, considering user level"
  }
}

### 13. 🔥 NEXT MOVE — CONCRETE ACTION WITH DEADLINE
❌ "Explore roles", "Look into jobs"
✅ "Apply to 3 roles within 7 days"
✅ "Choose one small project and complete it within 2 weeks"

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
  const roleInstrumental = isRussian ? declineRole(roleExample, "with") : roleExample;

  return {
    profileType,
    profileSummary: isRussian
      ? `Создатель, которому нужны границы — вы расцветаете, когда есть чёткая цель, но полная свобода в том, как её достичь. ${hasPeople ? "Вам важно приносить пользу людям." : ""}`
      : `A creator who needs guardrails — you thrive with clear goals but full freedom in execution. ${hasPeople ? "Making a difference matters to you." : ""}`,
    whyThisResult: isRussian
      ? ["Вы драйвитесь созданием, но хаос вас парализует", "Вам нужна структура для реализации идей", hasPeople ? "Вам важно видеть пользу для людей" : "Вы цените автономию в рамках процессов"]
      : ["You're driven by creation, but chaos paralyzes you", "You need structure to execute ideas", hasPeople ? "Making an impact matters to you" : "You value autonomy within processes"],
    keyStrengths: isRussian
      ? ["Превращение идей в структурированные планы", "Работа в рамках с автономией", hasPeople ? "Умение объяснять сложное простыми словами" : "Создание порядка из хаоса"]
      : ["Turning ideas into structured plans", "Working within frameworks with autonomy", hasPeople ? "Explaining complex concepts simply" : "Creating order from chaos"],
    workStyle: isRussian
      ? `Вы работаете итерациями: генерация идей → логический фильтр → реализация. Лучшая продуктивность — в тишине, с одним фокусом. Вам важно видеть прогресс и иметь право на эксперимент.`
      : `You work iteratively: idea generation → logical filtering → execution. Best productivity — quiet, single focus. You need to see progress and have room to experiment.`,
    bestFitRoles: roles,
    potentialMismatches: isRussian
      ? ["Полностью неструктурированные стартапы — хаос вас парализует", "Жёстко регламентированные роли без права на эксперимент"]
      : ["Completely unstructured startups — chaos paralyzes you", "Rigidly defined roles without room to experiment"],
    actionPlan: {
      immediate: isRussian
        ? [
            `Составьте таблицу с 5 вакансиями "${roleExample}" и выделите 3 повторяющихся требования — это покажет, какие навыки реально нужны рынку`,
            `Напишите 1-страничный документ о том, как бы вы улучшили конкретный процесс — это станет основой для портфолио`
          ]
        : [
            `Create a spreadsheet with 5 "${roleExample}" job postings and highlight 3 recurring requirements — this shows what skills the market actually needs`,
            `Write a 1-page document on how you'd improve a specific process — this becomes portfolio material`
          ],
      exploration: isRussian
        ? [
            `Проведите 15-мин интервью с ${roleInstrumental}. Спросите: "Что самое неожиданное в вашей работе?" и "Какой навык вы считаете самым недооценённым?"`,
            `Проанализируйте 3 профиля "${roleExample}" на LinkedIn и найдите общие паттерны в их карьерном пути`
          ]
        : [
            `Conduct a 15-min interview with a ${roleExample}. Ask: "What's the most surprising part of your job?" and "What skill do you consider most underrated?"`,
            `Analyze 3 "${roleExample}" LinkedIn profiles and find common patterns in their career paths`
          ],
      validation: isRussian
        ? [
            `Создайте мини-презентацию (3 слайда) о том, как бы вы улучшили конкретный продукт/процесс. Покажите знакомому из индустрии или в тематическом чате`,
            `Попросите обратную связь: "Что здесь самое слабое место?"`
          ]
        : [
            `Create a 3-slide mini-pitch about improving a specific product/process. Share it with someone in the industry or in a relevant community`,
            `Ask for feedback: "What's the weakest part here?"`
          ],
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
        ? `Выберите ОДИН небольшой проект (улучшить процесс на текущей работе или создать прототип идеи) и доведите его до результата за 2 недели. Главное — закончить.`
        : `Choose ONE small project (improve a process at work or prototype an idea) and complete it within 2 weeks. Focus on finishing, not perfection.`,
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
      console.log(`  Q${i + 1}: ${ans.substring(0, 100)}${ans.length > 100 ? "..." : ""}`);
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

      await sendToTelegram(
        `🆕 Новый анализ (fallback)\n` +
        `🌐 Язык: ${language}\n` +
        `📊 Качество: ${isLowQuality ? "низкое" : "среднее"}\n` +
        `👤 Профиль: ${escapeHtml(fallbackResult.profileType)}`
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
        fallback: isRussian ? "Создатель, которому нужны границы — вы расцветаете, когда есть чёткая цель, но полная свобода в том, как её достичь." : "A creator who needs guardrails — you thrive with clear goals but full freedom in execution.",
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
        fallback: isRussian ? "Вы работаете итерациями: идеи → фильтр → реализация. Лучшая продуктивность — в тишине, с одним фокусом." : "You work iteratively: ideas → filter → execution. Best productivity — quiet, single focus.",
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
          maxLength: 300,
          requireAction: true,
          removeVague: true,
        }),
        exploration: cleanList(rawResult?.actionPlan?.exploration, {
          maxItems: 3,
          maxLength: 300,
          requireAction: true,
          removeVague: true,
        }),
        validation: cleanList(rawResult?.actionPlan?.validation, {
          maxItems: 3,
          maxLength: 300,
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
          maxLength: 350,
          fallback: isRussian ? "Выберите ОДИН небольшой проект и доведите его до результата за 2 недели." : "Choose ONE small project and complete it within 2 weeks.",
        }),
      },
    };

    // Fallback для пустых полей
    if (normalized.whyThisResult.length < 3) {
      normalized.whyThisResult = isRussian
        ? ["Вы драйвитесь созданием, но хаос вас парализует", "Вам нужна структура для реализации идей", "Вы ценишь автономию в рамках процессов"]
        : ["You're driven by creation, but chaos paralyzes you", "You need structure to execute ideas", "You value autonomy within processes"];
    }

    if (normalized.keyStrengths.length < 3) {
      normalized.keyStrengths = isRussian
        ? ["Превращение идей в структурированные планы", "Работа в рамках с автономией", "Создание порядка из хаоса"]
        : ["Turning ideas into structured plans", "Working within frameworks", "Creating order from chaos"];
    }

    if (normalized.bestFitRoles.length < 2) {
      const smartFallback = generateSmartFallback(language, answers, qualityInfo);
      normalized.bestFitRoles = smartFallback.bestFitRoles;
    }

    if (!normalized.actionPlan.immediate.length) {
      normalized.actionPlan.immediate = isRussian
        ? [`Составьте таблицу с 5 вакансиями и выделите 3 повторяющихся требования — это покажет реальные запросы рынка`, `Напишите 1-страничный документ об улучшении процесса — это станет основой портфолио`]
        : [`Create a spreadsheet with 5 job postings and highlight 3 recurring requirements`, `Write a 1-page process improvement doc — this becomes portfolio material`];
    }

    if (!normalized.actionPlan.exploration.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      const roleInstrumental = isRussian ? declineRole(roleExample, "with") : roleExample;
      normalized.actionPlan.exploration = isRussian
        ? [
            `Проведите 15-мин интервью с ${roleInstrumental}. Спросите: "Что самое неожиданное в работе?" и "Какой навык самый недооценённый?"`,
            `Проанализируйте 3 профиля "${roleExample}" на LinkedIn`
          ]
        : [
            `Interview a ${roleExample}. Ask: "What's most surprising?" and "What skill is most underrated?"`,
            `Analyze 3 "${roleExample}" LinkedIn profiles`
          ];
    }

    if (!normalized.actionPlan.validation.length) {
      const roleExample = normalized.bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");
      normalized.actionPlan.validation = isRussian
        ? [
            `Создайте мини-презентацию (3 слайда) для роли "${roleExample}". Покажите знакомому из индустрии или в тематическом чате`,
            `Попросите обратную связь: "Что здесь самое слабое место?"`
          ]
        : [
            `Create a 3-slide mini-pitch for a ${roleExample} role. Share with someone in the industry`,
            `Ask for feedback: "What's the weakest part?"`
          ];
    }

    if (!normalized.actionPlan.skillsToDevelop.length) {
      normalized.actionPlan.skillsToDevelop = [
        {
          skill: isRussian ? "Коммуникация и презентация" : "Communication and presentation",
          why: isRussian ? "Умение доносить идеи критически важно" : "Ability to convey ideas is critical",
          howToLearn: isRussian ? "Запишите 2-мин видео с объяснением идеи и покажите другу" : "Record a 2-min video explaining an idea and show a friend"
        },
      ];
    }

    if (!normalized.actionPlan.nextMove) {
      normalized.actionPlan.nextMove = isRussian
        ? `Выберите ОДИН небольшой проект и доведите его до результата за 2 недели. Главное — закончить.`
        : `Choose ONE small project and complete it within 2 weeks. Focus on finishing.`;
    }

    console.log(`✅ Analysis complete, provider: ${provider}, profile: ${normalized.profileType}`);

    const rolesList = normalized.bestFitRoles.map((r: any) => r.role).join(", ");
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