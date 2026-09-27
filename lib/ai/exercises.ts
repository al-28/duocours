import { z } from "zod";

const ExerciseSchema = z.object({
  type: z.literal("multiple_choice"),
  prompt: z.string().min(5).max(1000),
  explanation: z.string().min(5).max(2000),
  difficulty: z.number().int().min(1).max(5),
  options: z.array(z.string().min(1).max(300)).length(4),
  correct_index: z.number().int().min(0).max(3),
});

const PackSchema = z.object({ exercises: z.array(ExerciseSchema).min(3).max(6) });

export type ExercisePack = z.infer<typeof PackSchema>;

export async function generateExercisePack(input: {
  title: string;
  description: string;
  summary: string;
  objectives: string[];
  concepts: string[];
}): Promise<ExercisePack> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

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
              "You create rigorous educational exercises for Duocours. Stay strictly within the supplied lesson scope. Make distractors plausible, never ambiguous, and explain why the correct answer is correct. Return only the requested structured output.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "duocours_exercise_pack",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["exercises"],
              properties: {
                exercises: {
                  type: "array",
                  minItems: 3,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "prompt", "explanation", "difficulty", "options", "correct_index"],
                    properties: {
                      type: { type: "string", enum: ["multiple_choice"] },
                      prompt: { type: "string" },
                      explanation: { type: "string" },
                      difficulty: { type: "integer", minimum: 1, maximum: 5 },
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                      correct_index: { type: "integer", minimum: 0, maximum: 3 },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`AI request failed (${response.status}).`);
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) throw new Error("AI returned no exercises.");

    const pack = PackSchema.parse(JSON.parse(payload.output_text));
    return pack;
  } finally {
    clearTimeout(timeout);
  }
}
