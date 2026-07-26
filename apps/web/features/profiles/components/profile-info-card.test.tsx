/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProfileInfoCard } from "./profile-info-card";

afterEach(cleanup);

describe("ProfileInfoCard", () => {
	it("presents the public profile path instead of an at-sign handle", () => {
		render(
			<ProfileInfoCard
				profile={{
					id: "profile-id",
					initials: "E",
					name: "Edge Coordinates",
					slug: "edge",
				}}
			/>,
		);

		expect(screen.getByText("u/edge")).toBeTruthy();
		expect(screen.queryByText("@edge")).toBeNull();
	});
});
