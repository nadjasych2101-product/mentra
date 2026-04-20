"use client";

import { useState, useEffect, useCallback } from "react";
import { questionsByLanguage } from "@/data/questions";
import type { AnalysisResult } from "@/lib/types";

type Language = "en" | "ru";
type ViewState = "landing" | "quiz" | "loading" | "result";

const ui = {
  en: {
    brand: "Mentra",
    heroTitle: "Find work that actually fits how you think and operate",
    heroText:
      "Mentra asks you a short set of questions, then turns your answers into a practical career reflection: your strengths, work style, likely mismatches, and role directions worth exploring.",
    startAssessment: "Start assessment",
    seeHowItWorks: "See how it works",
    bullets: [
      "10 short questions",
      "Takes around 3–5 minutes",
      "No sign-up needed",
    ],
    whatYouGet: "What you get",
    profileSummary: "Profile Summary",
    bestFitRoles: "Best-Fit Roles",
    whatYouGetSummary:
      "A concise reflection on how you approach work and what seems to drive you.",
    whatYouGetRoles:
      "A first-pass view of the kinds of roles and environments that may suit you best.",
    whatYouGetNextStep:
      "One practical next move you can take instead of vague career advice.",
    howItWorks: "How it works",
    howItWorksTitle: "A simple first step toward clearer career direction",
    step1: "Step 1",
    step2: "Step 2",
    step3: "Step 3",
    step1Title: "Answer 10 questions",
    step2Title: "Mentra analyzes patterns",
    step3Title: "Get a practical result",
    step1Text:
      "You respond to a short set of prompts about what energizes you, drains you, and the kinds of environments where you tend to do your best work.",
    step2Text:
      "Based on your answers, Mentra looks for signals around autonomy, structure, collaboration, motivation, and possible role fit.",
    step3Text:
      "You receive a clear summary, possible strengths, likely role directions, and one next step you can actually act on.",
    footerText: "Early prototype for clearer career direction.",
    footerBullets: ["10 questions", "No sign-up", "Built for fast feedback"],
    mentraAnalysis: "Mentra Analysis",
    yourMentraResult: "Your Mentra Result",
    resultIntro:
      "A first-pass reflection on how you work, what energizes you, and what kinds of roles may fit you best.",
    whyThisResult: "Why this result",
    keyStrengths: "Key Strengths",
    workStyle: "Work Style",
    potentialMismatches: "Potential Mismatches",
    recommendedNextStep: "Recommended Next Step",
    tryAgain: "Try again",
    backToStart: "Back to start",
    backToTop: "Back to top",
    loadingTitle: "Analyzing your responses",
    loadingText:
      "Looking for patterns in what energizes you, what drains you, and which kinds of roles and environments may fit you best.",
    loading1: "Reviewing work preferences",
    loading2: "Identifying likely strengths",
    loading3: "Estimating role fit and mismatches",
    question: "Question",
    of: "of",
    answerPrompt:
      "Answer in your own words. A short honest answer is better than a polished one.",
    textareaPlaceholder: "Type your answer here...",
    tip: "Tip: concrete examples usually lead to better results.",
    back: "Back",
    next: "Next",
    finishAnalysis: "Finish Analysis",
    quickFeedback: "Quick feedback",
    didThisFeelAccurate: "Did this feel accurate?",
    yes: "Yes",
    notReally: "Not really",
    deeperVersionQuestion: "Would you want a deeper version later?",
    maybe: "Maybe",
    no: "No",
    accurateOrInaccurate: "What felt accurate or inaccurate?",
    feedbackPlaceholder: "Optional — tell us what felt right or off.",
    submitFeedback: "Submit feedback",
    thanksFeedback: "Thanks for your feedback.",
    thanksFeedbackText:
      "This helps improve Mentra and shape the deeper version.",
    languageChangeWarning:
      "Changing language will reset your progress. Continue?",
    exitQuizWarning: "Are you sure you want to exit? Your progress will be lost.",
    aiUnavailableNote: "AI service is temporarily unavailable. Showing basic analysis.",
  },
  ru: {
    brand: "Mentra",
    heroTitle:
      "Найди работу, которая действительно подходит тебе по мышлению и стилю работы",
    heroText:
      "Mentra задаёт короткий набор вопросов и превращает ответы в практический карьерный разбор: твои сильные стороны, стиль работы, возможные несовпадения и направления ролей, которые могут тебе подойти.",
    startAssessment: "Начать",
    seeHowItWorks: "Как это работает",
    bullets: [
      "10 коротких вопросов",
      "Занимает около 3–5 минут",
      "Без регистрации",
    ],
    whatYouGet: "Что ты получишь",
    profileSummary: "Краткий профиль",
    bestFitRoles: "Подходящие роли",
    recommendedNextStep: "Следующий шаг",
    whatYouGetSummary:
      "Короткое и понятное описание того, как ты подходишь к работе и что, скорее всего, тебя драйвит.",
    whatYouGetRoles:
      "Первый взгляд на типы ролей и рабочих сред, которые могут тебе подойти.",
    whatYouGetNextStep:
      "Один практический следующий шаг вместо размытого карьерного совета.",
    howItWorks: "Как это работает",
    howItWorksTitle: "Простой первый шаг к более ясному карьерному направлению",
    step1: "Шаг 1",
    step2: "Шаг 2",
    step3: "Шаг 3",
    step1Title: "Ответь на 10 вопросов",
    step2Title: "Mentra ищет паттерны",
    step3Title: "Получи практический результат",
    step1Text:
      "Ты отвечаешь на короткий набор вопросов о том, что тебя заряжает, что выматывает и в какой среде ты обычно показываешь лучший результат.",
    step2Text:
      "На основе ответов Mentra ищет сигналы, связанные с автономией, структурой, взаимодействием, мотивацией и возможным карьерным fit.",
    step3Text:
      "Ты получаешь понятное summary, возможные сильные стороны, направления ролей и один следующий шаг, который можно реально сделать.",
    footerText: "Ранний прототип для более ясного карьерного направления.",
    footerBullets: [
      "10 вопросов",
      "Без регистрации",
      "Сделано для быстрого фидбека",
    ],
    mentraAnalysis: "Анализ Mentra",
    yourMentraResult: "Твой результат Mentra",
    resultIntro:
      "Первый разбор того, как ты работаешь, что тебя заряжает и какие типы ролей могут подойти тебе лучше всего.",
    whyThisResult: "Почему такой результат",
    keyStrengths: "Сильные стороны",
    workStyle: "Стиль работы",
    potentialMismatches: "Что может не подойти",
    tryAgain: "Пройти ещё раз",
    backToStart: "На старт",
    backToTop: "Наверх",
    loadingTitle: "Анализируем твои ответы",
    loadingText:
      "Смотрим на паттерны в том, что тебя заряжает, что выматывает и какие роли и среды могут подойти тебе лучше всего.",
    loading1: "Смотрим на рабочие предпочтения",
    loading2: "Определяем вероятные сильные стороны",
    loading3: "Оцениваем подходящие роли и возможные несовпадения",
    question: "Вопрос",
    of: "из",
    answerPrompt:
      "Отвечай своими словами. Короткий честный ответ лучше, чем слишком вылизанная формулировка.",
    textareaPlaceholder: "Напиши свой ответ здесь...",
    tip: "Подсказка: конкретные примеры обычно дают более точный результат.",
    back: "Назад",
    next: "Далее",
    finishAnalysis: "Завершить анализ",
    quickFeedback: "Быстрый фидбек",
    didThisFeelAccurate: "Это показалось тебе точным?",
    yes: "Да",
    notReally: "Не очень",
    deeperVersionQuestion: "Ты бы хотела более глубокую версию позже?",
    maybe: "Возможно",
    no: "Нет",
    accurateOrInaccurate: "Что показалось точным, а что — нет?",
    feedbackPlaceholder:
      "Необязательно — расскажи, что показалось точным или мимо.",
    submitFeedback: "Отправить фидбек",
    thanksFeedback: "Спасибо за фидбек.",
    thanksFeedbackText:
      "Это помогает улучшать Mentra и формировать более глубокую версию.",
    languageChangeWarning:
      "Смена языка сбросит ваш прогресс. Продолжить?",
    exitQuizWarning: "Вы уверены, что хотите выйти? Прогресс будет потерян.",
    aiUnavailableNote: "AI-сервис временно недоступен. Показан базовый анализ.",
  },
} as const;

// ========== Sub-components ==========

function LanguageSwitcher({
  language,
  onChange,
}: {
  language: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div className="inline-flex border rounded-full p-1 bg-white">
      <button
        onClick={() => onChange("en")}
        className={`px-4 py-2 rounded-full text-sm transition-colors ${
          language === "en" ? "bg-black text-white" : "text-black hover:bg-gray-100"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => onChange("ru")}
        className={`px-4 py-2 rounded-full text-sm transition-colors ${
          language === "ru" ? "bg-black text-white" : "text-black hover:bg-gray-100"
        }`}
      >
        RU
      </button>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
      <div
        className="h-full bg-black rounded-full transition-all duration-300"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  );
}

function LandingView({
  language,
  t,
  onStart,
  onSwitchLanguage,
}: {
  language: Language;
  t: any;
  onStart: () => void;
  onSwitchLanguage: (lang: Language) => void;
}) {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="px-6 py-6">
        <div className="max-w-6xl mx-auto flex justify-end">
          <LanguageSwitcher language={language} onChange={onSwitchLanguage} />
        </div>
      </section>

      <section className="px-6 py-10 flex items-center min-h-[80vh]">
        <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
              {t.brand}
            </p>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              {t.heroTitle}
            </h1>

            <p className="text-lg text-gray-700 leading-8 mb-6 max-w-xl">
              {t.heroText}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <button
                onClick={onStart}
                className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                {t.startAssessment}
              </button>

              <button
                onClick={() =>
                  document.getElementById("how-it-works")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
                className="border border-black text-black px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t.seeHowItWorks}
              </button>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              {t.bullets.map((item: string, index: number) => (
                <p key={index}>• {item}</p>
              ))}
            </div>
          </div>

          <div className="bg-neutral-50 border rounded-3xl p-8 md:p-10 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
              {t.whatYouGet}
            </p>

            <div className="space-y-5">
              {[
                { title: t.profileSummary, text: t.whatYouGetSummary },
                { title: t.bestFitRoles, text: t.whatYouGetRoles },
                { title: t.recommendedNextStep, text: t.whatYouGetNextStep },
              ].map((item: { title: string; text: string }, i: number) => (
                <div key={i} className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-700 leading-7">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="px-6 py-20 bg-neutral-50 border-t border-b"
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
            {t.howItWorks}
          </p>

          <h2 className="text-4xl md:text-5xl font-bold mb-12 max-w-3xl">
            {t.howItWorksTitle}
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: t.step1, title: t.step1Title, text: t.step1Text },
              { step: t.step2, title: t.step2Title, text: t.step2Text },
              { step: t.step3, title: t.step3Title, text: t.step3Text },
            ].map((item: { step: string; title: string; text: string }, i: number) => (
              <div
                key={i}
                className="bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-sm text-gray-500 mb-3">{item.step}</p>
                <h3 className="text-2xl font-semibold mb-3">{item.title}</h3>
                <p className="text-gray-700 leading-7">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-10 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-gray-600">
          <div>
            <p className="font-medium text-black mb-1">{t.brand}</p>
            <p>{t.footerText}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
            {t.footerBullets.map((item: string, index: number) => (
              <p key={index}>{item}</p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function QuizView({
  language,
  t,
  step,
  totalQuestions,
  currentQuestion,
  currentAnswer,
  error,
  onAnswerChange,
  onBack,
  onNext,
  onSwitchLanguage,
  onExit,
}: {
  language: Language;
  t: any;
  step: number;
  totalQuestions: number;
  currentQuestion: { question: string; hint: string };
  currentAnswer: string;
  error: string;
  onAnswerChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSwitchLanguage: (lang: Language) => void;
  onExit: () => void;
}) {
  const isLastStep = step === totalQuestions - 1;

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-10 flex items-center">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onExit}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            ← {t.backToStart}
          </button>
          <LanguageSwitcher language={language} onChange={onSwitchLanguage} />
        </div>

        <div className="bg-white border rounded-3xl p-6 md:p-8 shadow-sm">
          <ProgressBar current={step + 1} total={totalQuestions} />

          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.15em] text-gray-500 mb-3">
              {t.question} {step + 1} {t.of} {totalQuestions}
            </p>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {currentQuestion.question}
            </h1>

            <p className="text-gray-600 leading-7">{t.answerPrompt}</p>
          </div>

          <div className="mb-4">
            <textarea
              value={currentAnswer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder={t.textareaPlaceholder}
              className="w-full min-h-[220px] border rounded-2xl p-5 mb-3 resize-none outline-none focus:ring-2 focus:ring-black transition-shadow"
              autoFocus
            />

            <p className="text-sm text-gray-400 italic mb-2">
              💡 {currentQuestion.hint}
            </p>

            <p className="text-sm text-gray-500">{t.tip}</p>
          </div>

          {error && (
            <p className="text-red-600 mb-4 p-3 bg-red-50 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={onBack}
              className="border border-black text-black px-6 py-3 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
              disabled={step === 0}
            >
              {t.back}
            </button>

            <button
              onClick={onNext}
              className="bg-black text-white px-6 py-3 rounded-xl disabled:opacity-50 hover:bg-gray-800 transition-colors"
              disabled={!currentAnswer.trim()}
            >
              {isLastStep ? t.finishAnalysis : t.next}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoadingView({
  language,
  t,
  onSwitchLanguage,
}: {
  language: Language;
  t: any;
  onSwitchLanguage: (lang: Language) => void;
}) {
  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-10 flex items-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex justify-end mb-6">
          <LanguageSwitcher language={language} onChange={onSwitchLanguage} />
        </div>

        <div className="bg-white border rounded-3xl p-8 md:p-10 shadow-sm text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-6" />

          <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-3">
            {t.mentraAnalysis}
          </p>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t.loadingTitle}
          </h1>

          <p className="text-gray-700 leading-8 mb-8 max-w-xl mx-auto">
            {t.loadingText}
          </p>

          <div className="grid gap-3 text-left max-w-xl mx-auto">
            {[t.loading1, t.loading2, t.loading3].map((text: string, i: number) => (
              <div
                key={i}
                className="border rounded-2xl px-4 py-3 bg-neutral-50 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <p className="font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function ResultView({
  language,
  t,
  result,
  usefulnessFeedback,
  deeperVersionInterest,
  textFeedback,
  feedbackSubmitted,
  onUsefulnessChange,
  onDeeperInterestChange,
  onTextFeedbackChange,
  onSubmitFeedback,
  onRestart,
  onSwitchLanguage,
}: {
  language: Language;
  t: any;
  result: AnalysisResult & { provider?: string; _note?: string };
  usefulnessFeedback: string;
  deeperVersionInterest: string;
  textFeedback: string;
  feedbackSubmitted: boolean;
  onUsefulnessChange: (value: string) => void;
  onDeeperInterestChange: (value: string) => void;
  onTextFeedbackChange: (value: string) => void;
  onSubmitFeedback: () => void;
  onRestart: () => void;
  onSwitchLanguage: (lang: Language) => void;
}) {
  const isRussian = language === "ru";

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-6">
          <LanguageSwitcher language={language} onChange={onSwitchLanguage} />
        </div>

        {result._note && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            ⚠️ {result._note}
          </div>
        )}

        <div className="bg-white border rounded-3xl p-8 md:p-10 shadow-sm mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-3">
            {t.mentraAnalysis}
          </p>

          <div className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium mb-4 bg-neutral-50">
            {result.profileType}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t.yourMentraResult}
          </h1>

          <p className="text-lg text-gray-700 leading-8">{t.resultIntro}</p>
        </div>

        <ResultSection title={t.profileSummary}>
          <p className="leading-8 text-gray-800">{result.profileSummary}</p>
        </ResultSection>

        {result.whyThisResult && result.whyThisResult.length > 0 && (
          <ResultSection title={t.whyThisResult}>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {result.whyThisResult.map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </ResultSection>
        )}

        {result.keyStrengths && result.keyStrengths.length > 0 && (
          <ResultSection title={t.keyStrengths}>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {result.keyStrengths.map((strength: string, index: number) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </ResultSection>
        )}

        {result.workStyle && (
          <ResultSection title={t.workStyle}>
            <p className="leading-8 text-gray-800">{result.workStyle}</p>
          </ResultSection>
        )}

        {result.bestFitRoles && result.bestFitRoles.length > 0 && (
          <ResultSection title={t.bestFitRoles}>
            <div className="space-y-4">
              {result.bestFitRoles.map((item: { role: string; explanation: string }, index: number) => (
                <div
                  key={index}
                  className="border rounded-2xl p-5 bg-neutral-50"
                >
                  <h3 className="text-xl font-semibold">{item.role}</h3>
                  <p className="mt-2 text-gray-700 leading-7">
                    {item.explanation}
                  </p>
                </div>
              ))}
            </div>
          </ResultSection>
        )}

        {result.potentialMismatches && result.potentialMismatches.length > 0 && (
          <ResultSection title={t.potentialMismatches}>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {result.potentialMismatches.map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </ResultSection>
        )}

        {result.recommendedNextStep && (
          <ResultSection title={t.recommendedNextStep}>
            <p className="leading-8 text-gray-800">{result.recommendedNextStep}</p>
          </ResultSection>
        )}

        <ResultSection
          title={isRussian ? "План действий" : "Action Plan"}
        >
          <div className="space-y-6">
            {/* Start now */}
            {result.actionPlan?.immediate && result.actionPlan.immediate.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  {isRussian ? "Начать сейчас" : "Start now"}
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  {result.actionPlan.immediate.map((item: string, j: number) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Explore directions */}
            {result.actionPlan?.exploration && result.actionPlan.exploration.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  {isRussian ? "Попробовать направления" : "Explore directions"}
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  {result.actionPlan.exploration.map((item: string, j: number) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validate fit */}
            {result.actionPlan?.validation && result.actionPlan.validation.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  {isRussian ? "Проверить, подходит ли" : "Validate fit"}
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  {result.actionPlan.validation.map((item: string, j: number) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills to develop */}
            {result.actionPlan?.skillsToDevelop && result.actionPlan.skillsToDevelop.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">
                  {isRussian ? "Какие навыки развивать" : "Skills to develop"}
                </h3>
                <div className="space-y-4">
                  {result.actionPlan.skillsToDevelop.map((item: { skill: string; why: string; howToLearn: string }, i: number) => (
                    <div key={i} className="border rounded-2xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <h4 className="font-semibold text-lg text-indigo-900">{item.skill}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{isRussian ? "Почему:" : "Why:"}</span> {item.why}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{isRussian ? "С чего начать:" : "How to start:"}</span> {item.howToLearn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next move */}
            {result.actionPlan?.nextMove && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">
                  {isRussian ? "Следующий шаг" : "Next step"}
                </h3>
                <p>{result.actionPlan.nextMove}</p>
              </div>
            )}
          </div>
        </ResultSection>

        <FeedbackSection
          t={t}
          usefulnessFeedback={usefulnessFeedback}
          deeperVersionInterest={deeperVersionInterest}
          textFeedback={textFeedback}
          feedbackSubmitted={feedbackSubmitted}
          onUsefulnessChange={onUsefulnessChange}
          onDeeperInterestChange={onDeeperInterestChange}
          onTextFeedbackChange={onTextFeedbackChange}
          onSubmitFeedback={onSubmitFeedback}
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRestart}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            {t.tryAgain}
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="border border-black text-black px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {t.backToTop}
          </button>
        </div>
      </div>
    </main>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function FeedbackSection({
  t,
  usefulnessFeedback,
  deeperVersionInterest,
  textFeedback,
  feedbackSubmitted,
  onUsefulnessChange,
  onDeeperInterestChange,
  onTextFeedbackChange,
  onSubmitFeedback,
}: {
  t: any;
  usefulnessFeedback: string;
  deeperVersionInterest: string;
  textFeedback: string;
  feedbackSubmitted: boolean;
  onUsefulnessChange: (value: string) => void;
  onDeeperInterestChange: (value: string) => void;
  onTextFeedbackChange: (value: string) => void;
  onSubmitFeedback: () => void;
}) {
  if (feedbackSubmitted) {
    return (
      <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
        <div className="rounded-2xl border bg-green-50 p-5">
          <p className="font-medium mb-2 text-green-800">{t.thanksFeedback}</p>
          <p className="text-green-700 leading-7">{t.thanksFeedbackText}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">{t.quickFeedback}</h2>

      <div className="space-y-8">
        <div>
          <p className="font-medium mb-3">{t.didThisFeelAccurate}</p>
          <div className="flex flex-wrap gap-3">
            {[
              { value: "yes", label: t.yes },
              { value: "not_really", label: t.notReally },
            ].map((option: { value: string; label: string }) => (
              <button
                key={option.value}
                onClick={() => onUsefulnessChange(option.value)}
                className={`px-4 py-2 rounded-xl border transition-colors ${
                  usefulnessFeedback === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium mb-3">{t.deeperVersionQuestion}</p>
          <div className="flex flex-wrap gap-3">
            {[
              { value: "yes", label: t.yes },
              { value: "maybe", label: t.maybe },
              { value: "no", label: t.no },
            ].map((option: { value: string; label: string }) => (
              <button
                key={option.value}
                onClick={() => onDeeperInterestChange(option.value)}
                className={`px-4 py-2 rounded-xl border transition-colors ${
                  deeperVersionInterest === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium mb-3">{t.accurateOrInaccurate}</p>
          <textarea
            value={textFeedback}
            onChange={(e) => onTextFeedbackChange(e.target.value)}
            placeholder={t.feedbackPlaceholder}
            className="w-full min-h-[140px] border rounded-2xl p-4 resize-none outline-none focus:ring-2 focus:ring-black transition-shadow"
          />
        </div>

        <div>
          <button
            onClick={onSubmitFeedback}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            {t.submitFeedback}
          </button>
        </div>
      </div>
    </section>
  );
}

// ========== Main Component ==========

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("en");
  const [viewState, setViewState] = useState<ViewState>("landing");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [usefulnessFeedback, setUsefulnessFeedback] = useState("");
  const [deeperVersionInterest, setDeeperVersionInterest] = useState("");
  const [textFeedback, setTextFeedback] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const questions = questionsByLanguage[language];
  const t = ui[language];

  useEffect(() => {
    setAnswers(Array(questions.length).fill(""));
    setCurrentAnswer("");
  }, [questions]);

  useEffect(() => {
    if (viewState !== "quiz") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [viewState]);

  const handleSwitchLanguage = useCallback(
    async (nextLanguage: Language) => {
      if (nextLanguage === language) return;

      if (viewState === "quiz" && answers.some((a) => a.trim())) {
        const confirmed = window.confirm(t.languageChangeWarning);
        if (!confirmed) return;
      }

      if (viewState === "quiz") {
        setLanguage(nextLanguage);
        setStep(0);
        setAnswers([]);
        setCurrentAnswer("");
        setError("");
        return;
      }

      if (viewState === "result" && answers.length === 10) {
        setLanguage(nextLanguage);
        setViewState("loading");
        setError("");

        try {
          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers, language: nextLanguage }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to analyze answers");
          }

          setResult(data);
          setViewState("result");
        } catch (err) {
          console.error(err);
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again."
          );
          setViewState("result");
        }
        return;
      }

      setLanguage(nextLanguage);
    },
    [language, viewState, answers, t.languageChangeWarning]
  );

  const handleStart = useCallback(() => {
    console.log("assessment_started", { language });
    setViewState("quiz");
    setStep(0);
    setAnswers(Array(questions.length).fill(""));
    setCurrentAnswer("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [language, questions.length]);

  const handleExit = useCallback(() => {
    if (answers.some((a) => a.trim())) {
      const confirmed = window.confirm(t.exitQuizWarning);
      if (!confirmed) return;
    }
    setViewState("landing");
    setStep(0);
    setAnswers([]);
    setCurrentAnswer("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [answers, t.exitQuizWarning]);

  const handleBack = useCallback(() => {
    if (step === 0) return;

    const updatedAnswers = [...answers];
    updatedAnswers[step] = currentAnswer;
    setAnswers(updatedAnswers);

    const previousStep = step - 1;
    setStep(previousStep);
    setCurrentAnswer(updatedAnswers[previousStep] || "");
    setError("");
  }, [step, answers, currentAnswer]);

  const handleNext = useCallback(async () => {
    if (!currentAnswer.trim()) return;

    const updatedAnswers = [...answers];
    updatedAnswers[step] = currentAnswer.trim();
    setAnswers(updatedAnswers);

    if (step < questions.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      setCurrentAnswer(updatedAnswers[nextStep] || "");
      return;
    }

    setViewState("loading");
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: updatedAnswers, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze answers");
      }

      setResult(data);
      setViewState("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setViewState("quiz");
    }
  }, [currentAnswer, step, answers, questions.length, language]);

  const handleRestart = useCallback(() => {
    setViewState("landing");
    setStep(0);
    setAnswers([]);
    setCurrentAnswer("");
    setResult(null);
    setError("");
    setUsefulnessFeedback("");
    setDeeperVersionInterest("");
    setTextFeedback("");
    setFeedbackSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usefulnessFeedback,
          deeperVersionInterest,
          textFeedback,
          profileType: result?.profileType ?? null,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setFeedbackSubmitted(true);
    } catch (error) {
      console.error("Feedback submit error:", error);
      setError(
        language === "ru"
          ? "Не удалось отправить фидбек."
          : "Failed to submit feedback."
      );
    }
  }, [
    usefulnessFeedback,
    deeperVersionInterest,
    textFeedback,
    result?.profileType,
    language,
  ]);

  switch (viewState) {
    case "landing":
      return (
        <LandingView
          language={language}
          t={t}
          onStart={handleStart}
          onSwitchLanguage={handleSwitchLanguage}
        />
      );

    case "quiz":
      return (
        <QuizView
          language={language}
          t={t}
          step={step}
          totalQuestions={questions.length}
          currentQuestion={questions[step]}
          currentAnswer={currentAnswer}
          error={error}
          onAnswerChange={setCurrentAnswer}
          onBack={handleBack}
          onNext={handleNext}
          onSwitchLanguage={handleSwitchLanguage}
          onExit={handleExit}
        />
      );

    case "loading":
      return (
        <LoadingView
          language={language}
          t={t}
          onSwitchLanguage={handleSwitchLanguage}
        />
      );

    case "result":
      return result ? (
        <ResultView
          language={language}
          t={t}
          result={result}
          usefulnessFeedback={usefulnessFeedback}
          deeperVersionInterest={deeperVersionInterest}
          textFeedback={textFeedback}
          feedbackSubmitted={feedbackSubmitted}
          onUsefulnessChange={setUsefulnessFeedback}
          onDeeperInterestChange={setDeeperVersionInterest}
          onTextFeedbackChange={setTextFeedback}
          onSubmitFeedback={handleSubmitFeedback}
          onRestart={handleRestart}
          onSwitchLanguage={handleSwitchLanguage}
        />
      ) : null;

    default:
      return null;
  }
}