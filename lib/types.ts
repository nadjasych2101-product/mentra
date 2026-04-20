export type AnalysisResult = {
  profileType: string;
  profileSummary: string;
  whyThisResult: string[];
  keyStrengths: string[];
  workStyle: string;
  bestFitRoles: Array<{
    role: string;
    explanation: string;
  }>;
  potentialMismatches: string[];
  recommendedNextStep: string;
  actionPlan: {
    immediate: string[];
    exploration: string[];
    validation: string[];
    skillsToDevelop: Array<{
      skill: string;
      why: string;
      howToLearn: string;
    }>;
    nextMove: string;
  };
  provider?: "groq" | "deepseek" | "fallback";
  _note?: string;
  confidence?: "low" | "medium" | "high";
};