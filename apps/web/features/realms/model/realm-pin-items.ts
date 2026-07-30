/**
 * Joins ordered Realm pin memberships with their independently hydrated content.
 *
 * @internal
 */
export function joinRealmPinsWithContent<
	const TPin extends Readonly<{ unitId: string }>,
	const TContent extends Readonly<{ id: string }>,
>(
	pins: readonly TPin[],
	contentItems: readonly TContent[],
): ReadonlyArray<Readonly<{ pin: TPin; content: TContent | undefined }>> {
	const contentById = new Map(contentItems.map((content) => [content.id, content]));
	return pins.map((pin) => ({
		pin,
		content: contentById.get(pin.unitId),
	}));
}
