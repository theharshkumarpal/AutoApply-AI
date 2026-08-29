export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  platform: string;
  postedAt: string;
  description: string;
  refinedDescription?: string | null;
  cleanSummary?: string | null;
  reqSkills?: string | null;
  minExp?: string | null;
  salaryRange?: string | null;
  matchScore: number | null;
  prefMatchScore?: number | null;
}

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  yearsExperience: number;
  skills: string;
  jobPreferences?: string;
  resumeSummary: string;
}

export interface ApplicationLog {
  id: string;
  job: Job;
  status: string;
  logs: string | null;
  appliedAt: string;
}
