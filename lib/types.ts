export type AnalysisResult = {
  provider?: string;
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
};