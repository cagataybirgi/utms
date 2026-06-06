import { PreviousCourse, TargetCourse } from "../../shared/types";

export interface Suggestion {
  source: PreviousCourse;
  candidate: TargetCourse;
  similarityScore: number;
}

export class SuggestionEngine {
  generate(
    previous: PreviousCourse[],
    targetCurriculum: TargetCourse[],
    threshold = 0.45,
  ): Suggestion[] {
    const out: Suggestion[] = [];
    for (const src of previous) {
      let best: { candidate: TargetCourse; score: number } | undefined;
      for (const tgt of targetCurriculum) {
        const score = this.score(src, tgt);
        if (!best || score > best.score) {
          best = { candidate: tgt, score };
        }
      }
      if (best && best.score >= threshold) {
        out.push({ source: src, candidate: best.candidate, similarityScore: best.score });
      }
    }
    return out;
  }

  private score(src: PreviousCourse, tgt: TargetCourse): number {
    const codeScore = this.codeSimilarity(src.code, tgt.code);
    const nameScore = this.nameSimilarity(src.name, tgt.name);
    const ectsScore = this.ectsCloseness(src.ects, tgt.ects);
    return codeScore * 0.4 + nameScore * 0.4 + ectsScore * 0.2;
  }

  private codeSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const prefixA = a.replace(/[0-9]/g, "");
    const prefixB = b.replace(/[0-9]/g, "");
    if (!prefixA || !prefixB) return 0;
    if (prefixA === prefixB) return 0.7;
    // Partial credit when one department prefix contains the other
    // (e.g. "CMP" vs "CMPE") — common across institutions for the same subject.
    if (prefixA.includes(prefixB) || prefixB.includes(prefixA)) return 0.6;
    return 0;
  }

  private nameSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a));
    const tokensB = new Set(this.tokenize(b));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let inter = 0;
    for (const t of tokensA) if (tokensB.has(t)) inter++;
    const union = new Set<string>([...tokensA, ...tokensB]).size;
    const jaccard = inter / union;
    // Overlap coefficient rewards containment, so an abbreviated or extended
    // title ("Data Structures" ⊆ "Data Structures and Algorithms") still matches.
    const overlap = inter / Math.min(tokensA.size, tokensB.size);
    return Math.max(jaccard, overlap);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private ectsCloseness(a: number, b: number): number {
    const diff = Math.abs(a - b);
    if (diff === 0) return 1;
    if (diff <= 1) return 0.7;
    if (diff <= 2) return 0.4;
    return 0;
  }
}
