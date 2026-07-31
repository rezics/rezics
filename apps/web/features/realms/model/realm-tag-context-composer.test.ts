import { describe, expect, it } from "vitest";

import {
	getRealmTagContextComposerIntents,
	isRealmTagContextComposerIntent,
	RealmTagContextComposerIntents,
} from "./realm-tag-context-composer";

describe("Realm Tag Context composer", () => {
	it("keeps the mutually exclusive intents explicit and runtime-checked", () => {
		expect(RealmTagContextComposerIntents).toEqual(["create", "bind-existing"]);
		expect(isRealmTagContextComposerIntent("create")).toBe(true);
		expect(isRealmTagContextComposerIntent("bind-existing")).toBe(true);
		expect(isRealmTagContextComposerIntent("unknown")).toBe(false);
	});

	it("offers Wiki creation only to callers with Unit creation access", () => {
		expect(getRealmTagContextComposerIntents(true)).toEqual(["create", "bind-existing"]);
		expect(getRealmTagContextComposerIntents(false)).toEqual(["bind-existing"]);
	});
});
