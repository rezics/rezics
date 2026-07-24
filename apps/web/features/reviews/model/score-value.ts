export const UnitScoreValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type UnitScore = (typeof UnitScoreValues)[number];

export function starValueToUnitScore(starValue: number): UnitScore | undefined {
	const score = starValue * 2;
	return UnitScoreValues.find((candidate) => candidate === score);
}
