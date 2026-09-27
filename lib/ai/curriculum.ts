import { z } from "zod";

const ConceptSchema = z.string().trim().min(2).max(160);

const LessonSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000),
  summary: z.string().trim().max(2000),
  objectives: z.array(z.string().trim().min(2).max(300)).min(1).max(6),
  concepts: z.array(ConceptSchema).min(1).max(8),
  estimated_minutes: z.number().int().min(5).max(120),
});

const LevelSchema = z.object({
  title: z.string().trim().min(2).max(160),
  lessons: z.array(LessonSchema).min(2).max(8),
});

export const CurriculumSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  subject: z.string().trim().min(2).max(160),
  levels: z.array(LevelSchema).min(2).max(10),
});

export type Curriculum = z.infer<typeof CurriculumSchema>;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "subject", "levels"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    subject: { type: "string" },
    levels: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "lessons"],
        properties: {
          title: { type: "string" },
          lessons: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "description",
                "summary",
                "objectives",
                "concepts",
                "estimated_minutes",
              ],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                summary: { type: "string" },
                objectives: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
                concepts: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
                estimated_minutes: { type: "integer", minimum: 5, maximum: 120 },
              },
            },
          },
        },
      },
    },
  },
} as const;

function cleanSubject(input: string) {
  return input.trim().replace(/\\s+/g, " ").slice(0, 500);
}

function validateCurriculum(curriculum: Curriculum) {
  const lessonCount = curriculum.levels.reduce((sum, level) => sum + level.lessons.length, 0);
  const conceptNames = curriculum.levels.flatMap((level) =>
    level.lessons.flatMap((lesson) => lesson.concepts.map((name) => name.toLowerCase())),
  );

  if (lessonCount < 4 || lessonCount > 60) throw new Error("Curriculum lesson count is invalid.");
  if (new Set(conceptNames).size < 3) throw new Error("Curriculum needs more distinct concepts.");
  if (curriculum.levels.some((level) => level.lessons.length < 2)) {
    throw new Error("Every level needs at least two lessons.");
  }
}

export async function generateCurriculum(goal: string): Promise<Curriculum> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const subject = cleanSubject(goal);
  if (subject.length < 3) throw new Error("Learning goal is too short.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        store: false,
        input: [
          {
            role: "system",
            content:
              "You are Duocours curriculum architect. Build a coherent beginner-to-advanced learning path from a learner's goal. Do not invent a fake certification or promise mastery. Order prerequisites before dependent concepts. Lessons must be teachable in short sessions. Return only the requested structured output.",
          },
          {
            role: "user",
            content: `Create a curriculum for this learning goal: "${subject}". The learner may express a topic, school subject, professional skill, language, or broad domain. Interpret the intent, choose a sensible scope, and produce levels and lessons with concrete objectives and concepts.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "duocours_curriculum",
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) throw new Error("AI returned no curriculum.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.output_text);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const curriculum = CurriculumSchema.parse(parsed);
    validateCurriculum(curriculum);
    return curriculum;
  } finally {
    clearTimeout(timeout);
  }
}
