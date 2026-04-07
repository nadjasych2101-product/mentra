"use client";

import { useState } from "react";
import { questionsByLanguage } from "@/data/questions";
import type { AnalysisResult } from "@/lib/types";

type Language = "en" | "ru";

const ui = {
  en: {
    brand: "Mentra",
    heroTitle: "Find work that actually fits how you think and operate",
    heroText:
      "Mentra asks you a short set of questions, then turns your answers into a practical career reflection: your strengths, work style, likely mismatches, and role directions worth exploring.",
    startAssessment: "Start assessment",
    seeHowItWorks: "See how it works",
    bullets: ["10 short questions", "Takes around 3–5 minutes", "No sign-up needed"],
    whatYouGet: "What you get",
    profileSummary: "Profile Summary",
    bestFitRoles: "Best-Fit Roles",
    recommendedNextStep: "Recommended Next Step",
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
    tryAgain: "Try again",
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
  },
    ru: {
      brand: "Mentra",
      heroTitle: "Найди работу, которая действительно подходит тебе по мышлению и стилю работы",
      heroText:
        "Mentra задаёт короткий набор вопросов и превращает ответы в практический карьерный разбор: твои сильные стороны, стиль работы, возможные несовпадения и направления ролей, которые могут тебе подойти.",
      startAssessment: "Начать",
      seeHowItWorks: "Как это работает",
      bullets: ["10 коротких вопросов", "Занимает около 3–5 минут", "Без регистрации"],
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
      footerBullets: ["10 вопросов", "Без регистрации", "Сделано для быстрого фидбека"],
      mentraAnalysis: "Анализ Mentra",
      yourMentraResult: "Твой результат Mentra",
      resultIntro:
        "Первый разбор того, как ты работаешь, что тебя заряжает и какие типы ролей могут подойти тебе лучше всего.",
      whyThisResult: "Почему такой результат",
      keyStrengths: "Сильные стороны",
      workStyle: "Стиль работы",
      potentialMismatches: "Что может не подойти",
      tryAgain: "Пройти ещё раз",
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
      feedbackPlaceholder: "Необязательно — расскажи, что показалось точным или мимо.",
      submitFeedback: "Отправить фидбек",
      thanksFeedback: "Спасибо за фидбек.",
      thanksFeedbackText:
        "Это помогает улучшать Mentra и формировать более глубокую версию.",
    },
} as const;

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("en");
  const questions = questionsByLanguage[language];
  const t = ui[language];

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  );
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [usefulnessFeedback, setUsefulnessFeedback] = useState<string>("");
  const [deeperVersionInterest, setDeeperVersionInterest] = useState<string>("");
  const [textFeedback, setTextFeedback] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    const switchLanguage = (nextLanguage: Language) => {
      if (nextLanguage === language) return;

      const currentQuestions = questionsByLanguage[language];
      const nextQuestions = questionsByLanguage[nextLanguage];

      const updatedAnswers = [...answers];
      updatedAnswers[step] = currentAnswer;

      setAnswers(updatedAnswers);
      setLanguage(nextLanguage);
      setCurrentAnswer(updatedAnswers[step] || "");

      if (!started) {
        setAnswers(Array(nextQuestions.length).fill(""));
        setCurrentAnswer("");
      }

      setError("");
    };

  const handleStart = () => {
    console.log("assessment_started", { language });
    setStarted(true);
  };

  const handleNext = async () => {
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

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers: updatedAnswers, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze answers");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 0) return;

    const updatedAnswers = [...answers];
    updatedAnswers[step] = currentAnswer;
    setAnswers(updatedAnswers);

    const previousStep = step - 1;
    setStep(previousStep);
    setCurrentAnswer(updatedAnswers[previousStep] || "");
    setError("");
  };

  const handleSubmitFeedback = async () => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usefulnessFeedback,
          deeperVersionInterest,
          textFeedback,
          profileType: result?.profileType ?? null,
          language,
        }),
      });

      setFeedbackSubmitted(true);
    } catch (error) {
      console.error("Feedback submit error:", error);
    }
  };

  const handleRestart = () => {
    setStarted(false);
    setStep(0);
    setAnswers(Array(questions.length).fill(""));
    setCurrentAnswer("");
    setLoading(false);
    setResult(null);
    setError("");
    setUsefulnessFeedback("");
    setDeeperVersionInterest("");
    setTextFeedback("");
    setFeedbackSubmitted(false);
  };

  if (result) {
    return (
      <main className="min-h-screen bg-neutral-50 text-black px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-end mb-6">
            <div className="inline-flex border rounded-full p-1 bg-white">
              <button
                onClick={() => switchLanguage("en")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "en" ? "bg-black text-white" : "text-black"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => switchLanguage("ru")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "ru" ? "bg-black text-white" : "text-black"
                }`}
              >
                RU
              </button>
            </div>
          </div>

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

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.whyThisResult}</h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.whyThisResult ?? []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.profileSummary}</h2>
            <p className="leading-8 text-gray-800">{result.profileSummary}</p>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.keyStrengths}</h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.keyStrengths ?? []).map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.workStyle}</h2>
            <p className="leading-8 text-gray-800">{result.workStyle}</p>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.bestFitRoles}</h2>
            <div className="space-y-4">
              {(result.bestFitRoles ?? []).map((item, index) => (
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
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">
              {t.potentialMismatches}
            </h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.potentialMismatches ?? []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">
              {t.recommendedNextStep}
            </h2>
            <p className="leading-8 text-gray-800">
              {result.recommendedNextStep}
            </p>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{t.quickFeedback}</h2>

            {!feedbackSubmitted ? (
              <div className="space-y-8">
                <div>
                  <p className="font-medium mb-3">{t.didThisFeelAccurate}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setUsefulnessFeedback("yes")}
                      className={`px-4 py-2 rounded-xl border ${
                        usefulnessFeedback === "yes"
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300"
                      }`}
                    >
                      {t.yes}
                    </button>

                    <button
                      onClick={() => setUsefulnessFeedback("not_really")}
                      className={`px-4 py-2 rounded-xl border ${
                        usefulnessFeedback === "not_really"
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300"
                      }`}
                    >
                      {t.notReally}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-3">{t.deeperVersionQuestion}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setDeeperVersionInterest("yes")}
                      className={`px-4 py-2 rounded-xl border ${
                        deeperVersionInterest === "yes"
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300"
                      }`}
                    >
                      {t.yes}
                    </button>

                    <button
                      onClick={() => setDeeperVersionInterest("maybe")}
                      className={`px-4 py-2 rounded-xl border ${
                        deeperVersionInterest === "maybe"
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300"
                      }`}
                    >
                      {t.maybe}
                    </button>

                    <button
                      onClick={() => setDeeperVersionInterest("no")}
                      className={`px-4 py-2 rounded-xl border ${
                        deeperVersionInterest === "no"
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300"
                      }`}
                    >
                      {t.no}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-3">{t.accurateOrInaccurate}</p>
                  <textarea
                    value={textFeedback}
                    onChange={(e) => setTextFeedback(e.target.value)}
                    placeholder={t.feedbackPlaceholder}
                    className="w-full min-h-[140px] border rounded-2xl p-4 resize-none outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <button
                    onClick={handleSubmitFeedback}
                    className="bg-black text-white px-6 py-3 rounded-xl"
                  >
                    {t.submitFeedback}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-neutral-50 p-5">
                <p className="font-medium mb-2">{t.thanksFeedback}</p>
                <p className="text-gray-700 leading-7">{t.thanksFeedbackText}</p>
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="bg-black text-white px-6 py-3 rounded-xl"
            >
              {t.tryAgain}
            </button>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="border border-black text-black px-6 py-3 rounded-xl"
            >
              {t.backToTop}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-white text-black">
        <section className="px-6 py-6">
          <div className="max-w-6xl mx-auto flex justify-end">
            <div className="inline-flex border rounded-full p-1 bg-white">
              <button
                onClick={() => switchLanguage("en")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "en" ? "bg-black text-white" : "text-black"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => switchLanguage("ru")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "ru" ? "bg-black text-white" : "text-black"
                }`}
              >
                RU
              </button>
            </div>
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
                  onClick={handleStart}
                  className="bg-black text-white px-6 py-3 rounded-xl"
                >
                  {t.startAssessment}
                </button>

                <button
                  onClick={() =>
                    document.getElementById("how-it-works")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  className="border border-black text-black px-6 py-3 rounded-xl"
                >
                  {t.seeHowItWorks}
                </button>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                {t.bullets.map((item, index) => (
                  <p key={index}>• {item}</p>
                ))}
              </div>
            </div>

            <div className="bg-neutral-50 border rounded-3xl p-8 md:p-10 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                {t.whatYouGet}
              </p>

              <div className="space-y-5">
                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">{t.profileSummary}</h3>
                  <p className="text-gray-700 leading-7">
                    {t.whatYouGetSummary}
                  </p>
                </div>

                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">{t.bestFitRoles}</h3>
                  <p className="text-gray-700 leading-7">{t.whatYouGetRoles}</p>
                </div>

                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">
                    {t.recommendedNextStep}
                  </h3>
                  <p className="text-gray-700 leading-7">
                    {t.whatYouGetNextStep}
                  </p>
                </div>
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
              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">{t.step1}</p>
                <h3 className="text-2xl font-semibold mb-3">{t.step1Title}</h3>
                <p className="text-gray-700 leading-7">{t.step1Text}</p>
              </div>

              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">{t.step2}</p>
                <h3 className="text-2xl font-semibold mb-3">{t.step2Title}</h3>
                <p className="text-gray-700 leading-7">{t.step2Text}</p>
              </div>

              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">{t.step3}</p>
                <h3 className="text-2xl font-semibold mb-3">{t.step3Title}</h3>
                <p className="text-gray-700 leading-7">{t.step3Text}</p>
              </div>
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
              {t.footerBullets.map((item, index) => (
                <p key={index}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 text-black px-6 py-10 flex items-center">
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex justify-end mb-6">
            <div className="inline-flex border rounded-full p-1 bg-white">
              <button
                onClick={() => switchLanguage("en")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "en" ? "bg-black text-white" : "text-black"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => switchLanguage("ru")}
                className={`px-4 py-2 rounded-full text-sm ${
                  language === "ru" ? "bg-black text-white" : "text-black"
                }`}
              >
                RU
              </button>
            </div>
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
              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">{t.loading1}</p>
              </div>

              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">{t.loading2}</p>
              </div>

              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">{t.loading3}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-10 flex items-center">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex justify-end mb-6">
          <div className="inline-flex border rounded-full p-1 bg-white">
            <button
              onClick={() => switchLanguage("en")}
              className={`px-4 py-2 rounded-full text-sm ${
                language === "en" ? "bg-black text-white" : "text-black"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => switchLanguage("ru")}
              className={`px-4 py-2 rounded-full text-sm ${
                language === "ru" ? "bg-black text-white" : "text-black"
              }`}
            >
              RU
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.15em] text-gray-500 mb-3">
              {t.question} {step + 1} {t.of} {questions.length}
            </p>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {questions[step]}
            </h1>

            <p className="text-gray-600 leading-7">{t.answerPrompt}</p>
          </div>

          <div className="mb-4">
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={t.textareaPlaceholder}
              className="w-full min-h-[220px] border rounded-2xl p-5 mb-3 resize-none outline-none focus:ring-2 focus:ring-black"
            />

            <p className="text-sm text-gray-500">{t.tip}</p>
          </div>

          {error && <p className="text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handleBack}
              className="border border-black text-black px-6 py-3 rounded-xl disabled:opacity-40"
              disabled={step === 0}
            >
              {t.back}
            </button>

            <button
              onClick={handleNext}
              className="bg-black text-white px-6 py-3 rounded-xl disabled:opacity-50"
              disabled={!currentAnswer.trim()}
            >
              {step === questions.length - 1 ? t.finishAnalysis : t.next}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}