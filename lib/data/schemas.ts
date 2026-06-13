import { z } from "zod";

/** fixturedownload feed row — tolerant: extra fields pass through. */
export const fixtureRowSchema = z
  .object({
    MatchNumber: z.number().int(),
    RoundNumber: z.number().int(),
    DateUtc: z.string(),
    Location: z.string(),
    HomeTeam: z.string(),
    AwayTeam: z.string(),
    Group: z.string().nullable(),
    HomeTeamScore: z.number().int().nullable(),
    AwayTeamScore: z.number().int().nullable(),
    Winner: z.string().nullable().optional(),
  })
  .passthrough();

export type FixtureRow = z.infer<typeof fixtureRowSchema>;

export const fixtureFeedSchema = z.array(fixtureRowSchema).min(100);

const groupLetterSchema = z.enum([
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
]);

export const slotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team"), team: z.string() }),
  z.object({
    kind: z.literal("group-rank"),
    group: groupLetterSchema,
    rank: z.union([z.literal(1), z.literal(2)]),
  }),
  z.object({
    kind: z.literal("third-pool"),
    groups: z.array(groupLetterSchema).min(2),
  }),
  z.object({ kind: z.literal("match-winner"), matchNumber: z.number().int() }),
  z.object({ kind: z.literal("match-loser"), matchNumber: z.number().int() }),
]);

export const matchSchema = z.object({
  matchNumber: z.number().int().min(1).max(104),
  stage: z.enum(["group", "r32", "r16", "qf", "sf", "third-place", "final"]),
  group: groupLetterSchema.nullable(),
  dateUtc: z.string(),
  venue: z.string(),
  hostCountry: z.enum(["United States", "Mexico", "Canada"]),
  home: slotSchema,
  away: slotSchema,
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  winner: z.string().nullable(),
});

export const fixturesSeedSchema = z.object({
  capturedAt: z.string(),
  matches: z.array(matchSchema).length(104),
});

export const ratingsSeedSchema = z.object({
  generatedThrough: z.string(),
  homeAdvantage: z.number(),
  ratings: z.record(z.string(), z.number()),
  matchCounts: z.record(z.string(), z.number()),
});

export const fifaRankingsSeedSchema = z.object({
  asOf: z.string(),
  dateId: z.string(),
  points: z.record(z.string(), z.number()),
});

export const squadValuesSeedSchema = z.object({
  asOf: z.string(),
  source: z.string(),
  valuesEur: z.record(z.string(), z.number()),
});

export const snapshotSchema = z.object({
  date: z.string(),
  generatedAt: z.string(),
  seed: z.number(),
  simCount: z.number(),
  playedMatches: z.number(),
  odds: z.record(
    z.string(),
    z.object({
      r32: z.number(),
      r16: z.number(),
      qf: z.number(),
      sf: z.number(),
      final: z.number(),
      winner: z.number(),
    })
  ),
});

/** ESPN scoreboard — only the fields the fallback needs. */
export const espnScoreboardSchema = z
  .object({
    events: z.array(
      z
        .object({
          date: z.string(),
          status: z
            .object({
              type: z.object({ completed: z.boolean() }).passthrough(),
            })
            .passthrough(),
          competitions: z.array(
            z
              .object({
                competitors: z.array(
                  z
                    .object({
                      homeAway: z.enum(["home", "away"]),
                      score: z.string().optional(),
                      team: z
                        .object({ displayName: z.string() })
                        .passthrough(),
                    })
                    .passthrough()
                ),
              })
              .passthrough()
          ),
        })
        .passthrough()
    ),
  })
  .passthrough();
