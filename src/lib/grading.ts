import { GradeBoundary, Score } from "@/types";

export const DEFAULT_GRADING_SCALE: GradeBoundary[] = [
  {
    grade: "A",
    minScore: 80,
    maxScore: 100,
    descriptor: "Excellent",
    color: "#16a34a",
  },
  {
    grade: "B",
    minScore: 70,
    maxScore: 79,
    descriptor: "Very Good",
    color: "#2563eb",
  },
  {
    grade: "C",
    minScore: 60,
    maxScore: 69,
    descriptor: "Good",
    color: "#0891b2",
  },
  {
    grade: "D",
    minScore: 50,
    maxScore: 59,
    descriptor: "Credit",
    color: "#ca8a04",
  },
  {
    grade: "E",
    minScore: 40,
    maxScore: 49,
    descriptor: "Pass",
    color: "#ea580c",
  },
  {
    grade: "F",
    minScore: 0,
    maxScore: 39,
    descriptor: "Fail",
    color: "#dc2626",
  },
];

export const NACCA_DESCRIPTORS: GradeBoundary[] = [
  {
    grade: "HP",
    minScore: 80,
    maxScore: 100,
    descriptor: "Highly Proficient",
    color: "#16a34a",
  },
  {
    grade: "P",
    minScore: 66,
    maxScore: 79,
    descriptor: "Proficient",
    color: "#2563eb",
  },
  {
    grade: "AP",
    minScore: 50,
    maxScore: 65,
    descriptor: "Approaching Proficiency",
    color: "#ca8a04",
  },
  {
    grade: "D",
    minScore: 40,
    maxScore: 49,
    descriptor: "Developing",
    color: "#ea580c",
  },
  {
    grade: "E",
    minScore: 0,
    maxScore: 39,
    descriptor: "Emerging",
    color: "#dc2626",
  },
];

export function getGrade(
  score: number,
  scale: GradeBoundary[] = DEFAULT_GRADING_SCALE,
): GradeBoundary {
  const sorted = [...scale].sort((a, b) => b.minScore - a.minScore);
  for (const g of sorted) {
    if (Number.isFinite(score) && score >= g.minScore) return g;
  }
  return sorted[sorted.length - 1];
}

export function scaleScore(
  raw: number,
  maxRaw: number,
  targetMax: number,
): number {
  if (maxRaw <= 0) return 0;
  const scaled = (raw / maxRaw) * targetMax;
  return Math.round(scaled * 100) / 100;
}

export function computeTotal(
  sbaRaw: number,
  sbaMax: number,
  examRaw: number,
  examMax: number,
  sbaWeight = 50,
  examWeight = 50,
): {
  sbaScaled: number;
  examScaled: number;
  total: number;
  grade: string;
  descriptor: string;
} {
  const sbaScaled = scaleScore(sbaRaw, sbaMax, sbaWeight);
  const examScaled = scaleScore(examRaw, examMax, examWeight);
  const total = Math.round((sbaScaled + examScaled) * 100) / 100;
  const g = getGrade(total);
  return {
    sbaScaled,
    examScaled,
    total,
    grade: g.grade,
    descriptor: g.descriptor,
  };
}

export function computePositions(
  scores: { studentId: string; total: number }[],
): Map<string, number> {
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const positions = new Map<string, number>();
  let currentPos = 1;
  sorted.forEach((s, idx) => {
    if (idx > 0 && s.total < sorted[idx - 1].total) {
      currentPos = idx + 1;
    }
    positions.set(s.studentId, currentPos);
  });
  return positions;
}

export function computeOverallAverage(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s.total, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}
