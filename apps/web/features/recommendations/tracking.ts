"use client";

import {
	postApiRecommendationsEvents,
	type PostApiRecommendationsEventsRequestEventsSurfaceEnum,
	type PostApiRecommendationsEventsRequestEventsTypeEnum,
} from "@rezics/openapi-tanstack-query";
import { useCallback, useEffect, useRef } from "react";

export interface RecommendationTracking {
	requestId: string;
	surface: PostApiRecommendationsEventsRequestEventsSurfaceEnum;
	position: string | number;
	policyVersion: string;
	signature: string;
}

const sentEvents = new Set<string>();
const eventIds = new Map<string, string>();

interface VisibilitySubscription {
	callback: (visible: boolean) => void;
	intersecting: boolean;
}

const visibilitySubscriptions = new Map<Element, VisibilitySubscription>();
let sharedObserver: IntersectionObserver | undefined;

function notifyVisibility() {
	const documentVisible = document.visibilityState === "visible";
	for (const subscription of visibilitySubscriptions.values())
		subscription.callback(subscription.intersecting && documentVisible);
}

function observeRecommendationVisibility(element: Element, callback: (visible: boolean) => void) {
	if (!sharedObserver) {
		sharedObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const subscription = visibilitySubscriptions.get(entry.target);
					if (!subscription) continue;
					subscription.intersecting =
						entry.isIntersecting && entry.intersectionRatio >= 0.5;
					subscription.callback(
						subscription.intersecting && document.visibilityState === "visible",
					);
				}
			},
			{ threshold: [0, 0.5, 1] },
		);
		document.addEventListener("visibilitychange", notifyVisibility);
	}
	visibilitySubscriptions.set(element, { callback, intersecting: false });
	sharedObserver.observe(element);
	return () => {
		sharedObserver?.unobserve(element);
		visibilitySubscriptions.delete(element);
		if (!visibilitySubscriptions.size) {
			sharedObserver?.disconnect();
			sharedObserver = undefined;
			document.removeEventListener("visibilitychange", notifyVisibility);
		}
	};
}

export function recordRecommendationEvent(
	targetUnitId: string,
	tracking: RecommendationTracking,
	type: PostApiRecommendationsEventsRequestEventsTypeEnum,
) {
	const key = `${tracking.requestId}:${targetUnitId}:${type}`;
	if (sentEvents.has(key)) return;
	if (sentEvents.size >= 5_000) {
		sentEvents.clear();
		eventIds.clear();
	}
	const eventId = eventIds.get(key) ?? crypto.randomUUID();
	eventIds.set(key, eventId);
	sentEvents.add(key);
	void postApiRecommendationsEvents({
		body: {
			events: [
				{
					id: eventId,
					targetUnitId,
					type,
					occurredAt: new Date().toISOString(),
					requestId: tracking.requestId,
					surface: tracking.surface,
					position: Number(tracking.position),
					policyVersion: tracking.policyVersion,
					signature: tracking.signature,
				},
			],
		},
	}).catch(() => sentEvents.delete(key));
}

export function useRecommendationTracking(
	targetUnitId: string,
	tracking?: RecommendationTracking | null,
) {
	const elementRef = useRef<HTMLElement>(null);
	const requestId = tracking?.requestId;
	const surface = tracking?.surface;
	const position = tracking?.position;
	const policyVersion = tracking?.policyVersion;
	const signature = tracking?.signature;

	useEffect(() => {
		const element = elementRef.current;
		if (
			!element ||
			!requestId ||
			!surface ||
			position === undefined ||
			!policyVersion ||
			!signature ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		let impressionTimer: ReturnType<typeof setTimeout> | undefined;
		let dwellTimer: ReturnType<typeof setTimeout> | undefined;
		const eventTracking = { requestId, surface, position, policyVersion, signature };

		const cancel = () => {
			if (impressionTimer) clearTimeout(impressionTimer);
			if (dwellTimer) clearTimeout(dwellTimer);
			impressionTimer = undefined;
			dwellTimer = undefined;
		};
		const handleVisibility = (visible: boolean) => {
			cancel();
			if (!visible) return;
			impressionTimer = setTimeout(
				() => recordRecommendationEvent(targetUnitId, eventTracking, "impression"),
				1_000,
			);
			dwellTimer = setTimeout(
				() => recordRecommendationEvent(targetUnitId, eventTracking, "dwell_30s"),
				30_000,
			);
		};
		const stopObserving = observeRecommendationVisibility(element, handleVisibility);
		return () => {
			cancel();
			stopObserving();
		};
	}, [policyVersion, position, requestId, signature, surface, targetUnitId]);

	const trackOpen = useCallback(() => {
		if (!requestId || !surface || position === undefined || !policyVersion || !signature)
			return;
		recordRecommendationEvent(
			targetUnitId,
			{ requestId, surface, position, policyVersion, signature },
			"open",
		);
	}, [policyVersion, position, requestId, signature, surface, targetUnitId]);
	return { elementRef, trackOpen };
}
