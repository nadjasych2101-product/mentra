import { NextRequest, NextResponse } from "next/server";

type Language = "en" | "ru";

export async function POST(req: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const body = await req.json();
    const answers = body.answers as string[];
    const language = (body.language as Language) || "en";

    if (
      !answers ||
      !Array.isArray(answers) ||
      answers.length !== 10 ||
      answers.some((a) => typeof a !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid answers payload" },
        { status: 400 }
      );
    }

    const combinedText = answers.join(" ").toLowerCase();

    const entrepreneurKeywords = [
      "freedom",
      "independence",
      "startup",
      "build",
      "building",
      "create",
      "creating",
      "own",
      "founder",
      "business",
      "idea",
      "ideas",
      "autonomy",
      "impact",
      "vision",
      "свобода",
      "независимость",
      "стартап",
      "строить",
      "создавать",
      "создание",
      "своё",
      "основатель",
      "бизнес",
      "идея",
      "идеи",
      "автономия",
      "влияние",
      "смысл",
      "проект",
    ];

    const structuredKeywords = [
      "structure",
      "structured",
      "stability",
      "stable",
      "process",
      "systems",
      "system",
      "clear",
      "clarity",
      "organized",
      "predictable",
      "planning",
      "security",
      "routine",
      "структура",
      "стабильность",
      "стабильный",
      "процесс",
      "система",
      "системы",
      "понятно",
      "ясность",
      "организованность",
      "предсказуемость",
      "планирование",
      "безопасность",
      "рутина",
      "четкие",
      "чёткие",
    ];

    const peopleKeywords = [
      "people",
      "team",
      "teams",
      "clients",
      "help",
      "helping",
      "support",
      "communication",
      "communicating",
      "relationships",
      "community",
      "collaboration",
      "collaborative",
      "lead",
      "leading",
      "mentoring",
      "люди",
      "команда",
      "команды",
      "клиенты",
      "помощь",
      "помогать",
      "поддержка",
      "общение",
      "коммуникация",
      "отношения",
      "сообщество",
      "сотрудничество",
      "вести",
      "лидерство",
      "менторство",
    ];

    const countMatches = (keywords: string[]) => {
      return keywords.reduce((count, keyword) => {
        return combinedText.includes(keyword) ? count + 1 : count;
      }, 0);
    };

    const entrepreneurScore = countMatches(entrepreneurKeywords);
    const structuredScore = countMatches(structuredKeywords);
    const peopleScore = countMatches(peopleKeywords);

    let result;

    if (
      entrepreneurScore >= structuredScore &&
      entrepreneurScore >= peopleScore
    ) {
      result =
        language === "ru"
          ? {
              profileType: "Ориентация на создание и инициативу",
              profileSummary:
                "Похоже, тебя мотивируют автономия, ощущение владения результатом и возможность создавать что-то значимое. Твои ответы показывают, что тебя заряжают инициатива, самостоятельность мышления и работа, где можно влиять на направление, а не только выполнять чужие указания.",
              whyThisResult: [
                "В твоих ответах повторяются сигналы про свободу, самостоятельность и ощущение ownership.",
                "Похоже, тебя больше заряжает создание и формирование чего-то нового, чем просто выполнение заранее заданных задач.",
                "Есть признаки того, что тебе ближе инициатива и гибкость, чем жёсткая структура.",
              ],
              keyStrengths: [
                "Самостоятельность и инициативность",
                "Сильное чувство ответственности за результат",
                "Умение мыслить через идеи, направления и возможности",
              ],
              workStyle:
                "С высокой вероятностью тебе лучше всего подходят гибкие, быстро меняющиеся среды, где можно принимать решения, пробовать новое и видеть прямое влияние своих действий.",
              bestFitRoles: [
                {
                  role: "Основатель / предприниматель",
                  explanation:
                    "Твои ответы указывают на высокую мотивацию к автономии, ответственности и созданию чего-то с нуля.",
                },
                {
                  role: "Создатель продукта / product builder",
                  explanation:
                    "Тебе могут подойти роли, где нужно быстро превращать идеи в конкретный продукт или сервис.",
                },
                {
                  role: "Business development / early-stage operator",
                  explanation:
                    "Есть ощущение, что тебе близка работа, где нужно формировать направление, тестировать гипотезы и двигаться в неоднозначной среде.",
                },
              ],
              potentialMismatches: [
                "Слишком жёсткие среды, где почти нет пространства для инициативы",
                "Повторяющиеся исполнительские роли без ощущения ownership",
              ],
              recommendedNextStep:
                "Выбери одну идею или направление, к которому ты постоянно возвращаешься, и протестируй её в маленьком конкретном формате уже на этой неделе: лендинг, разговор с потенциальным пользователем или простой прототип.",
            }
          : {
              profileType: "Builder-oriented",
              profileSummary:
                "You appear motivated by autonomy, ownership, and the chance to build something meaningful. Your answers suggest you are energized by initiative, original thinking, and work where you can shape direction rather than only follow it.",
              whyThisResult: [
                "Your answers repeatedly point toward autonomy, ownership, and freedom.",
                "You seem more energized by creating or shaping things than by only executing predefined tasks.",
                "There are signals that you may prefer initiative and flexibility over rigid structure.",
              ],
              keyStrengths: [
                "Self-direction and initiative",
                "Strong ownership mindset",
                "Ability to think in terms of ideas, direction, and opportunity",
              ],
              workStyle:
                "You are likely to do your best in flexible, fast-moving environments where you can make decisions, experiment, and have visible impact on outcomes.",
              bestFitRoles: [
                {
                  role: "Startup Founder",
                  explanation:
                    "Your answers point toward high motivation for autonomy, ownership, and building from scratch.",
                },
                {
                  role: "Product Builder",
                  explanation:
                    "You may thrive in roles where you can turn ideas into concrete products or services quickly.",
                },
                {
                  role: "Business Development / Early-stage Operator",
                  explanation:
                    "You seem likely to enjoy shaping direction, testing opportunities, and moving across ambiguous, evolving work.",
                },
              ],
              potentialMismatches: [
                "Highly rigid environments with little room for initiative",
                "Repetitive execution-only roles without ownership",
              ],
              recommendedNextStep:
                "Choose one idea or direction you keep returning to and test it in a small, concrete way this week: a landing page, a user interview, or a simple prototype.",
            };
    } else if (
      structuredScore >= entrepreneurScore &&
      structuredScore >= peopleScore
    ) {
      result =
        language === "ru"
          ? {
              profileType: "Ориентация на структуру и системность",
              profileSummary:
                "Твои ответы показывают, что для тебя важны ясность, стабильность и хорошо выстроенные системы. Похоже, ты лучше всего раскрываешься там, где ожидания понятны, работа организована, а прогресс достигается через продуманную структуру, а не через хаос.",
              whyThisResult: [
                "Твои ответы указывают на то, что тебе важны ясность, предсказуемость и сильные системы.",
                "Похоже, тебе легче быть эффективной в среде с понятными ожиданиями и организованными процессами.",
                "Есть признаки того, что слишком много хаоса и неопределённости может снижать твою эффективность.",
              ],
              keyStrengths: [
                "Тяга к структуре и ясности",
                "Надёжность и последовательность",
                "Умение хорошо работать в организованных системах и процессах",
              ],
              workStyle:
                "Скорее всего, тебе подходят среды, где цели, зоны ответственности и рабочие процессы чётко определены, а сильное исполнение важнее постоянной неопределённости.",
              bestFitRoles: [
                {
                  role: "Специалист по операциям / operations",
                  explanation:
                    "Твои ответы указывают на хороший fit для ролей, где нужно поддерживать работу систем и улучшать процессы.",
                },
                {
                  role: "Координатор или менеджер проектов",
                  explanation:
                    "Тебе могут подойти роли, где важны планирование, доведение до результата и координация разных частей работы.",
                },
                {
                  role: "Бизнес-аналитик",
                  explanation:
                    "Структурная аналитическая роль может хорошо совпасть с твоей тягой к ясности, логике и организованному решению задач.",
                },
              ],
              potentialMismatches: [
                "Хаотичные среды без ясных приоритетов",
                "Роли, где нужно постоянно импровизировать без достаточной опоры и структуры",
              ],
              recommendedNextStep:
                "Посмотри на 2–3 роли, связанные с планированием, анализом или операциями, и сравни, какая из них лучше совпадает с тем уровнем структуры и ответственности, который тебе нужен.",
            }
          : {
              profileType: "Structured / operator-oriented",
              profileSummary:
                "Your answers suggest that you value clarity, stability, and well-designed systems. You seem likely to perform best when expectations are clear, work is organized, and progress can be made through thoughtful structure rather than chaos.",
              whyThisResult: [
                "Your answers suggest that clarity, predictability, and strong systems matter to you.",
                "You seem likely to do better in environments with defined expectations and organized workflows.",
                "There are signs that too much ambiguity or chaos may reduce your effectiveness.",
              ],
              keyStrengths: [
                "Preference for structure and clarity",
                "Reliability and consistency",
                "Ability to work well within organized systems and processes",
              ],
              workStyle:
                "You likely thrive in environments where goals, responsibilities, and workflows are clearly defined, and where strong execution matters more than constant ambiguity.",
              bestFitRoles: [
                {
                  role: "Operations Specialist",
                  explanation:
                    "Your answers suggest a good fit for keeping systems running smoothly and improving how work gets done.",
                },
                {
                  role: "Project Coordinator / Project Manager",
                  explanation:
                    "You may be well suited to roles that require planning, follow-through, and coordination across moving parts.",
                },
                {
                  role: "Business Analyst",
                  explanation:
                    "A structured, analytical role may suit your preference for clarity, logic, and organized problem-solving.",
                },
              ],
              potentialMismatches: [
                "Chaotic environments with no clear priorities",
                "Roles that require constant improvisation without enough support or structure",
              ],
              recommendedNextStep:
                "Look at 2–3 roles built around planning, analysis, or operations, and compare which one best matches the level of structure and responsibility you want.",
            };
    } else {
      result =
        language === "ru"
          ? {
              profileType: "Ориентация на людей и взаимодействие",
              profileSummary:
                "Твои ответы показывают, что люди, сотрудничество и человеческий эффект — важная часть того, как ты воспринимаешь работу. Похоже, тебя заряжают коммуникация, поддержка, построение доверия и работа, которая напрямую влияет на других.",
              whyThisResult: [
                "В твоих ответах повторяются сигналы про людей, взаимодействие и прямое влияние на других.",
                "Похоже, тебя заряжает общение, поддержка и построение отношений.",
                "Есть признаки того, что слишком изолированная работа может быть для тебя менее удовлетворяющей.",
              ],
              keyStrengths: [
                "Сильная ориентация на людей",
                "Коммуникация и умение выстраивать отношения",
                "Вероятная способность поддерживать, направлять и эффективно сотрудничать",
              ],
              workStyle:
                "Скорее всего, ты лучше всего раскрываешься в коллаборативных средах, где важны коммуникация, отношения и заметное человеческое влияние работы.",
              bestFitRoles: [
                {
                  role: "Community Manager",
                  explanation:
                    "Твои ответы указывают на естественный fit для ролей, связанных с людьми, вовлечением и отношениями.",
                },
                {
                  role: "Customer Success / Client Partner",
                  explanation:
                    "Тебе могут подойти роли, где важно помогать людям, выстраивать доверие и решать задачи через коммуникацию.",
                },
                {
                  role: "People Operations / Talent role",
                  explanation:
                    "Ты можешь хорошо раскрыться в ролях, где центральную роль играют понимание людей и поддержка их роста.",
                },
              ],
              potentialMismatches: [
                "Сильно изолированная работа с минимальным общением",
                "Роли, сфокусированные только на системах или задачах без человеческого взаимодействия",
              ],
              recommendedNextStep:
                "Обрати внимание, в каких ситуациях ты чувствуешь себя наиболее полезной людям, и исследуй роли, где коммуникация, доверие и поддержка — это не побочная часть, а основа работы.",
            }
          : {
              profileType: "People-oriented",
              profileSummary:
                "Your answers suggest that people, collaboration, and human impact are central to how you think about work. You seem likely to be energized by communication, support, trust-building, and work that directly affects others.",
              whyThisResult: [
                "Your answers repeatedly point toward people, collaboration, and direct human impact.",
                "You seem energized by communication, support, and relationship-building.",
                "There are signals that highly isolated work may be less satisfying for you.",
              ],
              keyStrengths: [
                "Strong people orientation",
                "Communication and relationship-building",
                "Likely ability to support, guide, or collaborate effectively",
              ],
              workStyle:
                "You probably do your best in collaborative environments where communication matters, relationships are important, and work has visible human impact.",
              bestFitRoles: [
                {
                  role: "Community Manager",
                  explanation:
                    "Your answers suggest a natural fit for work built around people, engagement, and relationships.",
                },
                {
                  role: "Customer Success / Client Partner",
                  explanation:
                    "You may be well suited to helping others, building trust, and solving problems through communication.",
                },
                {
                  role: "People Operations / Talent Role",
                  explanation:
                    "You may thrive in roles where understanding people and supporting growth are central.",
                },
              ],
              potentialMismatches: [
                "Highly isolated work with minimal communication",
                "Roles focused only on systems or tasks with little human interaction",
              ],
              recommendedNextStep:
                "Notice which situations make you feel most useful to other people, then explore roles where communication, trust, and guidance are not side tasks but the core of the job.",
            };
    }

    console.log("assessment_completed", {
      language,
      answersLength: answers.length,
      profileType: result.profileType,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}