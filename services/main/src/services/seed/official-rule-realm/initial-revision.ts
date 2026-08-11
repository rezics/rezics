import { createPortableTextDocument } from "@rezics/block";

import type { PublishRealmRuleRevisionInput } from "../../realms/rule-publication";

type InitialRuleRevisionContent = Pick<
	PublishRealmRuleRevisionInput,
	"acknowledgementMode" | "requireOnJoin" | "requireOnPost" | "rules"
>;

function ruleContent(
	text: string,
	keys: readonly [documentKey: string, blockKey: string, spanKey: string],
) {
	const [documentKey, blockKey, spanKey] = keys;
	return createPortableTextDocument(
		[
			{
				_type: "block",
				_key: blockKey,
				style: "normal",
				markDefs: [],
				children: [{ _type: "span", _key: spanKey, text, marks: [] }],
			},
		],
		documentKey,
	);
}

/** Starter content for a Rule Realm with no online publication history. */
export const OfficialRuleInitialRevision = {
	acknowledgementMode: "explicit",
	requireOnJoin: false,
	requireOnPost: false,
	rules: [
		{
			localizations: [
				{
					language: "zh",
					title: "垃圾內容與操縱行為",
					content: ruleContent(
						"請檢舉大量重複、誤導、未經請求的宣傳，或企圖操縱互動與排序的內容。",
						["b00759010001", "b00759010002", "b00759010003"],
					),
				},
				{
					language: "en",
					title: "Spam and manipulation",
					content: ruleContent(
						"Report repetitive, deceptive, unsolicited promotional content or attempts to manipulate engagement and ranking.",
						["b00759010004", "b00759010005", "b00759010006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "騷擾與仇恨行為",
					content: ruleContent("請檢舉針對個人或群體的威脅、持續騷擾、羞辱或仇恨內容。", [
						"b00759020001",
						"b00759020002",
						"b00759020003",
					]),
				},
				{
					language: "en",
					title: "Harassment and hateful conduct",
					content: ruleContent(
						"Report threats, sustained harassment, humiliation, or hateful content targeting a person or group.",
						["b00759020004", "b00759020005", "b00759020006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "危險或違法內容",
					content: ruleContent("請檢舉鼓勵嚴重傷害、剝削、違法交易，或可能立即危及他人的內容。", [
						"b00759030001",
						"b00759030002",
						"b00759030003",
					]),
				},
				{
					language: "en",
					title: "Dangerous or unlawful content",
					content: ruleContent(
						"Report content that encourages serious harm, exploitation, unlawful trade, or an immediate danger to others.",
						["b00759030004", "b00759030005", "b00759030006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "其他平台規則違規",
					content: ruleContent("若內容違反其他全域規則，請選擇此項並在補充說明中指出具體問題。", [
						"b00759040001",
						"b00759040002",
						"b00759040003",
					]),
				},
				{
					language: "en",
					title: "Other platform-rule violation",
					content: ruleContent(
						"Choose this rule for another platform-wide violation and identify the specific issue in the additional details.",
						["b00759040004", "b00759040005", "b00759040006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "智慧財產權侵害",
					content: ruleContent(
						"請檢舉疑似在未獲授權或欠缺其他合法依據的情況下，重製、散布或使用受著作權、商標或其他智慧財產權保護的內容。請在補充說明中列出原作或權利來源，以及疑似侵權的理由。",
						["b00759050001", "b00759050002", "b00759050003"],
					),
				},
				{
					language: "en",
					title: "Intellectual property infringement",
					content: ruleContent(
						"Report content that may reproduce, distribute, or use copyright-, trademark-, or other intellectual-property-protected material without authorization or another lawful basis. In the additional details, identify the original work or rights source and explain the suspected infringement.",
						["b00759050004", "b00759050005", "b00759050006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "不當認領或持有條目",
					content: ruleContent(
						"請檢舉由無權代表其所指人物、組織、品牌或作品的使用者認領或持有的條目，例如冒用身分、權利人或官方名義。請在補充說明中指出正確的代表或權利關係，並提供可供核實的公開來源。",
						["b00759060001", "b00759060002", "b00759060003"],
					),
				},
				{
					language: "en",
					title: "Improper entry claim or ownership",
					content: ruleContent(
						"Report an entry claimed or held by a user who is not entitled to represent the person, organization, brand, or work it describes, including impersonation of an identity, rightsholder, or official capacity. In the additional details, identify the proper representative or rights relationship and provide publicly verifiable sources.",
						["b00759060004", "b00759060005", "b00759060006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "條目生命週期與核實移除",
					content: ruleContent(
						"當條目已無合法保留目的、危及平台完整性，或經核實必須停止一般存取時，可進行軟刪除。操作必須保留歷史，且還原必須明確撤銷原決定。",
						["b00759070001", "b00759070002", "b00759070003"],
					),
				},
				{
					language: "en",
					title: "Entry lifecycle and verified removal",
					content: ruleContent(
						"A Unit may be soft-deleted when it has no legitimate retention purpose, threatens platform integrity, or has been verified as requiring removal from ordinary access. History must remain, and restoration must explicitly reverse the original decision.",
						["b00759070004", "b00759070005", "b00759070006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "條目身分與合併完整性",
					content: ruleContent(
						"只有在兩個條目代表同一不可變身分，且合併計畫不會錯接內容、關係或歷史時，才可合併。來源條目必須保留可追溯的重新導向。",
						["b00759080001", "b00759080002", "b00759080003"],
					),
				},
				{
					language: "en",
					title: "Unit identity and merge integrity",
					content: ruleContent(
						"Merge Units only when they represent the same immutable identity and the merge plan will not misattribute content, relationships, or history. The source must retain a traceable redirect.",
						["b00759080004", "b00759080005", "b00759080006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "存取與帳戶安全",
					content: ruleContent(
						"為防止未經授權的存取、濫用、規避處置或可信的安全風險，可對帳戶或條目權限施加範圍明確且可稽核的限制。",
						["b00759090001", "b00759090002", "b00759090003"],
					),
				},
				{
					language: "en",
					title: "Access and account security",
					content: ruleContent(
						"Apply scoped, auditable account or Unit-access restrictions to prevent unauthorized access, abuse, enforcement evasion, or a credible security risk.",
						["b00759090004", "b00759090005", "b00759090006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "版本、隱私與法律限制",
					content: ruleContent(
						"版本包含依法或依隱私、安全要求不得一般公開的內容時，可隱藏必要欄位或抑制整個版本；限制範圍不得超過已核實的需要。",
						["b00759100001", "b00759100002", "b00759100003"],
					),
				},
				{
					language: "en",
					title: "Revision, privacy, and legal restriction",
					content: ruleContent(
						"Hide necessary fields or suppress a revision when it contains material that cannot remain ordinarily public for verified legal, privacy, or safety reasons. Restrict no more than the verified need.",
						["b00759100004", "b00759100005", "b00759100006"],
					),
				},
			],
		},
		{
			localizations: [
				{
					language: "zh",
					title: "網址與命名空間完整性",
					content: ruleContent(
						"平台可為避免冒用、衝突、誤導或失效重新導向而指派、移動或釋放網址；所有變更都必須維持可追溯性與最小影響。",
						["b00759110001", "b00759110002", "b00759110003"],
					),
				},
				{
					language: "en",
					title: "Address and namespace integrity",
					content: ruleContent(
						"The platform may assign, move, or release addresses to prevent impersonation, conflicts, deception, or stale redirects. Every change must remain traceable and minimize impact.",
						["b00759110004", "b00759110005", "b00759110006"],
					),
				},
			],
		},
	],
} as const satisfies InitialRuleRevisionContent;
