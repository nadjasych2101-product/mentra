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
  "пройти курс",
  "обсудить возможности",
  "запланировать встречу",
  "связаться с",
  "подать заявку",
  "learn the basics",
  "explore opportunities",
  "research opportunities",
  "learn more",
  "read about",
  "take a course",
  "discuss opportunities",
  "schedule informational interviews",
  "schedule a meeting",
  "contact professionals",
  "apply for",
  "research and network",
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

function isWeakValidation(text: string): boolean {
  return matchesAnyPattern(text, WEAK_VALIDATION_PATTERNS);
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
    /противореч|tension|contradiction/i.test(profileSummary.toLowerCase());

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

  if (isWeakAction(result.recommendedNextStep)) {
    score -= 10;
    reasons.push(
      isRussian
        ? "Слабый recommendedNextStep"
        : "Weak recommendedNextStep"
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
    answersQuality.avgLength < 50 ||
    answersQuality.emptyCount > 3 ||
    answersQuality.shortCount >= 5;

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

  const roleExample = bestFitRoles[0]?.role || (isRussian ? "специалист" : "specialist");

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
          "Быстро выделяете главное в задаче и не тратите много времени на второстепенное.",
          "Можете работать самостоятельно, но не разваливаете процесс — удерживаете внутреннюю рамку.",
          signals.hasPeople
            ? "Умеете переводить сложное в понятные объяснения без давления и лишней сложности."
            : "Замечаете слабые места в результате и естественно тянетесь к улучшению качества.",
        ]
        : [
            "You quickly isolate the core of a task instead of getting lost in secondary details.",
            "You can work independently without losing structure or internal discipline.",
            signals.hasPeople
              ? "You can translate complex things into clear explanations without sounding heavy or rigid."
              : "You naturally notice weak points in a result and want to improve the quality of it.",
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

function buildStrongSkillsFallback(
  language: Language,
  track: "jewelry" | "testing" | "creative" | "people" | "general"
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

  return isRussian
    ? [
        {
          skill: "Анализ задач",
          why: "Помогает быстрее видеть, что в задаче главное, а что вторично.",
          howToLearn: "Разберите 3 знакомые задачи по схеме: цель, ограничение, критерий качества.",
        },
        {
          skill: "Ясная коммуникация",
          why: "Нужна, чтобы доносить идеи, выводы и замечания без путаницы.",
          howToLearn: "Тренируйтесь кратко объяснять одно решение за 1-2 минуты и получать обратную связь.",
        },
      ]
    : [
        {
          skill: "Task analysis",
          why: "It helps you see faster what matters most in a task and what is secondary.",
          howToLearn: "Break down 3 familiar tasks into: goal, constraint, and quality criterion.",
        },
        {
          skill: "Clear communication",
          why: "It helps you explain ideas, conclusions, and concerns without confusion.",
          howToLearn: "Practice explaining one decision in 1-2 minutes and ask for feedback on clarity.",
        },
      ];
}

function inferTrackFromRoles(
  roles: BestFitRole[]
): "jewelry" | "testing" | "creative" | "people" | "general" {
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

  const patchedSignals = {
    ...signals,
    q10Jewelry: track === "jewelry",
    q10Testing: track === "testing",
    q10Creative: track === "creative",
    q10People: track === "people",
  };

  const fallback = buildFallbackResponse(language, answersQuality, patchedSignals);
  fallback.bestFitRoles = roles;

  fallback.profileSummary = injectTension(
    fallback.profileSummary,
    answers,
    isRussian
  );

  fallback.whyThisResult = buildStrongWhyFallback(language, patchedSignals);

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
      temperature: 0.9,
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
      temperature: 0.9,
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
  isRussian: boolean,
  answersQuality: AnswersQualitySummary
): Promise<ReviewResult | null> {
  const reviewPrompt = buildReviewPrompt(answers, language, candidate);

  if (provider === "groq") {
    const reviewed = await callGroq(
      reviewPrompt,
      isRussian,
      answersQuality
    );

    if (!reviewed) return null;

    try {
      const normalizedJson = JSON.stringify(reviewed.result);
      const parsed = JSON.parse(normalizedJson) as {
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
    } catch {
      return null;
    }
  }

  if (provider === "deepseek") {
    const reviewed = await callDeepSeek(
      reviewPrompt,
      isRussian,
      answersQuality
    );

    if (!reviewed) return null;

    try {
      const normalizedJson = JSON.stringify(reviewed.result);
      const parsed = JSON.parse(normalizedJson) as {
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
    } catch {
      return null;
    }
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
    "manager",
    "менеджер",
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
      ? dedupeRoles(
          rawResult.bestFitRoles
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
        ).slice(0, 3)
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

    normalized.whyThisResult = filterRegurgitation(
      normalized.whyThisResult,
      answers
    ).filter((item) => !isWeakWhy(item));

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

  normalized.bestFitRoles = enforceQ10Priority(
    normalized.bestFitRoles,
    answers[9] || ""
  );

    const roleAlignedFallback = buildRoleAlignedFallback(
      language,
      answers,
      answersQuality,
      normalized.bestFitRoles
    );

        const inferredTrack = inferTrackFromRoles(normalized.bestFitRoles);
        const strongSkillsFallback = buildStrongSkillsFallback(language, inferredTrack);

      normalized.actionPlan.validation = normalized.actionPlan.validation.filter(
        (item) => !isWeakValidation(item)
      );

     if (normalized.actionPlan.validation.length < 2) {
       normalized.actionPlan.validation = roleAlignedFallback.actionPlan.validation;
     }

  if (!normalized.potentialMismatches.length) {
    normalized.potentialMismatches = roleAlignedFallback.potentialMismatches;
  }

    if (!normalized.actionPlan.immediate.length) {
      normalized.actionPlan.immediate = roleAlignedFallback.actionPlan.immediate;
    }

    if (!normalized.actionPlan.exploration.length) {
      normalized.actionPlan.exploration = roleAlignedFallback.actionPlan.exploration;
    }

    if (!normalized.actionPlan.validation.length) {
      normalized.actionPlan.validation = roleAlignedFallback.actionPlan.validation;
    }

    if (!normalized.actionPlan.skillsToDevelop.length) {
      normalized.actionPlan.skillsToDevelop = strongSkillsFallback;
    }

    const weakSkillsCount = normalized.actionPlan.skillsToDevelop.filter(
      (item) => isWeakStrength(item.skill)
    ).length;

    if (weakSkillsCount > 0) {
      normalized.actionPlan.skillsToDevelop = strongSkillsFallback;
    }

    if (!normalized.actionPlan.nextMove) {
      normalized.actionPlan.nextMove = roleAlignedFallback.actionPlan.nextMove;
    }

    if (!normalized.actionPlan.nextMove) {
      normalized.actionPlan.nextMove = roleAlignedFallback.actionPlan.nextMove;
    }

    if (isWeakNextMove(normalized.actionPlan.nextMove)) {
      normalized.actionPlan.nextMove = roleAlignedFallback.actionPlan.nextMove;
    }

      if (!normalized.recommendedNextStep) {
        normalized.recommendedNextStep = roleAlignedFallback.recommendedNextStep;
      }

      if (isWeakRecommendedNextStep(normalized.recommendedNextStep)) {
        normalized.recommendedNextStep = roleAlignedFallback.recommendedNextStep;
      }

  if (!normalized.profileType) {
    normalized.profileType = isRussian
      ? "Универсал-практик"
      : "Practical Generalist";
  }

  normalized.profileSummary = injectTension(
    normalized.profileSummary,
    answers,
    isRussian
  );

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
            isRussian,
            answersQuality
          );

          if (process.env.NODE_ENV !== "production") {
            console.log("🧠 Self-review:", review);
          }

          if (review?.verdict === "fallback") {
            finalResult = smartFallback;
            qualityCheck = scoreAnalysisResult(finalResult, answers, isRussian);
            provider = "fallback";
          } else if (
            review?.verdict === "revise" &&
            provider !== "fallback"
          ) {
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

        if (qualityCheck.score < 70) {
          console.log(
            `⚠️ Still low quality after regenerate (${qualityCheck.score}). Falling back.`
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