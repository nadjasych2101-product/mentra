import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const body = await req.json();
    const answers = body.answers as string[];

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
      result = {
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
      result = {
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
      result = {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}