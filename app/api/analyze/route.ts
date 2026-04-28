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
  provider?: "groq" | "deepseek" | "fallback";
  confidence?: "low" | "medium" | "high";
  qualityScore?: number;
  qualityReasons?: string[];
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

const WEAK_STRENGTH_PHRASES = [
  "аналитические навыки",
  "логическое мышление",
  "креативность",
  "аналитическое мышление",
  "навыки общения",
  "коммуникация",
  "организаторские способности",
  "внимание к деталям",
  "самостоятельность",
  "лидерство",
  "эмпатия",
  "сочувствие",
  "управление процессами",
  "управление проектами",
  "точность",
  "независимость",
  "стратегическое мышление",
  "спокойствие",
  "спокойствие под давлением",
  "problem-solving skills",
  "analytical skills",
  "logical thinking",
  "creativity",
  "analytical thinking",
  "communication skills",
  "communication",
  "organizational skills",
  "attention to detail",
  "independence",
  "autonomy",
  "leadership",
  "empathy",
  "project management",
  "process management",
  "accuracy",
  "independence",
  "strategic thinking",
  "calm under pressure",
];

const WEAK_ROLE_EXPLANATION_PATTERNS = [
  "подходит, поскольку",
  "эта роль требует",
  "эта роль позволяет",
  "в этой роли человек сможет",
  "может применить",
  "this role requires",
  "this role allows",
  "this role aligns",
  "this role leverages",
  "fits because",
];

const WEAK_WHY_PATTERNS = [
  "ответ на q",
  "интерес к",
  "любовь к",
  "предпочтение",
  "ценность",
  "сочетание потребности",
  "важность",
  "склонность к",
  "ориентация на",
  "навыки выявления",
  "аналитический подход",
  "you value",
  "you prefer",
  "interest in",
  "love for",
  "preference for",
  "combination of",
  "importance of",
  "inclination toward",
  "orientation toward",
  "analytical approach",
];

const WEAK_VALIDATION_PATTERNS = [
  "поговорить с профессионал",
  "поговорить с коллег",
  "поговорить с наставник",
  "поговорить с людьми",
  "обсудить возможности",
  "получить обратную связь от профессионала",
  "join online communities",
  "join communities",
  "talk to professionals",
  "talk to colleagues",
  "talk to a mentor",
  "talk to people",
  "discuss opportunities",
  "get feedback from professionals",
];

const WEAK_NEXT_STEP_PATTERNS = [
  "изучить основы",
  "изучить возможности",
  "исследовать возможности",
  "узнать больше",
  "почитать про",
  "подтвердить интерес",
  "карьерного роста",
  "варианты карьерного развития",
  "explore opportunities",
  "research opportunities",
  "learn more",
  "read about",
  "confirm your interest",
  "career growth",
  "career options",
];

const ROLE_REPLACEMENTS: Record<string, { ru: string; en: string }> = {
  "community building": {
    ru: "Комьюнити-менеджер",
    en: "Community Manager",
  },
  "управление процессами": {
    ru: "Специалист по улучшению процессов",
    en: "Process Improvement Specialist",
  },
  "менеджер процессов": {
    ru: "Специалист по улучшению процессов",
    en: "Process Improvement Specialist",
  },
  "наставник": {
    ru: "Координатор обучения",
    en: "Learning Coordinator",
  },
  "наставник или тренер": {
    ru: "Координатор обучения",
    en: "Learning Coordinator",
  },
  "операционный директор": {
    ru: "Операционный координатор",
    en: "Operations Coordinator",
  },
  "контролер качества": {
    ru: "Специалист по качеству",
    en: "Quality Specialist",
  },
  "аналитик качества": {
    ru: "Специалист по качеству",
    en: "Quality Specialist",
  },
  "обучатель": {
    ru: "Специалист по обучению",
    en: "Learning Specialist",
  },
  "обучатель или преподаватель": {
    ru: "Специалист по обучению",
    en: "Learning Specialist",
  },
};

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
  "ask",
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
  "спросите",
  "document",
  "conduct",
];

const SYSTEM_PROMPT_RU = `Ты — Mentra, премиальный AI для карьерной навигации. Твоя задача — УДИВИТЬ пользователя неочевидными, но точными выводами.

## КРИТИЧЕСКИЕ ПРАВИЛА

1. Не пересказывай ответы пользователя дословно.
2. Блок "whyThisResult" должен интерпретировать паттерны, а не цитировать ответы.
3. Предлагай реалистичные роли, а не выдуманные названия.
4. Действия должны быть конкретными и выполнимыми.
5. Не своди всё к IT.
6. Сильные стороны должны быть конкретными, а не банальными.
7. Предлагай 2-3 конкретных навыка для развития.
8. "profileSummary" — это портрет, а не перечень предпочтений.
9. "workStyle" должен описывать КАК человек работает, а не где.
10. Если предлагаешь интервью — укажи конкретные вопросы.
11. Validation должен указывать, кому показать результат или где запросить обратную связь.
12. "nextMove" должен быть конкретным и ограниченным по времени.
13. Если сигналы противоречат друг другу — не смешивай их без объяснения.
14. Q10 — явный сигнал интереса. Учитывай его в ролях и плане.
15. Не инвертируй смысл слов пользователя.
16. Не делай слишком узких выводов про data/BI без явных оснований.
17. Никогда не предлагай "пройти курс", "поговорить с профессионалами", "подать заявку", если пользователь ещё не протестировал интерес на маленьком практическом действии.
18. Не используй абстрактные названия профилей:
плохо: "Флексибельный лидер"
плохо: "Аналитический kontrol"
хорошо: "Системный проверяющий"
хорошо: "Организатор исполнения"
19. Не смешивай языки.
20. Если ответы пользователя неуверенные — сначала предлагай micro-experiments, а не карьерные решения.

## JSON СХЕМА
{
  "profileType": "главное противоречие (2-4 слова)",
  "profileSummary": "2-3 предложения-портрет",
  "recommendedNextStep": "один ясный шаг на 24-72 часа",
  "whyThisResult": ["паттерн 1", "паттерн 2", "паттерн 3"],
  "keyStrengths": ["сильная сторона 1", "сильная сторона 2", "сильная сторона 3"],
  "workStyle": "как человек работает",
  "bestFitRoles": [
    { "role": "реалистичная роль", "explanation": "почему подходит" }
  ],
  "potentialMismatches": ["несовпадение 1", "несовпадение 2"],
  "actionPlan": {
    "immediate": ["действие 1", "действие 2"],
    "exploration": ["исследование 1", "исследование 2"],
    "validation": ["проверка 1", "проверка 2"],
    "skillsToDevelop": [
      { "skill": "навык", "why": "почему важен", "howToLearn": "как начать" }
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
17. Never suggest "take a course", "talk to professionals", "apply for jobs", or "speak to a career consultant" unless the user has already tested the direction through a small practical experiment.
18. Do not invent vague or inflated profile names.
Bad: "Flexible Leader"
Bad: "Analytical Expert"
Bad: "Creative Visionary"
Good: "Systematic Checker"
Good: "Execution Organizer"
Good: "Structured Creator"
19. Never mix languages or output broken hybrid words.
20. If the user's answers are uncertain, vague, or exploratory, prioritize small experiments over major career decisions.
21. Do not recommend formal education, certifications, or courses unless the role explicitly requires credentials.
22. Avoid generic strengths like:
"good communicator"
"leadership"
"analytical mindset"
"hardworking"
"adaptable"
unless they are made highly specific.
23. If confidence is low, narrow the recommendation to safe adjacent roles instead of ambitious career jumps.


## JSON SCHEMA
{
  "profileType": "core contradiction (2-4 words)",
  "profileSummary": "2-3 sentence portrait",
  "recommendedNextStep": "one clear next step within 24-72 hours",
  "whyThisResult": ["pattern 1", "pattern 2", "pattern 3"],
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "workStyle": "HOW the person works",
  "bestFitRoles": [
    { "role": "realistic role", "explanation": "why it fits" }
  ],
  "potentialMismatches": ["mismatch 1", "mismatch 2"],
  "actionPlan": {
    "immediate": ["action 1", "action 2"],
    "exploration": ["exploration 1", "exploration 2"],
    "validation": ["validation 1", "validation 2"],
    "skillsToDevelop": [
      { "skill": "skill", "why": "why it matters", "howToLearn": "how to start" }
    ],
    "nextMove": "next move"
  }
}

Return ONLY clean JSON.`;

const REVIEW_SYSTEM_PROMPT_RU = `Ты — строгий редактор качества Mentra.

Твоя задача — НЕ генерировать новый анализ, а проверить уже готовый результат.

Ты должен вернуть ТОЛЬКО JSON формата:
{
  "verdict": "accept" | "revise" | "fallback",
  "issues": ["проблема 1", "проблема 2"]
}

Правила:
- "accept" — если результат достаточно хороший
- "revise" — если его можно улучшить ещё одним проходом
- "fallback" — если результат слишком слабый и проще заменить fallback-версией

Никакого текста вне JSON.`;

const REVIEW_SYSTEM_PROMPT_EN = `You are a strict Mentra quality reviewer.

Your task is NOT to generate a new analysis, but to review an existing one.

Return ONLY JSON in this format:
{
  "verdict": "accept" | "revise" | "fallback",
  "issues": ["issue 1", "issue 2"]
}

Rules:
- "accept" if the result is good enough
- "revise" if it can be improved with one more pass
- "fallback" if the result is too weak and should be replaced

Do not output anything except JSON.`;

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

function isWeakStrength(text: string): boolean {
  const lower = text.toLowerCase();
  return WEAK_STRENGTH_PHRASES.some((phrase) => lower.includes(phrase));
}

function isWeakRoleExplanation(text: string): boolean {
  return matchesAnyPattern(text, WEAK_ROLE_EXPLANATION_PATTERNS);
}

function isVagueAction(text: string): boolean {
  const lower = text.toLowerCase();
  return VAGUE_ACTION_PHRASES.some((phrase) => lower.includes(phrase));
}

function hasActionStarter(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const normalized = lower.replace(/^[-•\d.)\s]+/, "");
  return ACTION_STARTERS.some((verb) => normalized.startsWith(verb));
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
  const text = cleanBrokenText(normalizeText(value));
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function cleanBrokenText(text: string): string {
  return text
    .replace(/trước/gi, "")
    .replace(/rõкими/gi, "чёткими")
    .replace(/monotон/gi, "монотон")
    .replace(/kontrol/gi, "контроль")
    .replace(/несpecific/gi, "неконкретные")
    .replace(/флексибельн/gi, "гибк")
    .replace(/в-productsной/gi, "в продуктовой")
    .replace(/tránhать/gi, "избегать")
    .replace(/一定/gi, "")
    .replace(/解决/gi, "")
    .replace(/[一-龯々〆ヵヶ]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((word) => word.length >= 4);
}

function hasStrongOverlap(source: string, candidate: string): boolean {
  const sourceWords = tokenize(source);
  if (!sourceWords.length) return false;

  const candidateLower = normalizeText(candidate).toLowerCase();
  const matched = sourceWords.filter((word) => candidateLower.includes(word));

  return matched.length >= 3;
}

function filterRegurgitation(items: string[], answers: string[]): string[] {
  return items.filter(
    (item) => !answers.some((answer) => hasStrongOverlap(answer, item))
  );
}

function mentionsAnswerTooDirectly(text: string, answers: string[]): boolean {
  return answers.some((answer) => hasStrongOverlap(answer, text));
}

function isParaphrasePattern(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  return [
    "вам важно",
    "вы цените",
    "вас тянет",
    "предпочтение",
    "любовь к",
    "интерес к",
    "you value",
    "you prefer",
    "you are drawn to",
    "interest in",
    "love for",
  ].some((pattern) => lower.startsWith(pattern));
}

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  const lower = normalizeText(text).toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function isWeakWhy(text: string): boolean {
  return isParaphrasePattern(text) || matchesAnyPattern(text, WEAK_WHY_PATTERNS);
}

function isWeakSkillItem(item: SkillToDevelop): boolean {
  const weakSkillName = isWeakStrength(item.skill);

  const weakWhy =
    item.why.length < 30 ||
    /^(это важно|важно для|необходимо для|helps|important for|needed for)\b/i.test(
      item.why.trim()
    );

  const weakHow =
    item.howToLearn.length < 30 ||
    /^(курсы|семинары|практика|courses|seminars|practice|read|study)\b/i.test(
      item.howToLearn.trim()
    );

  return weakSkillName || weakWhy || weakHow;
}

function isWeakValidation(text: string): boolean {
  return matchesAnyPattern(text, WEAK_VALIDATION_PATTERNS);
}

function isWeakWorkStyle(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  return (
    lower.length < 60 ||
    lower.includes("лучше всего вы работаете там, где есть понятная цель") ||
    lower.includes("you work best when there is a clear goal") ||
    lower.includes("structured approach") ||
    lower.includes("methodical and structured")
  );
}

function isWeakProfileSummary(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  return (
    lower.length < 100 ||
    /лучше всего раскрываетесь там, где/i.test(lower) ||
    /you do best where/i.test(lower) ||
    /(человек, который|человек, любящий|человек, которому|a person who|someone who loves)/i.test(lower) ||
    /a person who/i.test(lower)
  );
}

function isWeakMismatch(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  return (
    lower.length < 20 ||
    /жёстко регламентированная среда без пространства/i.test(lower) ||
    /работа, где много суеты, но мало ясных критериев/i.test(lower) ||
    /rigid environment with no room/i.test(lower) ||
    /a lot of noise but very few clear quality criteria/i.test(lower)
  );
}

function isWeakRecommendedNextStep(text: string): boolean {
  return isWeakAction(text) || matchesAnyPattern(text, WEAK_NEXT_STEP_PATTERNS);
}

function isWeakNextMove(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  if (matchesAnyPattern(lower, WEAK_NEXT_STEP_PATTERNS)) return true;

  return (
    /^(подать заявку|пройти курс|изучить|исследовать|связаться|запланировать|apply for|take a course|research|explore|contact|schedule)\b/.test(
      lower
    )
  );
}

function isWeakAction(text: string): boolean {
  const lower = normalizeText(text).toLowerCase();

  return /^(изучить|посмотреть|почитать|подумать|learn|explore|look into|read about)\b/.test(lower);
}

function enforceQ10Priority(
  roles: BestFitRole[],
  q10: string
): BestFitRole[] {
  const interest = normalizeText(q10).toLowerCase();
  const interestWords = tokenize(interest);

  if (!interest || interestWords.length === 0) return roles;

  const scored = roles.map((role, index) => {
    const haystack = `${role.role} ${role.explanation}`.toLowerCase();

    let score = 0;
    for (const word of interestWords) {
      if (haystack.includes(word)) score += 1;
    }

    return { role, score, index };
  });

  const maxScore = Math.max(...scored.map((item) => item.score));
  if (maxScore === 0) return roles;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map((item) => item.role);
}

function injectTension(profileSummary: string, answers: string[], isRussian: boolean): string {
  const allText = answers.join(" ").toLowerCase();

  const hasFreedom =
    /свобод|autonom|freedom|independ/i.test(allText);
  const hasStructure =
    /структ|framework|structure|clear goal|clear criteria/i.test(allText);
  const likesChaos =
    /хаос|chaos/i.test(answers[7] || "");
  const dislikesUncertainty =
    /неопредел|uncertain/i.test(allText);

const alreadyHasTension =
  /противореч|напряж|tension|contradiction|свобода в способе действия/i.test(
    profileSummary.toLowerCase()
  );

  if (alreadyHasTension) return profileSummary;

  if (hasFreedom && hasStructure) {
    return isRussian
      ? `${profileSummary} Ваше ключевое внутреннее напряжение: вам нужна свобода в способе действия, но при этом важны понятные опоры и рамка.`
      : `${profileSummary} Your core tension is that you want freedom in execution, but you still need clear structure and points of reference.`;
  }

  if (likesChaos && dislikesUncertainty) {
    return isRussian
      ? `${profileSummary} Здесь есть важное напряжение: вас может заряжать динамика, но затянувшаяся неопределённость всё же начинает отнимать ресурс.`
      : `${profileSummary} There is an important tension here: fast-moving situations may energize you, but prolonged uncertainty still drains you.`;
  }

  return profileSummary;
}

type QualityScoreDetails = {
  score: number;
  reasons: string[];
};

type ProviderResult = {
  result: MentraRawResult;
  isLowQuality: boolean;
};

type ReviewResult = {
  verdict: "accept" | "revise" | "fallback";
  issues: string[];
};

type MentraTrack =
  | "jewelry"
  | "testing"
  | "creative"
  | "people"
  | "execution"
  | "general";

function scoreAnalysisResult(
  result: MentraResponse,
  answers: string[],
  isRussian: boolean
): QualityScoreDetails {
  let score = 100;
  const reasons: string[] = [];

  if (!result.profileType || result.profileType.length < 3) {
    score -= 10;
    reasons.push(isRussian ? "Слабый profileType" : "Weak profileType");
  }

  if (!result.profileSummary || result.profileSummary.length < 80) {
    score -= 15;
    reasons.push(
      isRussian
        ? "Слишком короткий profileSummary"
        : "Profile summary is too short"
    );
  }

  if (result.whyThisResult.length < 3) {
    score -= 15;
    reasons.push(
      isRussian
        ? "Недостаточно whyThisResult"
        : "Not enough whyThisResult items"
    );
  }

  if (result.keyStrengths.length < 3) {
    score -= 10;
    reasons.push(
      isRussian ? "Недостаточно keyStrengths" : "Not enough keyStrengths"
    );
  }

  const weakStrengthsCount = result.keyStrengths.filter(isWeakStrength).length;
  if (weakStrengthsCount > 0) {
    score -= Math.min(15, weakStrengthsCount * 5);
    reasons.push(
      isRussian
        ? "Слишком общие сильные стороны"
        : "Strengths are too generic"
    );
  }

  if (result.bestFitRoles.length < 2) {
    score -= 15;
    reasons.push(
      isRussian ? "Недостаточно bestFitRoles" : "Not enough bestFitRoles"
    );
  }

  const broadRolesCount = result.bestFitRoles.filter((role) =>
    isTooBroadRole(role.role)
  ).length;

  if (broadRolesCount > 0) {
    score -= Math.min(18, broadRolesCount * 6);
    reasons.push(
      isRussian
        ? "Слишком широкие или завышенные роли"
        : "Roles are too broad or inflated"
    );
  }

  if (!result.actionPlan.immediate.length) {
    score -= 10;
    reasons.push(isRussian ? "Пустой immediate plan" : "Empty immediate plan");
  }

  if (!result.actionPlan.exploration.length) {
    score -= 8;
    reasons.push(
      isRussian ? "Пустой exploration plan" : "Empty exploration plan"
    );
  }

  if (!result.actionPlan.validation.length) {
    score -= 8;
    reasons.push(
      isRussian ? "Пустой validation plan" : "Empty validation plan"
    );
  }

  if (!result.actionPlan.skillsToDevelop.length) {
    score -= 8;
    reasons.push(
      isRussian ? "Пустой skillsToDevelop" : "Empty skillsToDevelop"
    );
  }

  if (!result.actionPlan.nextMove || result.actionPlan.nextMove.length < 40) {
    score -= 10;
    reasons.push(isRussian ? "Слабый nextMove" : "Weak nextMove");
  }

  const regurgitationHits = [
    ...result.whyThisResult,
    result.profileSummary,
    result.workStyle,
    result.recommendedNextStep,
  ].filter((item) => mentionsAnswerTooDirectly(item, answers)).length;

  if (regurgitationHits > 0) {
    score -= Math.min(25, regurgitationHits * 8);
    reasons.push(
      isRussian
        ? "Есть пересказ ответов пользователя"
        : "Contains user-answer regurgitation"
    );
  }

  if (isWeakNextMove(result.actionPlan.nextMove)) {
    score -= 10;
    reasons.push(
      isRussian ? "nextMove слишком общий" : "nextMove is too generic"
    );
  }

  const weakActionsCount = [
    ...result.actionPlan.immediate,
    ...result.actionPlan.exploration,
    ...result.actionPlan.validation,
  ].filter(isWeakAction).length;

  if (weakActionsCount > 0) {
    score -= Math.min(15, weakActionsCount * 4);
    reasons.push(
      isRussian
        ? "Слишком абстрактные действия"
        : "Actions are too abstract"
    );
  }

  if (
    !/противореч|напряж|tension|contradiction/i.test(
      result.profileSummary.toLowerCase()
    )
  ) {
    score -= 6;
    reasons.push(
      isRussian
        ? "Нет tension/противоречия в профиле"
        : "No tension/contradiction in summary"
    );
  }

  const q10 = normalizeText(answers[9] || "").toLowerCase();
  const q10Words = tokenize(q10);

  if (q10Words.length > 0) {
    const roleMatch = result.bestFitRoles.some((role) => {
      const haystack = `${role.role} ${role.explanation}`.toLowerCase();
      return q10Words.some((word) => haystack.includes(word));
    });

    if (!roleMatch) {
      score -= 10;
      reasons.push(
        isRussian
          ? "Роли слабо согласованы с интересом из Q10"
          : "Roles are weakly aligned with Q10 interest"
      );
    }
  }

  const rolesText = result.bestFitRoles
    .map((r) => `${r.role} ${r.explanation}`)
    .join(" ")
    .toLowerCase();

  const planText = [
    ...result.actionPlan.immediate,
    ...result.actionPlan.exploration,
    ...result.actionPlan.validation,
    result.recommendedNextStep,
    result.actionPlan.nextMove,
  ]
    .join(" ")
    .toLowerCase();

  const hasJewelryRole = /jewel|gem|ювел|гемм/.test(rolesText);
  const hasTestingRole = /qa|test|тест|quality/.test(rolesText);
  const hasProductRole = /product|prodact|продакт/.test(rolesText);
  const hasPeopleRole =
    /community|mentor|learning|координатор|настав|обуч/.test(rolesText);

  const shouldCheckRoleAlignment =
    hasJewelryRole || hasTestingRole || hasProductRole || hasPeopleRole;

  if (shouldCheckRoleAlignment) {
    const roleAligned =
      (hasJewelryRole && /jewel|gem|ювел|гемм/.test(planText)) ||
      (hasTestingRole && /qa|test|тест|quality/.test(planText)) ||
      (hasProductRole && /product|prodact|продакт/.test(planText)) ||
      (hasPeopleRole &&
        /community|mentor|learning|координатор|настав|обуч/.test(planText));

    if (!roleAligned) {
      score -= 12;
      reasons.push(
        isRussian
          ? "План действий слабо согласован с итоговыми ролями"
          : "Action plan is weakly aligned with final roles"
      );
    }
  }

    const weakWhyCount = result.whyThisResult.filter(isWeakWhy).length;
    if (weakWhyCount > 0) {
      score -= Math.min(15, weakWhyCount * 5);
      reasons.push(
        isRussian
          ? "whyThisResult слишком близок к пересказу ответов"
          : "whyThisResult is too close to answer paraphrase"
      );
    }

    const weakValidationCount = result.actionPlan.validation.filter(isWeakValidation).length;
    if (weakValidationCount > 0) {
      score -= Math.min(12, weakValidationCount * 6);
      reasons.push(
        isRussian
          ? "Validation слишком абстрактный"
          : "Validation is too abstract"
      );
    }

    if (isWeakRecommendedNextStep(result.recommendedNextStep)) {
      score -= 10;
      reasons.push(
        isRussian
          ? "recommendedNextStep слишком общий"
          : "recommendedNextStep is too generic"
      );
    }

  const weakRoleExplanationCount = result.bestFitRoles.filter((role) =>
    isWeakRoleExplanation(role.explanation)
  ).length;

  if (weakRoleExplanationCount > 0) {
    score -= Math.min(12, weakRoleExplanationCount * 4);
    reasons.push(
      isRussian
        ? "Объяснения ролей слишком шаблонные"
        : "Role explanations are too generic"
    );
  }

    const weakMismatchCount = result.potentialMismatches.filter(isWeakMismatch).length;
    if (weakMismatchCount > 0) {
      score -= Math.min(8, weakMismatchCount * 4);
      reasons.push(
        isRussian
          ? "potentialMismatches слишком шаблонные"
          : "potentialMismatches are too templated"
      );
    }

    const weakSkillsCount = result.actionPlan.skillsToDevelop.filter(isWeakSkillItem).length;
    if (weakSkillsCount > 0) {
      score -= Math.min(12, weakSkillsCount * 4);
      reasons.push(
        isRussian
          ? "skillsToDevelop слишком общие"
          : "skillsToDevelop are too generic"
      );
    }

  return {
    score: Math.max(0, score),
    reasons,
  };
}

function getSystemPrompt(isRussian: boolean, isLowQuality: boolean): string {
  const base = isRussian ? SYSTEM_PROMPT_RU : SYSTEM_PROMPT_EN;
  if (!isLowQuality) return base;

  const note = isRussian
    ? "⚠️ ВНИМАНИЕ: Ответы очень короткие. Делай осторожные выводы и давай более широкие, но всё ещё конкретные варианты."
    : "⚠️ NOTE: Answers are very short. Make careful inferences and offer broader but still concrete options.";

  return `${base}\n\n${note}`;
}

function buildRegenerationPrompt(
  originalPrompt: string,
  qualityReasons: string[],
  isRussian: boolean
): string {
  const feedback = isRussian
    ? `Предыдущий вариант был недостаточно сильным. Исправь результат с учётом замечаний:\n- ${qualityReasons.join("\n- ")}\n\nСделай вывод глубже, конкретнее и сильнее. Не ослабляй структуру JSON. Верни только чистый JSON.`
    : `The previous result was not strong enough. Regenerate it using this feedback:\n- ${qualityReasons.join("\n- ")}\n\nMake the result deeper, more specific, and more insightful. Keep the JSON structure strict. Return only clean JSON.`;

  return `${originalPrompt}\n\n${feedback}`;
}

function buildReviewPrompt(
  answers: string[],
  language: Language,
  candidate: MentraResponse
): string {
  const isRussian = language === "ru";

  const formattedAnswers = answers
    .map((answer, index) => `Q${index + 1}: ${answer || "(empty)"}`)
    .join("\n");

  const candidateJson = JSON.stringify(candidate, null, 2);

  return isRussian
    ? `Ты проверяешь результат карьерного AI-анализа как строгий редактор качества.

Твоя задача: оценить, насколько результат ниже соответствует ответам пользователя и внутренним правилам качества.

ПРОВЕРЬ:
1. whyThisResult не пересказывает ответы пользователя и не звучит шаблонно
2. keyStrengths не банальные и не слишком общие
3. bestFitRoles реалистичны и не слишком "широкие" или выдуманные
4. recommendedNextStep конкретный, не абстрактный, не "изучить/посмотреть/исследовать"
5. validation действительно проверяет fit, а не просто "поговорить с кем-то"
6. план действий согласован с ролями
7. нет странного, битого, смешанного языка
8. нет внутренних противоречий
9. если ответы короткие — выводы всё равно не должны быть натянутыми

Верни ТОЛЬКО JSON такого вида:
{
  "verdict": "accept" | "revise" | "fallback",
  "issues": ["проблема 1", "проблема 2"]
}

Выбирай:
- "accept" если результат достаточно хороший
- "revise" если его можно исправить одной доработкой
- "fallback" если результат слишком слабый и проще не спасать

ОТВЕТЫ ПОЛЬЗОВАТЕЛЯ:
${formattedAnswers}

РЕЗУЛЬТАТ ДЛЯ ПРОВЕРКИ:
${candidateJson}`
    : `You are reviewing a career-analysis result as a strict quality editor.

Your task is to assess whether the result below is actually good enough based on the user's answers and the product quality rules.

CHECK:
1. whyThisResult does not paraphrase the user's answers too directly and does not sound generic
2. keyStrengths are not banal or overly broad
3. bestFitRoles are realistic and not vague or invented
4. recommendedNextStep is concrete, not abstract, not just "learn/explore/research"
5. validation actually tests fit instead of just "talk to someone"
6. the action plan is aligned with the roles
7. there is no broken or mixed language
8. there are no internal contradictions
9. if answers are short, conclusions should still stay careful and not overreach

Return ONLY JSON in this format:
{
  "verdict": "accept" | "revise" | "fallback",
  "issues": ["issue 1", "issue 2"]
}

Choose:
- "accept" if the result is good enough
- "revise" if it can be improved with one more pass
- "fallback" if the result is too weak to save

USER ANSWERS:
${formattedAnswers}

RESULT TO REVIEW:
${candidateJson}`;
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
  answers: readonly string[],
  questions: readonly (string | { question: string })[]
): string {
  const emptyAnswer = language === "ru" ? "(нет ответа)" : "(no answer)";

  const formattedAnswersWithQuestions = answers
    .map((answer, index) => {
      const questionObj = questions[index];
      const question =
        typeof questionObj === "string" ? questionObj : questionObj.question;

      return `Q${index + 1}: ${question}\nA${index + 1}: ${answer || emptyAnswer}`;
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
      /mentor|teaching|teach|coach|community|support role|help people|обуч|настав|коуч|ментор|объяснять людям|сопровождать/i.test(
        allText
      ),
    hasCoordination:
    /координир|organize people|manage workflow|operations|team coordination|организовывать работу/i.test(allText),
    hasUncertainty:
     /idk|not sure|maybe|whatever|don't know|не знаю|без понятия/i.test(allText),
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
    hasExecution:
      /доводить|довести|делать до конца|заканчивать|исполнять|внедрять|собирать результат|execute|execution|deliver|finish|complete|implement|ship/i.test(allText),

    likesConcreteOutput:
      /результат|конкретн|практич|готовый результат|видимый итог|visible outcome|practical|deliverable|outcome/i.test(allText),

    likesStableProcess:
      /процесс|ритм|предсказуем|стабильн|routine|workflow|stable|predictable/i.test(allText),
  };
}

function buildFallbackResponse(
  language: Language,
  answersQuality: AnswersQualitySummary,
  signals: ReturnType<typeof extractSignals>
): MentraResponse {
  const isRussian = language === "ru";
  const isLowQuality =
    answersQuality.avgLength < 50 ||
    answersQuality.emptyCount > 3 ||
    answersQuality.shortCount >= 5;

  let profileType = "";
  let bestFitRoles: BestFitRole[] = [];

  if (signals.hasUncertainty) {
    profileType = isRussian ? "Исследователь направлений" : "Direction Explorer";

    bestFitRoles = [
      {
        role: isRussian ? "Стажёр в проектной роли" : "Project Intern",
        explanation: isRussian
          ? "Сейчас важнее безопасно попробовать разные рабочие форматы, чем сразу выбирать узкую карьерную роль."
          : "Right now it is better to safely test different work formats than to lock into a narrow career role.",
      },
      {
        role: isRussian
          ? "Ассистент проектной команды"
          : "Project Team Assistant",
        explanation: isRussian
          ? "Подходит как мягкий вход: можно попробовать разные задачи, увидеть, что даётся легче, и не делать слишком жёсткий выбор заранее."
          : "A softer entry point: it lets you try different tasks, notice what comes naturally, and avoid choosing too narrowly too early.",
      },
    ];
  } else if (signals.q10Jewelry) {
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
  } else if (signals.hasExecution && signals.likesConcreteOutput) {
    profileType = isRussian
      ? "Исполнитель-практик"
      : "Execution-Oriented Builder";

    bestFitRoles = [
      {
        role: isRussian ? "Операционный координатор" : "Operations Coordinator",
        explanation: isRussian
          ? "Подходит человеку, который умеет собирать задачу в рабочий процесс и доводить её до понятного результата."
          : "Fits someone who can turn a task into a working process and carry it through to a clear result.",
      },
      {
        role: isRussian ? "Координатор проектов" : "Project Coordinator",
        explanation: isRussian
          ? "Хороший вариант, если важны движение вперёд, ответственность за ход работы и практический итог."
          : "A strong option if progress, ownership of execution, and practical outcomes matter.",
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

  const roleExample =
    bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");

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

    return {
      profileType,

      profileSummary: isRussian
        ? signals.hasUncertainty
          ? "Сейчас у вас не столько готовый карьерный вектор, сколько этап разведки. Это не слабость: вам важно попробовать несколько небольших форматов работы и по фактам понять, где появляется энергия, ясность и ощущение прогресса."
          : signals.q10Jewelry
            ? "Вы тяготеете к точной и предметной работе, где важно не просто делать, а разбираться, сравнивать и оценивать. Вам подходит формат, в котором есть критерии, детали и возможность самостоятельно выстраивать ход анализа."
            : signals.q10Testing
              ? "Вам ближе работа, где ценятся точность, проверка и внимательность к деталям. Вы хорошо проявляетесь там, где нужно замечать несоответствия и доводить результат до более надёжного состояния."
              : signals.q10Creative
                ? "Вас заряжает создание нового, но лучше всего идеи раскрываются у вас тогда, когда их можно собрать в понятную форму. Вам важно не просто придумать, а увидеть, как замысел становится результатом."
                : signals.q10People
                  ? "Вы тяготеете к ролям, где можно быть полезной другим людям через объяснение, поддержку и сопровождение. Вам важно чувствовать, что ваша работа имеет понятный человеческий смысл."
                  : signals.hasExecution && signals.likesConcreteOutput
                    ? "Вам ближе работа, где задача не зависает в обсуждениях, а постепенно превращается в готовый результат. Вы хорошо раскрываетесь там, где можно собрать процесс, удержать ход выполнения и видеть практический итог."
                    : "Вы лучше всего раскрываетесь там, где можно не просто выполнять задачу, а понимать её логику и влиять на качество результата. Вам подходит сочетание самостоятельности, конкретики и практической пользы."
        : signals.hasUncertainty
          ? "You are not at a fixed career direction yet; you are in a discovery phase. That is not a weakness: you need to test a few small work formats and notice where energy, clarity, and a sense of progress appear."
          : signals.q10Jewelry
            ? "You lean toward precise, object-focused work where it matters not just to do the task, but to compare, assess, and understand. You fit formats with criteria, detail, and enough autonomy to shape your own analysis."
            : signals.q10Testing
              ? "You are drawn to work built on precision, checking, and attention to detail. You perform well where spotting inconsistencies and improving reliability matters."
              : signals.q10Creative
                ? "Creating new things energizes you, but your ideas work best when they can be shaped into something concrete. It matters to you not only to imagine, but to turn ideas into outcomes."
                : signals.q10People
                  ? "You are drawn to roles where you can be useful through explanation, support, and guidance. It matters to you that your work has visible human value."
                  : signals.hasExecution && signals.likesConcreteOutput
                    ? "You are drawn to work where tasks do not stay in discussion forever, but gradually become finished outcomes. You perform well where you can organize the process, maintain execution flow, and see practical results."
                    : "You do best where you are not just executing tasks, but understanding their logic and improving the final result. A mix of autonomy, clarity, and practical usefulness suits you well.",

      recommendedNextStep: isRussian
        ? signals.hasUncertainty
          ? "Выберите 3 маленькие пробные задачи из разных сфер и после каждой запишите: было ли понятно, интересно и хотелось ли продолжать."
          : signals.q10Jewelry
            ? "Найдите 3 источника по теме оценки ювелирных изделий и выпишите, какие знания и инструменты там повторяются чаще всего."
            : signals.q10Testing
              ? "Найдите 3 вакансии QA-специалиста и выделите повторяющиеся требования к навыкам и инструментам."
              : signals.q10Creative
                ? "Оформите одну свою идею в короткий текст или 2-3 слайда и покажите её одному человеку для обратной связи."
                : signals.q10People
                  ? "Напишите 3 вопроса человеку из роли, связанной с поддержкой или обучением, и найдите 2-3 профиля, кому их можно отправить."
                  : signals.hasExecution && signals.likesConcreteOutput
                    ? "Возьмите одну небольшую задачу и разложите её на шаги: цель, порядок действий, критерий готовности и возможные блокеры."
                    : "Найдите 3 подходящие вакансии и выпишите повторяющиеся требования — это даст более реалистичное понимание направления."
        : signals.hasUncertainty
          ? "Choose 3 small trial tasks from different areas and after each one note whether it felt clear, interesting, and worth continuing."
          : signals.q10Jewelry
            ? "Find 3 sources about jewelry appraisal and note which knowledge areas and tools appear most often."
            : signals.q10Testing
              ? "Find 3 QA job postings and highlight recurring requirements in skills and tools."
              : signals.q10Creative
                ? "Turn one of your ideas into a short text or 2-3 slides and show it to one person for feedback."
                : signals.q10People
                  ? "Write 3 questions for someone in a support or learning-related role and find 2-3 profiles you could send them to."
                  : signals.hasExecution && signals.likesConcreteOutput
                    ? "Take one small task and break it down into: goal, action steps, definition of done, and possible blockers."
                    : "Find 3 relevant job postings and note recurring requirements to get a more realistic picture of the direction.",

      whyThisResult: buildStrongWhyFallback(language, signals),

      keyStrengths: isRussian
        ? [
            signals.hasUncertainty
              ? "Готовы честно признавать неопределённость вместо того, чтобы искусственно выбирать случайное направление."
              : "Быстро выделяете главное в задаче и не тратите много времени на второстепенное.",
            "Можете работать самостоятельно, но не разваливаете процесс — удерживаете внутреннюю рамку.",
            signals.hasPeople
              ? "Умеете переводить сложное в понятные объяснения без давления и лишней сложности."
              : signals.hasExecution && signals.likesConcreteOutput
                ? "Умеете превращать размытую задачу в понятный порядок действий."
                : signals.hasUncertainty
                  ? "Можете сравнивать варианты через маленькие пробы, а не через бесконечные размышления."
                  : "Замечаете слабые места в результате и естественно тянетесь к улучшению качества.",
          ]
        : [
            signals.hasUncertainty
              ? "You can honestly acknowledge uncertainty instead of forcing yourself into a random direction."
              : "You quickly isolate the core of a task instead of getting lost in secondary details.",
            "You can work independently without losing structure or internal discipline.",
            signals.hasPeople
              ? "You can translate complex things into clear explanations without sounding heavy or rigid."
              : signals.hasExecution && signals.likesConcreteOutput
                ? "You can turn a vague task into a clear sequence of actions."
                : signals.hasUncertainty
                  ? "You can compare options through small experiments rather than endless thinking."
                  : "You naturally notice weak points in a result and want to improve the quality of it.",
          ],

      workStyle: isRussian
        ? signals.hasUncertainty
          ? "Работаете лучше через короткие пробы: сначала пробуете маленький фрагмент задачи, затем оцениваете, стало ли понятнее и захотелось ли продолжать. Сейчас вам вредны слишком большие решения заранее — полезнее собирать направление через факты."
          : `${chaosInterpretation} Вы обычно начинаете с общего понимания задачи, затем отсеиваете лишнее через логику и только потом переходите к реализации.`
        : signals.hasUncertainty
          ? "You work best through short trials: first trying a small piece of a task, then checking whether it became clearer and whether you wanted to continue. Big decisions too early are not helpful right now; evidence from small experiments is more useful."
          : `${chaosInterpretation} You usually start by building a broad understanding of the task, then filter the noise through logic, and only after that move into execution.`,

      bestFitRoles,

      potentialMismatches: isRussian
        ? signals.hasUncertainty
          ? [
              "Роль, где нужно сразу выбрать узкую специализацию без пробного периода.",
              "Среда, где ошибки в выборе направления воспринимаются как провал, а не как часть исследования.",
            ]
          : [
              "Жёстко регламентированная среда без пространства для собственного подхода.",
              "Работа, где много суеты, но мало ясных критериев качества.",
            ]
        : signals.hasUncertainty
          ? [
              "A role that requires choosing a narrow specialization immediately without a trial period.",
              "An environment where a wrong direction is treated as failure rather than part of discovery.",
            ]
          : [
              "A rigid environment with no room for your own approach.",
              "Work with a lot of noise but very few clear quality criteria.",
            ],

      actionPlan: {
        immediate: isRussian
          ? signals.hasUncertainty
            ? [
                "Запишите 5 задач, которые вы готовы попробовать без долгой подготовки.",
                "Выберите 3 из них и выполните каждую в мини-формате до 30 минут.",
              ]
            : signals.q10Jewelry
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
                    : signals.hasExecution && signals.likesConcreteOutput
                      ? [
                          "Выберите одну небольшую задачу и запишите её цель, критерий готовности и первый следующий шаг.",
                          "Разложите эту задачу на 5-7 конкретных действий в правильном порядке.",
                        ]
                      : [
                          "Сохраните 3 вакансии и выпишите по одному повторяющемуся требованию из каждой.",
                          "Набросайте 3 пункта о том, как бы вы улучшили знакомый вам процесс.",
                        ]
          : signals.hasUncertainty
            ? [
                "Write down 5 tasks you would be willing to try without long preparation.",
                "Choose 3 of them and complete each one in a mini-format of up to 30 minutes.",
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
                    : signals.hasExecution && signals.likesConcreteOutput
                      ? [
                          "Choose one small task and write down its goal, definition of done, and next action.",
                          "Break that task into 5-7 concrete actions in the right order.",
                        ]
                      : [
                          "Save 3 job postings and note one recurring requirement from each.",
                          "Jot down 3 bullet points on how you would improve a process you know.",
                        ],

        exploration: isRussian
          ? signals.hasUncertainty
            ? [
                "Посмотрите 3 разных направления: проектная работа, поддержка людей и работа с качеством. Для каждого выпишите, что вас привлекает и что отталкивает.",
                "Найдите 2-3 человека с разными ролями и сравните, какие задачи повторяются в их работе.",
              ]
            : signals.hasExecution && signals.likesConcreteOutput
              ? [
                  "Посмотрите 2-3 профиля операционных координаторов или координаторов проектов и выпишите, какие задачи у них повторяются.",
                  "Найдите один пример проектного плана или чек-листа и разберите, как там устроен порядок выполнения.",
                ]
              : [
                  `Проведите 15-минутный разговор с человеком, который работает в роли "${roleExample}". Спросите: "Что самое неожиданное в работе?" и "Какой навык недооценивают новички?"`,
                  `Проанализируйте 3 профиля "${roleExample}" и выпишите общие элементы в опыте и навыках.`,
                ]
          : signals.hasUncertainty
            ? [
                "Review 3 different directions: project work, people support, and quality-focused work. For each one, note what attracts you and what pushes you away.",
                "Find 2-3 people in different roles and compare which tasks repeat in their work.",
              ]
            : signals.hasExecution && signals.likesConcreteOutput
              ? [
                  "Review 2-3 profiles of operations coordinators or project coordinators and note which tasks repeat.",
                  "Find one example of a project plan or checklist and analyze how the execution flow is structured.",
                ]
              : [
                  `Conduct a 15-minute conversation with someone working as a "${roleExample}". Ask: "What is the most surprising part of the job?" and "What skill do beginners underestimate?"`,
                  `Analyze 3 "${roleExample}" profiles and note common patterns in experience and skills.`,
                ],

        validation: buildValidationFallback(
          language,
          signals.hasUncertainty
            ? "general"
            : signals.hasExecution && signals.likesConcreteOutput
              ? "execution"
              : signals.q10Jewelry
                ? "jewelry"
                : signals.q10Testing
                  ? "testing"
                  : signals.q10Creative
                    ? "creative"
                    : signals.q10People
                      ? "people"
                      : "general"
        ),

        skillsToDevelop: buildStrongSkillsFallback(
          language,
          signals.hasUncertainty
            ? "general"
            : signals.hasExecution && signals.likesConcreteOutput
              ? "execution"
              : signals.q10Jewelry
                ? "jewelry"
                : signals.q10Testing
                  ? "testing"
                  : signals.q10Creative
                    ? "creative"
                    : signals.q10People
                      ? "people"
                      : "general"
        ),

        nextMove: isRussian
          ? signals.hasUncertainty
            ? "В течение недели выполните три мини-пробы по 30 минут и выберите одно направление, которое дало больше всего ясности или энергии."
            : signals.q10Jewelry
              ? "В течение недели выберите один вводный материал по геммологии и попробуйте применить его к оценке одного реального объекта."
              : signals.q10Testing
                ? "В течение недели пройдите один короткий вводный материал по QA и оформите один пробный баг-репорт."
                : signals.q10Creative
                  ? "В течение недели доведите одну идею до короткого оформленного результата и получите хотя бы один внешний комментарий."
                  : signals.q10People
                    ? "В течение недели найдите одну реальную возможность попробовать себя в роли помощника, наставника или координатора хотя бы в небольшом формате."
                    : signals.hasExecution && signals.likesConcreteOutput
                      ? "В течение недели доведите одну небольшую задачу до готового результата и зафиксируйте, какие шаги помогли не потерять ход выполнения."
                      : "Выберите один небольшой проект и доведите его до законченного результата в течение двух недель."
          : signals.hasUncertainty
            ? "Within a week, complete three 30-minute mini-trials and choose one direction that gave you the most clarity or energy."
            : signals.q10Jewelry
              ? "Within a week, choose one introductory gemology resource and apply it to evaluating one real object."
              : signals.q10Testing
                ? "Within a week, complete one short QA introduction and write one trial bug report."
                : signals.q10Creative
                  ? "Within a week, take one idea to a short finished format and get at least one external comment on it."
                  : signals.q10People
                    ? "Within a week, find one real opportunity to try a helper, mentor, or coordinator role, even in a small format."
                    : signals.hasExecution && signals.likesConcreteOutput
                      ? "Within a week, bring one small task to a finished result and note which steps helped you keep execution moving."
                      : "Choose one small project and bring it to a finished result within two weeks.",
      },

      _note: isLowQuality
        ? isRussian
          ? "⚠️ Анализ основан на коротких ответах."
          : "⚠️ Analysis based on short answers."
        : undefined,
    };
}

function buildValidationFallback(
  language: Language,
  track: MentraTrack
): string[] {
  const isRussian = language === "ru";

  if (track === "jewelry") {
    return isRussian
      ? [
          "Попробуйте сделать пробную оценку любого украшения или камня по открытым критериям и запишите ход мыслей.",
          "Покажите свои заметки в тематическом сообществе или знакомому, который разбирается в теме, и попросите комментарий.",
        ]
      : [
          "Try making a rough appraisal of any piece of jewelry or gemstone using public criteria and write down your reasoning.",
          "Share your notes with a relevant community or someone knowledgeable and ask for feedback.",
        ];
  }

  if (track === "testing") {
    return isRussian
      ? [
          "Составьте чек-лист для тестирования простой функции и попросите кого-то оценить, достаточно ли он понятен и полный.",
          "Напишите короткий баг-репорт по найденной проблеме и проверьте, может ли другой человек воспроизвести её по вашему описанию.",
        ]
      : [
          "Create a checklist for testing a simple feature and ask someone whether it is clear and complete enough.",
          "Write a short bug report for an issue you found and check whether another person can reproduce it from your description.",
        ];
  }

  if (track === "creative") {
    return isRussian
      ? [
          "Оформите одну идею в виде короткой презентации или поста и покажите её 1-2 людям.",
          'Спросите: "Что здесь самое сильное, а что пока неубедительно?"',
        ]
      : [
          "Turn one idea into a short presentation or post and show it to 1-2 people.",
          'Ask: "What feels strongest here, and what still feels weak?"',
        ];
  }

  if (track === "people") {
    return isRussian
      ? [
          "Проведите пробное объяснение сложной темы простыми словами другу или коллеге.",
          "Попросите обратную связь о том, насколько это было понятно, полезно и не перегружено.",
        ]
      : [
          "Try explaining a complex topic in simple terms to a friend or colleague.",
          "Ask for feedback on whether it felt clear, useful, and not overloaded.",
        ];
  }

  if (track === "execution") {
    return isRussian
      ? [
          "Возьмите небольшую задачу и разложите её на 5-7 шагов с понятным порядком выполнения и критерием готовности.",
          "Покажите этот план человеку с опытом в операциях или проектах и спросите: «Где здесь слабое место в логике исполнения?»",
        ]
      : [
          "Take a small task and break it into 5-7 steps with a clear execution order and a definition of done.",
          'Show that plan to someone with project or operations experience and ask: "Where is the execution logic weakest here?"',
        ];
  }

  return isRussian
    ? [
        "Возьмите знакомый процесс и опишите его в 5-7 шагах: где возникают сбои, что можно измерить и что стоит улучшить в первую очередь.",
        "Покажите этот разбор человеку с опытом в операциях, качестве или аналитике и спросите: «Где логика слабая, а где улучшение уже выглядит практичным?»",
      ]
    : [
        "Take a process you know and describe it in 5-7 steps: where it breaks, what can be measured, and what should be improved first.",
        'Show that breakdown to someone with experience in operations, quality, or analysis and ask: "Where is the logic weak, and where does the improvement already look practical?"',
      ];
}

function buildStrongWhyFallback(
  language: Language,
  signals: ReturnType<typeof extractSignals>
): string[] {
  const isRussian = language === "ru";

  if (signals.q10Jewelry) {
    return isRussian
      ? [
          "Тебе подходит работа, где можно опираться на критерии, сравнение признаков и аккуратную аргументацию.",
          "Точность для тебя важнее скорости, особенно когда нужно сделать обоснованный вывод.",
          "Лучше всего ты раскрываешься там, где есть конкретный объект анализа, а не абстрактная суета.",
        ]
      : [
          "You fit work built on criteria, comparison, and careful reasoning.",
          "Accuracy matters to you more than speed when a solid judgment is required.",
          "You work best when there is a concrete object of analysis rather than vague motion.",
        ];
  }

  if (signals.q10Testing) {
    return isRussian
      ? [
          "Тебя скорее включает поиск слабых мест и несостыковок, чем запуск сырой идеи с нуля.",
          "Когда есть понятные критерии качества, ты работаешь спокойнее и точнее.",
          "Твой сильный режим — замечать, где система ломается, и доводить её до более надёжного состояния.",
        ]
      : [
          "You are more energized by finding weak points and inconsistencies than by launching raw ideas from scratch.",
          "Clear quality criteria help you work with more confidence and precision.",
          "Your strong mode is spotting where a system breaks and helping make it more reliable.",
        ];
  }

  if (signals.q10Creative) {
    return isRussian
      ? [
          "Идеи для тебя важны не сами по себе — тебе нужен момент, когда они превращаются в заметный результат.",
          "Ты сильнее всего в задачах, где можно соединить свободу хода с внутренней структурой.",
          "Тебя заряжает не хаотичное творчество, а оформление замысла в понятную форму.",
        ]
      : [
          "Ideas matter to you not on their own, but when they become something visible and usable.",
          "You are strongest in work that combines freedom of approach with internal structure.",
          "You are energized less by chaos and more by shaping an idea into a clear form.",
        ];
  }

  if (signals.q10People) {
    return isRussian
      ? [
          "Ты лучше всего проявляешься там, где можно снижать чужую растерянность и добавлять ясность.",
          "Для тебя важен не формальный контакт с людьми, а ощущение реальной пользы для них.",
          "Твоё сильное место — объяснять, поддерживать и удерживать человека в процессе без лишнего давления.",
        ]
      : [
          "You do best where you can reduce confusion for other people and add clarity.",
          "What matters to you is not social contact by itself, but being genuinely useful.",
          "Your strong zone is explaining, supporting, and helping someone stay in the process without pressure.",
        ];
  }

   if (signals.hasExecution && signals.likesConcreteOutput) {
     return isRussian
       ? [
           "Тебя заряжает не абстрактное обсуждение, а момент, когда задача начинает реально двигаться к результату.",
           "Ты лучше всего проявляешься там, где нужно собрать работу в понятный ход и довести её до завершения.",
           "Для тебя важна не только идея, но и ощущение, что из неё получился практический итог.",
         ]
       : [
           "You are energized less by abstract discussion and more by seeing a task actually move toward completion.",
           "You do best where work needs to be turned into a clear process and carried through.",
           "It matters to you not only to have an idea, but to turn it into a practical outcome.",
         ];
   }

  return isRussian
    ? [
        "Тебе подходит работа, где нужно не просто делать задачу, а улучшать её качество и понятность.",
        "Ты сильнее в среде, где самостоятельность сочетается с ясной логикой и рабочими ориентирами.",
        "Лучший для тебя формат — видеть, как из разрозненной задачи получается более собранный и качественный результат.",
      ]
    : [
        "You fit work where the task is not just to execute, but to improve quality and clarity.",
        "You are stronger in environments where autonomy is paired with logic and clear reference points.",
        "Your best format is turning something scattered into a more coherent and higher-quality result.",
      ];
}

function buildWorkStyleFallback(
  language: Language,
  track: MentraTrack,
  answers: string[]
): string {
  const isRussian = language === "ru";
  const allText = answers.join(" ").toLowerCase();
  const q8 = (answers[7] || "").toLowerCase();

  const likesChaos = /хаос|chaos/i.test(q8);
  const dislikesUncertainty = /неопредел|uncertain/i.test(allText);
  const wantsAutonomy = /свобод|autonom|freedom|independ/i.test(allText);

  if (track === "jewelry") {
    return isRussian
      ? "Работаете вдумчиво и спокойно: сначала собираете признаки, затем сравниваете их по критериям и только после этого делаете вывод. Вам проще показывать сильный результат там, где можно не спешить и опираться на точность."
      : "You work in a calm and deliberate way: first gathering traits, then comparing them against criteria, and only after that making a judgment. You do your best where precision matters more than speed.";
  }

  if (track === "testing") {
    return isRussian
      ? "Работаете через проверку и уточнение: сначала понимаете логику системы, затем ищете слабые места, граничные случаи и несостыковки. Вам подходит формат, где можно опираться на критерии качества, но при этом самостоятельно выстраивать ход проверки."
      : "You work through verification and clarification: first understanding the system logic, then looking for weak points, edge cases, and inconsistencies. You do well where quality criteria are clear but the checking process still requires independent thinking.";
  }

  if (track === "creative") {
    return isRussian
      ? "Работаете итеративно: сначала собираете идею в черновую форму, затем структурируете её и проверяете, насколько она выглядит убедительно для других. Вам важна свобода в подаче, но без внутренней рамки идея быстро теряет для вас ценность."
      : "You work iteratively: first shaping an idea in rough form, then structuring it and testing whether it feels convincing to others. Freedom matters to you, but without an internal frame the idea quickly loses value.";
  }

  if (track === "people") {
    return isRussian
      ? "Работаете через понимание человека и прояснение ситуации: сначала слушаете и уточняете, потом переводите сложное в понятную форму и помогаете двигаться дальше без лишнего давления. Вам лучше подходит спокойный, устойчивый ритм, чем агрессивная суета."
      : "You work through understanding the person and clarifying the situation: first listening and asking questions, then translating complexity into something clear and helping the person move forward without pressure. A steady, calm rhythm suits you better than aggressive urgency.";
  }

  if (track === "execution") {
    return isRussian
      ? "Работаете через последовательное продвижение: сначала собираете задачу в понятные шаги, затем удерживаете темп и доводите её до результата без лишней суеты. Вам подходит формат, где важны надёжность, завершение и практический итог."
      : "You work through steady execution: first turning a task into clear steps, then maintaining momentum and carrying it to completion without unnecessary chaos. You fit environments where reliability, follow-through, and practical outcomes matter.";
  }

  if (likesChaos && !dislikesUncertainty) {
    return isRussian
      ? "Вы нормально держитесь в подвижной среде: можете быстро собрать суть задачи, выделить главное и навести порядок в разрозненной информации. При этом лучше всего работаете там, где после первого хаоса всё же можно выйти на ясную логику действий."
      : "You can function well in fast-moving environments: quickly finding the core of a task, identifying what matters, and imposing order on scattered information. Still, you work best when early chaos eventually gives way to a clear logic of action.";
  }

  if (wantsAutonomy) {
    return isRussian
      ? "Работаете самостоятельно и системно: сначала определяете, что именно является целью, где критерий качества и что мешает результату, а потом двигаетесь к более собранному решению. Вам подходит формат, где есть свобода в способе работы, но понятен ожидаемый итог."
      : "You work independently and systematically: first defining the goal, the quality bar, and what blocks the result, then moving toward a more coherent solution. You do best where you have freedom in execution but the expected outcome is still clear.";
  }

  return isRussian
    ? "Работаете через разбор и упорядочивание: сначала понимаете логику задачи, затем отделяете важное от второстепенного и постепенно улучшаете результат. Вам ближе практический формат, где можно не просто выполнить задачу, а сделать её более надёжной и ясной."
    : "You work through analysis and structuring: first understanding the task logic, then separating what matters from what does not, and gradually improving the result. A practical format suits you best, where the job is not only to execute but to make the outcome clearer and more reliable.";
}

function buildMismatchesFallback(
  language: Language,
  track: MentraTrack
): string[] {
  const isRussian = language === "ru";

  if (track === "jewelry") {
    return isRussian
      ? [
          "Работа, где нужно всё время спешить и принимать выводы без достаточных оснований.",
          "Среда, где почти нет критериев, стандартов или возможности спокойно сравнивать детали.",
        ]
      : [
          "Work that requires constant speed and snap judgments without enough basis for them.",
          "An environment with very few criteria, standards, or room for careful comparison.",
        ];
  }

  if (track === "testing") {
    return isRussian
      ? [
          "Роли, где от человека ждут только быстрого исполнения без проверки, логики и критериев качества.",
          "Среда, где ошибки приходится игнорировать ради темпа или внешней видимости результата.",
        ]
      : [
          "Roles where the expectation is pure execution without checking, logic, or quality criteria.",
          "An environment where issues must be ignored for the sake of speed or appearance.",
        ];
  }

  if (track === "creative") {
    return isRussian
      ? [
          "Работа, где нет пространства для собственного подхода и всё сводится к механическому исполнению.",
          "Среда, где идеи нельзя оформить, показать и довести до заметного результата.",
        ]
      : [
          "Work with no room for your own approach, where everything is reduced to mechanical execution.",
          "An environment where ideas cannot be shaped, shown, and turned into visible outcomes.",
        ];
  }

  if (track === "people") {
    return isRussian
      ? [
          "Роли, где приходится постоянно давить на людей вместо того, чтобы помогать им разбираться и двигаться дальше.",
          "Среда с холодной коммуникацией, жёсткой конкуренцией и отсутствием доверия.",
        ]
      : [
          "Roles where the job is to pressure people rather than help them understand and move forward.",
          "An environment built on cold communication, hard competition, and low trust.",
        ];
  }

  if (track === "execution") {
    return isRussian
      ? [
          "Среда, где много идей и обсуждений, но почти нет движения к реальному результату.",
          "Работа, где всё постоянно меняется и невозможно удержать понятный ход выполнения.",
        ]
      : [
          "An environment full of ideas and discussion but with very little movement toward real outcomes.",
          "Work where everything keeps changing and it is impossible to maintain a clear execution flow.",
        ];
  }

  return isRussian
    ? [
        "Работа, где нет возможности разбираться в логике процесса и улучшать качество результата.",
        "Среда с постоянной суетой, размытыми ожиданиями и бессистемными переключениями между задачами.",
      ]
    : [
        "Work with no room to understand process logic or improve the quality of the outcome.",
        "An environment full of noise, vague expectations, and constant unsystematic task-switching.",
      ];
}

function buildStrongSkillsFallback(
  language: Language,
  track: MentraTrack
): SkillToDevelop[] {
  const isRussian = language === "ru";

  if (track === "jewelry") {
    return isRussian
      ? [
          {
            skill: "Базовая геммология",
            why: "Нужна, чтобы понимать свойства камней и уверенно опираться на критерии оценки.",
            howToLearn: "Начните с 3 вводных материалов по геммологии и выпишите основные параметры оценки.",
          },
          {
            skill: "Предметный анализ",
            why: "Помогает сравнивать объекты по признакам и делать аргументированные выводы.",
            howToLearn: "Тренируйтесь описывать украшения или камни по 4-5 признакам и фиксировать различия.",
          },
        ]
      : [
          {
            skill: "Basic gemology",
            why: "It helps you understand stone properties and use evaluation criteria with confidence.",
            howToLearn: "Start with 3 introductory gemology resources and note the core evaluation parameters.",
          },
          {
            skill: "Object-based analysis",
            why: "It helps you compare objects by traits and make grounded judgments.",
            howToLearn: "Practice describing jewelry or stones by 4-5 traits and noting the differences.",
          },
        ];
  }

  if (track === "testing") {
    return isRussian
      ? [
          {
            skill: "Тест-дизайн",
            why: "Это основа сильной QA-работы: не просто проверять, а понимать, что именно надо покрыть.",
            howToLearn: "Возьмите одну простую функцию и составьте для неё чек-лист, негативные сценарии и граничные случаи.",
          },
          {
            skill: "Баг-репорты",
            why: "Хороший QA отличается не только тем, что находит проблему, но и тем, как ясно её описывает.",
            howToLearn: "Напишите 3 пробных баг-репорта по найденным проблемам и сравните, где формулировка понятнее.",
          },
        ]
      : [
          {
            skill: "Test design",
            why: "It is core to QA: not just checking things, but understanding what must be covered.",
            howToLearn: "Take one simple feature and create a checklist, negative scenarios, and edge cases for it.",
          },
          {
            skill: "Bug reporting",
            why: "Strong QA is not only about finding issues, but also describing them clearly.",
            howToLearn: "Write 3 sample bug reports for issues you find and compare which wording is clearer.",
          },
        ];
  }

  if (track === "creative") {
    return isRussian
      ? [
          {
            skill: "Структурирование идей",
            why: "Помогает доводить сырую задумку до понятной концепции, которую можно показать другим.",
            howToLearn: "Берите одну идею и оформляйте её в формат: задача, идея, пример, ожидаемый эффект.",
          },
          {
            skill: "Презентация замысла",
            why: "Креативный результат ценен только тогда, когда его можно убедительно объяснить.",
            howToLearn: "Соберите 3 коротких слайда для одной идеи и покажите их знакомому на обратную связь.",
          },
        ]
      : [
          {
            skill: "Structuring ideas",
            why: "It helps turn a raw idea into a concept other people can understand and evaluate.",
            howToLearn: "Take one idea and package it as: problem, concept, example, expected effect.",
          },
          {
            skill: "Presenting creative concepts",
            why: "A creative result matters more when you can explain it clearly and convincingly.",
            howToLearn: "Build 3 short slides for one idea and show them to someone for feedback.",
          },
        ];
  }

  if (track === "people") {
    return isRussian
      ? [
          {
            skill: "Объяснение сложного простым языком",
            why: "Это делает поддержку и сопровождение реально полезными для другого человека.",
            howToLearn: "Возьмите одну сложную тему и попробуйте объяснить её в 5-6 простых предложениях.",
          },
          {
            skill: "Активное слушание",
            why: "Помогает не навязывать решение, а сначала понять, в чём именно человеку нужна помощь.",
            howToLearn: "В 2-3 разговорах сначала задавайте уточняющие вопросы, а потом коротко пересказывайте услышанное.",
          },
        ]
      : [
          {
            skill: "Explaining complex things simply",
            why: "It makes support and guidance genuinely useful to other people.",
            howToLearn: "Take one complex topic and explain it in 5-6 simple sentences.",
          },
          {
            skill: "Active listening",
            why: "It helps you understand what kind of support a person actually needs before reacting.",
            howToLearn: "In 2-3 conversations, ask clarifying questions first and then briefly restate what you heard.",
          },
        ];
  }

  if (track === "execution") {
    return isRussian
      ? [
          {
            skill: "Декомпозиция задач",
            why: "Помогает превращать размытую задачу в последовательный план действий.",
            howToLearn: "Берите 3 небольшие задачи и расписывайте для каждой шаги, зависимость между ними и критерий завершения.",
          },
          {
            skill: "Контроль хода выполнения",
            why: "Нужен, чтобы замечать, где задача застревает, и вовремя возвращать её в движение.",
            howToLearn: "Ведите короткий трекер: что сделано, что блокирует следующий шаг, что нужно решить сегодня.",
          },
          {
            skill: "Статусная коммуникация",
            why: "Важно не только делать задачу, но и ясно показывать другим, где вы находитесь и что нужно дальше.",
            howToLearn: "Пишите короткие апдейты по схеме: сделано, в работе, риск, следующий шаг.",
          },
        ]
      : [
          {
            skill: "Task decomposition",
            why: "It helps turn a vague task into an ordered plan of action.",
            howToLearn: "Take 3 small tasks and write out the steps, dependencies, and definition of done for each.",
          },
          {
            skill: "Execution tracking",
            why: "It helps you notice where work gets stuck and bring it back into motion in time.",
            howToLearn: "Keep a short tracker: what is done, what blocks the next step, and what must be resolved today.",
          },
          {
            skill: "Status communication",
            why: "It matters not only to do the work, but also to show clearly where things stand and what is needed next.",
            howToLearn: "Practice writing short updates using: done, in progress, risk, next step.",
          },
        ];
  }

  return isRussian
    ? [
        {
          skill: "Диагностика процессов",
          why: "Помогает видеть, где именно система даёт сбой, а не просто замечать, что результат слабый.",
          howToLearn: "Возьмите 2-3 знакомых процесса и для каждого выпишите: шаги, узкие места, повторяющиеся ошибки и возможную причину сбоя.",
        },
        {
          skill: "Формулирование критериев качества",
          why: "Нужно, чтобы оценивать результат не по ощущению, а по понятным признакам и ожиданиям.",
          howToLearn: "Для трёх типовых задач пропишите, по каким признакам вы поймёте, что работа сделана хорошо, средне или плохо.",
        },
        {
          skill: "Ясное объяснение выводов",
          why: "Полезно, когда нужно не только заметить проблему, но и убедительно показать, в чём она и что стоит менять.",
          howToLearn: "Потренируйтесь коротко объяснять один найденный сбой по схеме: проблема, причина, риск, следующее действие.",
        },
      ]
    : [
        {
          skill: "Process diagnosis",
          why: "It helps you see where a system actually breaks instead of only noticing that the outcome is weak.",
          howToLearn: "Take 2-3 processes you know and list for each one: steps, bottlenecks, recurring errors, and the likely cause of failure.",
        },
        {
          skill: "Defining quality criteria",
          why: "It helps you evaluate outcomes through clear signals and expectations rather than vague impressions.",
          howToLearn: "For three typical tasks, define what would count as a strong, average, or weak result.",
        },
        {
          skill: "Explaining findings clearly",
          why: "It matters when you need not only to spot a problem, but also to show what is wrong and what should change.",
          howToLearn: "Practice explaining one issue using this structure: problem, cause, risk, next action.",
        },
      ];
}

function inferTrackFromRoles(roles: BestFitRole[]): MentraTrack {
  const text = roles
    .map((r) => `${r.role} ${r.explanation}`)
    .join(" ")
    .toLowerCase();

  if (/ювел|камн|гемм|gem|jewel|apprais/.test(text)) {
    return "jewelry";
  }

  if (/qa|тест|quality|test/.test(text)) {
    return "testing";
  }

  if (/content|brand|creative|креатив|контент|бренд|product manager|prodact|продакт/.test(text)) {
    return "creative";
  }

  if (/mentor|community|learning|координатор|настав|обуч|community manager|program coordinator/.test(text)) {
    return "people";
  }

  if (/operations|executor|execution|project coordinator|операцион|координатор проектов|исполн|выполн/.test(text)) {
    return "execution";
  }

  return "general";
}

function buildRoleAlignedFallback(
  language: Language,
  answers: string[],
  answersQuality: AnswersQualitySummary,
  roles: BestFitRole[]
): MentraResponse {
  const isRussian = language === "ru";
  const track = inferTrackFromRoles(roles);
  const signals = extractSignals(answers);

  const patchedSignals =
    track === "general"
      ? {
          ...signals,
          q10Jewelry: false,
          q10Testing: false,
          q10Creative: false,
          q10People: false,
          hasExecution: false,
          likesConcreteOutput: false,
          hasPeople: false,
          likesExplaining: false,
          hasCreate: false,
          hasAutonomy: false,
        }
      : {
          ...signals,
          q10Jewelry: track === "jewelry",
          q10Testing: track === "testing",
          q10Creative: track === "creative",
          q10People: track === "people",
          hasExecution: track === "execution",
          likesConcreteOutput: track === "execution",
        };

  const fallback = buildFallbackResponse(language, answersQuality, patchedSignals);
  fallback.bestFitRoles = roles;

  fallback.profileSummary = injectTension(
    fallback.profileSummary,
    answers,
    isRussian
  );

  fallback.whyThisResult = buildStrongWhyFallback(language, patchedSignals);
  fallback.workStyle = buildWorkStyleFallback(language, track, answers);
  fallback.potentialMismatches = buildMismatchesFallback(language, track);
  fallback.actionPlan.validation = buildValidationFallback(language, track);
  fallback.actionPlan.skillsToDevelop = buildStrongSkillsFallback(language, track);

  return fallback;
}

function generateSmartFallback(
  language: Language,
  answers: string[],
  answersQuality: AnswersQualitySummary
): MentraResponse {
  const signals = extractSignals(answers);

  const result = buildFallbackResponse(
    language,
    answersQuality,
    signals
  );

  result.profileSummary = injectTension(
    result.profileSummary,
    answers,
    language === "ru"
  );

  result.bestFitRoles = enforceQ10Priority(
    result.bestFitRoles,
    answers[9] || ""
  );

  result.whyThisResult = buildStrongWhyFallback(language, signals);

  const track = inferTrackFromRoles(result.bestFitRoles);

  result.workStyle = buildWorkStyleFallback(language, track, answers);
  result.potentialMismatches = buildMismatchesFallback(language, track);
  result.actionPlan.validation = buildValidationFallback(language, track);
  result.actionPlan.skillsToDevelop = buildStrongSkillsFallback(language, track);

  return result;
}

async function callGroq(
  prompt: string,
  isRussian: boolean,
  answersQuality: AnswersQualitySummary,
  overridePrompt?: string
): Promise<ProviderResult | null> {
  if (!process.env.GROQ_API_KEY) {
    console.log("❌ Groq API key not configured");
    return null;
  }

  try {
    console.log("🤖 Calling Groq (primary)...");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const isLowQuality =
      answersQuality.avgLength < 50 ||
      answersQuality.emptyCount > 3 ||
      answersQuality.shortCount >= 5;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(isRussian, isLowQuality),
        },
        { role: "user", content: overridePrompt ?? prompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const result = JSON.parse(jsonStr) as Record<string, unknown>;

    console.log("✅ Groq succeeded");
    return { result: result as MentraRawResult, isLowQuality };
  } catch (error: unknown) {
    console.error("❌ Groq failed:", error);
    return null;
  }
}

async function callDeepSeek(
  prompt: string,
  isRussian: boolean,
  answersQuality: AnswersQualitySummary,
  overridePrompt?: string
): Promise<ProviderResult | null> {
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
      answersQuality.avgLength < 50 ||
      answersQuality.emptyCount > 3 ||
      answersQuality.shortCount >= 5;

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(isRussian, isLowQuality),
        },
        { role: "user", content: overridePrompt ?? prompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from DeepSeek");

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const result = JSON.parse(jsonStr) as Record<string, unknown>;

    console.log("✅ DeepSeek succeeded");
    return { result: result as MentraRawResult, isLowQuality };
  } catch (error: unknown) {
    console.error("❌ DeepSeek failed:", error);
    return null;
  }
}

async function callGroqReview(
  prompt: string,
  isRussian: boolean
): Promise<ReviewResult | null> {
  if (!process.env.GROQ_API_KEY) return null;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: isRussian ? REVIEW_SYSTEM_PROMPT_RU : REVIEW_SYSTEM_PROMPT_EN,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as {
      verdict?: unknown;
      issues?: unknown;
    };

    const verdict =
      parsed.verdict === "accept" ||
      parsed.verdict === "revise" ||
      parsed.verdict === "fallback"
        ? parsed.verdict
        : "revise";

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((x) => cleanText(x, { maxLength: 220 })).filter(Boolean)
      : [];

    return { verdict, issues };
  } catch (error) {
    console.error("❌ Groq review failed:", error);
    return null;
  }
}

async function callDeepSeekReview(
  prompt: string,
  isRussian: boolean
): Promise<ReviewResult | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  try {
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: isRussian ? REVIEW_SYSTEM_PROMPT_RU : REVIEW_SYSTEM_PROMPT_EN,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as {
      verdict?: unknown;
      issues?: unknown;
    };

    const verdict =
      parsed.verdict === "accept" ||
      parsed.verdict === "revise" ||
      parsed.verdict === "fallback"
        ? parsed.verdict
        : "revise";

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((x) => cleanText(x, { maxLength: 220 })).filter(Boolean)
      : [];

    return { verdict, issues };
  } catch (error) {
    console.error("❌ DeepSeek review failed:", error);
    return null;
  }
}

async function regenerateWithProvider(
  provider: "groq" | "deepseek",
  prompt: string,
  isRussian: boolean,
  answersQuality: AnswersQualitySummary,
  qualityReasons: string[]
): Promise<ProviderResult | null> {
  const regenerationPrompt = buildRegenerationPrompt(
    prompt,
    qualityReasons,
    isRussian
  );

  if (provider === "groq") {
    return callGroq(prompt, isRussian, answersQuality, regenerationPrompt);
  }

  if (provider === "deepseek") {
    return callDeepSeek(prompt, isRussian, answersQuality, regenerationPrompt);
  }

  return null;
}

async function reviewWithProvider(
  provider: "groq" | "deepseek",
  answers: string[],
  language: Language,
  candidate: MentraResponse,
  isRussian: boolean
): Promise<ReviewResult | null> {
  const reviewPrompt = buildReviewPrompt(answers, language, candidate);

  if (provider === "groq") {
    return callGroqReview(reviewPrompt, isRussian);
  }

  if (provider === "deepseek") {
    return callDeepSeekReview(reviewPrompt, isRussian);
  }

  return null;
}

function shouldRunSelfReview(
  qualityCheck: QualityScoreDetails,
  result: MentraResponse
): boolean {
  if (qualityCheck.score < 85) return true;

  if (result.whyThisResult.length < 3) return true;
  if (result.keyStrengths.length < 3) return true;
  if (result.bestFitRoles.length < 2) return true;

  return false;
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

function mergeUniqueStrings(
  primary: string[],
  secondary: string[],
  maxItems: number
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...secondary]) {
    const key = normalizeText(item).toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item);

    if (result.length >= maxItems) break;
  }

  return result;
}

function mergeSkills(
  primary: SkillToDevelop[],
  secondary: SkillToDevelop[],
  maxItems: number
): SkillToDevelop[] {
  const result: SkillToDevelop[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...secondary]) {
    const key = normalizeText(item.skill).toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item);

    if (result.length >= maxItems) break;
  }

  return result;
}

function preferModelText(
  modelText: string,
  fallbackText: string,
  isWeak: (text: string) => boolean
): string {
  if (!normalizeText(modelText)) return fallbackText;
  if (isWeak(modelText)) return fallbackText;

  return modelText;
}

function normalizeRoleTitle(role: string, isRussian: boolean): string {
  return normalizeRoleTitleStrict(role, isRussian);
}

function isTooBroadRole(role: string): boolean {
  const lower = normalizeText(role).toLowerCase();

  return [
    "операционный директор",
    "директор",
    "creative director",
    "креативный директор",
    "innovation consultant",
    "consultant",
    "консультант",
    "лабораторный исследователь",
    "researcher",
    "исследователь",
    "leader",
    "лидер",
  ].some((pattern) => lower === pattern || lower.includes(pattern));
}

function normalizeRoleTitleStrict(role: string, isRussian: boolean): string {
  const cleaned = cleanText(role, { maxLength: 100 });
  const lower = cleaned.toLowerCase().trim();

  if (ROLE_REPLACEMENTS[lower]) {
    return isRussian ? ROLE_REPLACEMENTS[lower].ru : ROLE_REPLACEMENTS[lower].en;
  }

  if (isTooBroadRole(lower)) {
    if (/creative|креатив|brand|бренд|content|контент/.test(lower)) {
      return isRussian ? "Креативный продюсер" : "Creative Producer";
    }

    if (/product|prodact|продакт/.test(lower)) {
      return isRussian ? "Младший продакт-менеджер" : "Junior Product Manager";
    }

    if (/research|исследов/.test(lower)) {
      return isRussian ? "Специалист по качеству" : "Quality Specialist";
    }

    if (/consult|консульт/.test(lower)) {
      return isRussian
        ? "Специалист по улучшению процессов"
        : "Process Improvement Specialist";
    }

    if (/операц|director|leader|manager|менеджер/.test(lower)) {
      return isRussian ? "Координатор процессов" : "Operations Coordinator";
    }
  }

  return cleaned;
}

function dedupeRoles(roles: BestFitRole[]): BestFitRole[] {
  const seen = new Set<string>();
  const result: BestFitRole[] = [];

  for (const role of roles) {
    const key = normalizeText(role.role).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(role);
  }

  return result;
}

function polishFinalResult(
  result: MentraResponse,
  smartFallback: MentraResponse,
  language: Language,
  answers: string[]
): MentraResponse {
  const track = inferTrackFromRoles(result.bestFitRoles);

  result.whyThisResult = mergeUniqueStrings(
    result.whyThisResult.filter((item) => !isWeakWhy(item)),
    smartFallback.whyThisResult,
    3
  );

  result.keyStrengths = mergeUniqueStrings(
    result.keyStrengths.filter((item) => !isWeakStrength(item)),
    smartFallback.keyStrengths,
    3
  );

  result.actionPlan.validation = mergeUniqueStrings(
    result.actionPlan.validation.filter((item) => !isWeakValidation(item)),
    buildValidationFallback(language, track),
    2
  );

  result.actionPlan.skillsToDevelop =
    result.actionPlan.skillsToDevelop.filter(
      (item) => !isWeakSkillItem(item)
    ).length >= 2
      ? result.actionPlan.skillsToDevelop.filter(
          (item) => !isWeakSkillItem(item)
        ).slice(0, 3)
      : buildStrongSkillsFallback(language, track);

  result.workStyle = preferModelText(
    result.workStyle,
    buildWorkStyleFallback(language, track, answers),
    isWeakWorkStyle
  );

  result.potentialMismatches = mergeUniqueStrings(
    result.potentialMismatches.filter((item) => !isWeakMismatch(item)),
    buildMismatchesFallback(language, track),
    2
  );

  result.recommendedNextStep = preferModelText(
    result.recommendedNextStep,
    smartFallback.recommendedNextStep,
    isWeakRecommendedNextStep
  );

  result.actionPlan.nextMove = preferModelText(
    result.actionPlan.nextMove,
    smartFallback.actionPlan.nextMove,
    isWeakNextMove
  );

  return result;
}

function containsForbiddenPatterns(raw: MentraRawResult): boolean {
  const text = JSON.stringify(raw).toLowerCase();

  const forbidden = [
    "пройти курс",
    "take a course",
    "talk to professionals",
    "поговорить с профессионалами",
    "подать заявку",
    "apply for jobs",
    "flexible leader",
    "флексибельный лидер",
    "analytical kontrol",
    "несpecific",
    "career consultant"
  ];

  return forbidden.some(p => text.includes(p));
}

function normalizeModelResult(
  rawResult: MentraRawResult,
  smartFallback: MentraResponse,
  answers: string[],
  isRussian: boolean,
  answersQuality: AnswersQualitySummary,
  language: Language
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
    }).filter((item) => !isWeakStrength(item)),
    workStyle: cleanText(rawResult.workStyle, {
      maxLength: 400,
      fallback: smartFallback.workStyle,
    }),
    bestFitRoles: Array.isArray(rawResult.bestFitRoles)
      ? rawResult.bestFitRoles
          .map((item: unknown) => {
            const roleItem = item as { role?: unknown; explanation?: unknown };
            return {
              role: normalizeRoleTitle(
                cleanText(roleItem?.role, { maxLength: 100 }),
                isRussian
              ),
              explanation: cleanText(roleItem?.explanation, { maxLength: 300 }),
            };
          })
          .filter((item) => item.role && item.explanation)
          .filter((item) => !isWeakRoleExplanation(item.explanation))
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
        ? rawResult.actionPlan.skillsToDevelop
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

    const cleanedWhy = filterRegurgitation(
      normalized.whyThisResult,
      answers
    ).filter((item) => !isWeakWhy(item));

    normalized.whyThisResult = mergeUniqueStrings(
      cleanedWhy,
      smartFallback.whyThisResult,
      3
    );

    normalized.keyStrengths = mergeUniqueStrings(
      normalized.keyStrengths,
      smartFallback.keyStrengths,
      3
    );

  if (!normalized.bestFitRoles.length) {
    normalized.bestFitRoles = smartFallback.bestFitRoles;
  } else if (normalized.bestFitRoles.length < 2) {
    normalized.bestFitRoles = mergeRoles(
      normalized.bestFitRoles,
      smartFallback.bestFitRoles
    );
  }

  normalized.bestFitRoles = enforceQ10Priority(
    normalized.bestFitRoles,
    answers[9] || ""
  );

  normalized.bestFitRoles = dedupeRoles(normalized.bestFitRoles).slice(0, 3);

    const roleAlignedFallback = buildRoleAlignedFallback(
      language,
      answers,
      answersQuality,
      normalized.bestFitRoles
    );

// 🔥 ЖЁСТКАЯ ЗАМЕНА слабых блоков

if (
  normalized.actionPlan.immediate.length < 2 ||
  normalized.actionPlan.immediate.some(isWeakAction) ||
  normalized.actionPlan.immediate.some(isVagueAction)
) {
  normalized.actionPlan.immediate = roleAlignedFallback.actionPlan.immediate;
}

if (isWeakRecommendedNextStep(normalized.recommendedNextStep)) {
  normalized.recommendedNextStep = roleAlignedFallback.recommendedNextStep;
}

if (isWeakNextMove(normalized.actionPlan.nextMove)) {
  normalized.actionPlan.nextMove = roleAlignedFallback.actionPlan.nextMove;
}

        const inferredTrack = inferTrackFromRoles(normalized.bestFitRoles);
        const strongSkillsFallback = buildStrongSkillsFallback(language, inferredTrack);
        const strongValidationFallback = buildValidationFallback(language, inferredTrack);
        const strongWorkStyleFallback = buildWorkStyleFallback(language, inferredTrack, answers);
        const strongMismatchesFallback = buildMismatchesFallback(language, inferredTrack);

        normalized.profileSummary = preferModelText(
          normalized.profileSummary,
          smartFallback.profileSummary,
          isWeakProfileSummary
        );

        normalized.workStyle = preferModelText(
          normalized.workStyle,
          strongWorkStyleFallback,
          isWeakWorkStyle
        );

        if (
          normalized.potentialMismatches.length < 2 ||
          normalized.potentialMismatches.some(isWeakMismatch)
        ) {
          normalized.potentialMismatches = mergeUniqueStrings(
            normalized.potentialMismatches,
            strongMismatchesFallback,
            2
          );
        }

        const cleanedValidation = normalized.actionPlan.validation.filter(
          (item) => !isWeakValidation(item)
        );

        normalized.actionPlan.validation = mergeUniqueStrings(
          cleanedValidation,
          strongValidationFallback,
          2
        );

        if (!normalized.actionPlan.immediate.length) {
          normalized.actionPlan.immediate = roleAlignedFallback.actionPlan.immediate;
        }

        if (!normalized.actionPlan.exploration.length) {
          normalized.actionPlan.exploration = roleAlignedFallback.actionPlan.exploration;
        }

        const cleanedSkills = normalized.actionPlan.skillsToDevelop.filter(
          (item) => !isWeakSkillItem(item)
        );

        normalized.actionPlan.skillsToDevelop =
          cleanedSkills.length >= 2
            ? cleanedSkills.slice(0, 3)
            : strongSkillsFallback;

        normalized.actionPlan.nextMove = preferModelText(
          normalized.actionPlan.nextMove,
          roleAlignedFallback.actionPlan.nextMove,
          isWeakNextMove
        );

        normalized.recommendedNextStep = preferModelText(
          normalized.recommendedNextStep,
          roleAlignedFallback.recommendedNextStep,
          isWeakRecommendedNextStep
        );

  if (!normalized.profileType) {
    normalized.profileType = isRussian
      ? "Универсал-практик"
      : "Practical Generalist";
  }

  const polished = polishFinalResult(
    normalized,
    smartFallback,
    language,
    answers
  );

  polished.profileSummary = injectTension(
    polished.profileSummary,
    answers,
    isRussian
  );

  return polished;
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
    const questions =
      questionsByLanguage[language] ?? questionsByLanguage.en;

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
      answersQuality.avgLength < 50 ||
      answersQuality.emptyCount > 3 ||
      answersQuality.shortCount >= 5;

    const smartFallback = generateSmartFallback(
      language,
      answers,
      answersQuality
    );

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
      if (containsForbiddenPatterns(groqResponse.result)) {
        rawResult = null;
        provider = "fallback";
      } else {
        rawResult = groqResponse.result;
        provider = "groq";
      }
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

        const normalized = normalizeModelResult(
          rawResult,
          smartFallback,
          answers,
          isRussian,
          answersQuality,
          language
        );

        if (process.env.NODE_ENV !== "production") {
          console.log("🧩 Final roles:", normalized.bestFitRoles);
          console.log("🧩 Final next step:", normalized.recommendedNextStep);
          console.log("🧩 Final immediate:", normalized.actionPlan.immediate);
          console.log("🧩 Final exploration:", normalized.actionPlan.exploration);
          console.log("🧩 Final validation:", normalized.actionPlan.validation);
        }

        let finalResult = normalized;
        let qualityCheck = scoreAnalysisResult(finalResult, answers, isRussian);

        if (provider !== "fallback" && shouldRunSelfReview(qualityCheck, finalResult)) {
          const review = await reviewWithProvider(
            provider,
            answers,
            language,
            finalResult,
            isRussian
          );

          if (process.env.NODE_ENV !== "production") {
            console.log("🧠 Self-review:", review);
          }

          if (review?.verdict === "fallback") {
            finalResult = smartFallback;
            qualityCheck = scoreAnalysisResult(finalResult, answers, isRussian);
            provider = "fallback";
          } else if (review?.verdict === "revise") {
            const revisionReasons =
              review.issues.length > 0
                ? [...qualityCheck.reasons, ...review.issues]
                : qualityCheck.reasons;

            const regeneratedResponse = await regenerateWithProvider(
              provider,
              prompt,
              isRussian,
              answersQuality,
              revisionReasons
            );

            if (regeneratedResponse) {
              const regeneratedNormalized = normalizeModelResult(
                regeneratedResponse.result,
                smartFallback,
                answers,
                isRussian,
                answersQuality,
                language
              );

              const regeneratedQuality = scoreAnalysisResult(
                regeneratedNormalized,
                answers,
                isRussian
              );

              if (regeneratedQuality.score >= qualityCheck.score) {
                finalResult = regeneratedNormalized;
                qualityCheck = regeneratedQuality;
              }
            }
          }
        }

        if (qualityCheck.score < 70) {
          console.log(
            `⚠️ Still low quality after review/regenerate (${qualityCheck.score}). Falling back.`
          );

          finalResult = smartFallback;
          qualityCheck = scoreAnalysisResult(finalResult, answers, isRussian);
          provider = "fallback";
        }

        const finalConfidence =
          isLowQuality
            ? qualityCheck.score >= 85
              ? "medium"
              : "low"
            : qualityCheck.score >= 85
              ? "high"
              : qualityCheck.score >= 70
                ? "medium"
                : "low";

        console.log(
          `✅ Analysis complete, provider: ${provider}, profile: ${finalResult.profileType}, score: ${qualityCheck.score}`
        );

        const rolesList = finalResult.bestFitRoles.map((r) => r.role).join(", ");

        await sendToTelegram(
          `✅ <b>Новый анализ!</b>\n` +
            `🤖 Провайдер: ${provider}\n` +
            `🌐 Язык: ${language}\n` +
            `👤 Профиль: ${escapeHtml(finalResult.profileType)}\n` +
            `💼 Роли: ${escapeHtml(rolesList)}\n` +
            `📊 Score: ${qualityCheck.score}\n` +
            `📌 Confidence: ${finalConfidence}`
        );

        return NextResponse.json({
          ...finalResult,
          provider,
          confidence: finalConfidence,
          _note: finalResult._note,
          qualityScore: qualityCheck.score,
          qualityReasons:
            process.env.NODE_ENV !== "production"
              ? qualityCheck.reasons
              : undefined,
        });
  } catch (error) {
    console.error("💥 Fatal error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}