import { CuratedCreationTagCollectionUnitIds } from "@rezics/slug";

export const CuratedCreationTagCollectionManifest = [
	{
		key: "book.form",
		id: CuratedCreationTagCollectionUnitIds.bookForm,
		localizations: [
			{
				language: "zh",
				title: "書籍形式",
				summary: "建立書籍時可選擇的主要作品形式。",
			},
			{
				language: "en",
				title: "Book Forms",
				summary: "Primary work forms available when creating a Book.",
			},
		],
	},
	{
		key: "book.category",
		id: CuratedCreationTagCollectionUnitIds.bookCategory,
		localizations: [
			{
				language: "zh",
				title: "常見書籍分類",
				summary: "建立書籍時可複選的常見分類。",
			},
			{
				language: "en",
				title: "Common Book Categories",
				summary: "Common categories available when creating a Book.",
			},
		],
	},
	{
		key: "media.form",
		id: CuratedCreationTagCollectionUnitIds.mediaForm,
		localizations: [
			{
				language: "zh",
				title: "媒體形式",
				summary: "建立媒體時可選擇的主要作品形式。",
			},
			{
				language: "en",
				title: "Media Forms",
				summary: "Primary work forms available when creating Media.",
			},
		],
	},
	{
		key: "media.category",
		id: CuratedCreationTagCollectionUnitIds.mediaCategory,
		localizations: [
			{
				language: "zh",
				title: "常見媒體分類",
				summary: "建立媒體時可複選的常見分類。",
			},
			{
				language: "en",
				title: "Common Media Categories",
				summary: "Common categories available when creating Media.",
			},
		],
	},
	{
		key: "software.form",
		id: CuratedCreationTagCollectionUnitIds.softwareForm,
		localizations: [
			{
				language: "zh",
				title: "軟體形式",
				summary: "建立軟體時可選擇的主要作品形式。",
			},
			{
				language: "en",
				title: "Software Forms",
				summary: "Primary software forms available during creation.",
			},
		],
	},
	{
		key: "software.category",
		id: CuratedCreationTagCollectionUnitIds.softwareCategory,
		localizations: [
			{
				language: "zh",
				title: "常見軟體分類",
				summary: "建立軟體時可複選的常見分類。",
			},
			{
				language: "en",
				title: "Common Software Categories",
				summary: "Common categories available when creating Software.",
			},
		],
	},
	{
		key: "realm.topic",
		id: CuratedCreationTagCollectionUnitIds.realmTopic,
		localizations: [
			{
				language: "zh",
				title: "領域主題",
				summary: "建立領域時可複選的常見主題。",
			},
			{
				language: "en",
				title: "Realm Topics",
				summary: "Common topics available when creating a Realm.",
			},
		],
	},
] as const;
