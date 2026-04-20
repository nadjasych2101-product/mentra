export type AnalysisResult = {
  profileType: string;
  profileSummary: string;
  whyThisResult: string[];
  keyStrengths: string[];
  workStyle: string;
  bestFitRoles: {
    role: string;
    explanation: string;
  }[];
  potentialMismatches: string[];
  recommendedNextStep: string;
  actionPlan: {
    immediate: string[];
    exploration: string[];
    validation: string[];
    skillsToDevelop?: Array<{
      skill: string;
      why: string;
      howToLearn: string;
    }>;
    nextMove: string;
  };
  provider?: string;
  _note?: string;
  confidence?: string;
};