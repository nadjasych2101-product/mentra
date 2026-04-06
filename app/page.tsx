"use client";

import { useState } from "react";
import { questions } from "@/data/questions";
import type { AnalysisResult } from "@/lib/types";

export default function HomePage() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  );
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  const handleStart = () => {
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
        body: JSON.stringify({ answers: updatedAnswers }),
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

  const handleRestart = () => {
    setStarted(false);
    setStep(0);
    setAnswers(Array(questions.length).fill(""));
    setCurrentAnswer("");
    setLoading(false);
    setResult(null);
    setError("");
  };

  if (result) {
    return (
      <main className="min-h-screen bg-neutral-50 text-black px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border rounded-3xl p-8 md:p-10 shadow-sm mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-3">
              Mentra Analysis
            </p>

            <div className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium mb-4 bg-neutral-50">
              {result.profileType}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Your Mentra Result
            </h1>

            <p className="text-lg text-gray-700 leading-8">
              A first-pass reflection on how you work, what energizes you, and
              what kinds of roles may fit you best.
            </p>
          </div>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Why this result</h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.whyThisResult ?? []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Profile Summary</h2>
            <p className="leading-8 text-gray-800">{result.profileSummary}</p>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Key Strengths</h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.keyStrengths ?? []).map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Work Style</h2>
            <p className="leading-8 text-gray-800">{result.workStyle}</p>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Best-Fit Roles</h2>
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
              Potential Mismatches
            </h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-800">
              {(result.potentialMismatches ?? []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-8 bg-white rounded-3xl p-6 md:p-8 border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">
              Recommended Next Step
            </h2>
            <p className="leading-8 text-gray-800">
              {result.recommendedNextStep}
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="bg-black text-white px-6 py-3 rounded-xl"
            >
              Try again
            </button>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="border border-black text-black px-6 py-3 rounded-xl"
            >
              Back to top
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-white text-black">
        <section className="px-6 py-10 flex items-center min-h-screen">
          <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                Mentra
              </p>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                Find work that actually fits how you think and operate
              </h1>

              <p className="text-lg text-gray-700 leading-8 mb-6 max-w-xl">
                Mentra asks you a short set of questions, then turns your answers
                into a practical career reflection: your strengths, work style,
                likely mismatches, and role directions worth exploring.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button
                  onClick={handleStart}
                  className="bg-black text-white px-6 py-3 rounded-xl"
                >
                  Start assessment
                </button>

                <button
                  onClick={() =>
                    document.getElementById("how-it-works")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  className="border border-black text-black px-6 py-3 rounded-xl"
                >
                  See how it works
                </button>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p>• 10 short questions</p>
                <p>• Takes around 3–5 minutes</p>
                <p>• No sign-up needed</p>
              </div>
            </div>

            <div className="bg-neutral-50 border rounded-3xl p-8 md:p-10 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                What you get
              </p>

              <div className="space-y-5">
                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">Profile Summary</h3>
                  <p className="text-gray-700 leading-7">
                    A concise reflection on how you approach work and what seems
                    to drive you.
                  </p>
                </div>

                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">Best-Fit Roles</h3>
                  <p className="text-gray-700 leading-7">
                    A first-pass view of the kinds of roles and environments that
                    may suit you best.
                  </p>
                </div>

                <div className="border rounded-2xl bg-white p-5">
                  <h3 className="font-semibold text-lg mb-2">
                    Recommended Next Step
                  </h3>
                  <p className="text-gray-700 leading-7">
                    One practical next move you can take instead of vague career
                    advice.
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
              How it works
            </p>

            <h2 className="text-4xl md:text-5xl font-bold mb-12 max-w-3xl">
              A simple first step toward clearer career direction
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">Step 1</p>
                <h3 className="text-2xl font-semibold mb-3">
                  Answer 10 questions
                </h3>
                <p className="text-gray-700 leading-7">
                  You respond to a short set of prompts about what energizes you,
                  drains you, and the kinds of environments where you tend to do
                  your best work.
                </p>
              </div>

              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">Step 2</p>
                <h3 className="text-2xl font-semibold mb-3">
                  Mentra analyzes patterns
                </h3>
                <p className="text-gray-700 leading-7">
                  Based on your answers, Mentra looks for signals around autonomy,
                  structure, collaboration, motivation, and possible role fit.
                </p>
              </div>

              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">Step 3</p>
                <h3 className="text-2xl font-semibold mb-3">
                  Get a practical result
                </h3>
                <p className="text-gray-700 leading-7">
                  You receive a clear summary, possible strengths, likely role
                  directions, and one next step you can actually act on.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-10 bg-white">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-gray-600">
            <div>
              <p className="font-medium text-black mb-1">Mentra</p>
              <p>Early prototype for clearer career direction.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
              <p>10 questions</p>
              <p>No sign-up</p>
              <p>Built for fast feedback</p>
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
          <div className="bg-white border rounded-3xl p-8 md:p-10 shadow-sm text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-6" />

            <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-3">
              Mentra Analysis
            </p>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Analyzing your responses
            </h1>

            <p className="text-gray-700 leading-8 mb-8 max-w-xl mx-auto">
              Looking for patterns in what energizes you, what drains you, and
              which kinds of roles and environments may fit you best.
            </p>

            <div className="grid gap-3 text-left max-w-xl mx-auto">
              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">Reviewing work preferences</p>
              </div>

              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">Identifying likely strengths</p>
              </div>

              <div className="border rounded-2xl px-4 py-3 bg-neutral-50">
                <p className="font-medium">Estimating role fit and mismatches</p>
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
        <div className="bg-white border rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.15em] text-gray-500 mb-3">
              Question {step + 1} of {questions.length}
            </p>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {questions[step]}
            </h1>

            <p className="text-gray-600 leading-7">
              Answer in your own words. A short honest answer is better than a
              polished one.
            </p>
          </div>

          <div className="mb-4">
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full min-h-[220px] border rounded-2xl p-5 mb-3 resize-none outline-none focus:ring-2 focus:ring-black"
            />

            <p className="text-sm text-gray-500">
              Tip: concrete examples usually lead to better results.
            </p>
          </div>

          {error && <p className="text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handleBack}
              className="border border-black text-black px-6 py-3 rounded-xl disabled:opacity-40"
              disabled={step === 0}
            >
              Back
            </button>

            <button
              onClick={handleNext}
              className="bg-black text-white px-6 py-3 rounded-xl disabled:opacity-50"
              disabled={!currentAnswer.trim()}
            >
              {step === questions.length - 1 ? "Finish Analysis" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}