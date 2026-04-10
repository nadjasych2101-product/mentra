export type AnalysisResult = {
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
    nextMove: string;
  };

  profileType: string;
  provider?: string;
};