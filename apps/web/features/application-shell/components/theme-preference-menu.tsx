"use client";

import {
	Button,
	Menu,
	MenuContent,
	MenuRadioGroup,
	MenuRadioItem,
	MenuTrigger,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
} from "@rezics/ui";
import { Laptop, Moon, Palette, Sun } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { isThemePreference, type ThemePreference } from "../hooks/use-theme-preference";

interface ThemeSelectionProps {
	preference: ThemePreference;
	onChange: (preference: ThemePreference) => void;
}

export function ThemePreferenceRadioGroup({ preference, onChange }: ThemeSelectionProps) {
	const { t } = useTranslation(["locale"]);
	return (
		<MenuRadioGroup
			heading={t.locale.displayMode}
			onValueChange={({ value }) => {
				if (isThemePreference(value)) onChange(value);
			}}
			value={preference}
		>
			<MenuRadioItem closeOnSelect={false} value="system">
				<Laptop aria-hidden />
				{t.locale.displayModes.system}
			</MenuRadioItem>
			<MenuRadioItem closeOnSelect={false} value="light">
				<Sun aria-hidden />
				{t.locale.displayModes.light}
			</MenuRadioItem>
			<MenuRadioItem closeOnSelect={false} value="dark">
				<Moon aria-hidden />
				{t.locale.displayModes.dark}
			</MenuRadioItem>
		</MenuRadioGroup>
	);
}

export function ThemePreferenceRadioList({ preference, onChange }: ThemeSelectionProps) {
	const { t } = useTranslation(["locale"]);
	return (
		<RadioGroup
			className="gap-1"
			onValueChange={({ value }) => {
				if (value && isThemePreference(value)) onChange(value);
			}}
			value={preference}
		>
			<RadioGroupLabel className="sr-only">{t.locale.displayMode}</RadioGroupLabel>
			<RadioGroupItem
				className="min-h-12 rounded-xl px-3 py-2 transition-colors hover:bg-accent data-[state=checked]:bg-accent"
				value="system"
			>
				<Laptop aria-hidden />
				{t.locale.displayModes.system}
			</RadioGroupItem>
			<RadioGroupItem
				className="min-h-12 rounded-xl px-3 py-2 transition-colors hover:bg-accent data-[state=checked]:bg-accent"
				value="light"
			>
				<Sun aria-hidden />
				{t.locale.displayModes.light}
			</RadioGroupItem>
			<RadioGroupItem
				className="min-h-12 rounded-xl px-3 py-2 transition-colors hover:bg-accent data-[state=checked]:bg-accent"
				value="dark"
			>
				<Moon aria-hidden />
				{t.locale.displayModes.dark}
			</RadioGroupItem>
		</RadioGroup>
	);
}

export function ThemePreferenceMenu({ preference, onChange }: ThemeSelectionProps) {
	const { t } = useTranslation(["locale"]);
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label={t.locale.displayMode}
					className="size-11"
					size="icon-xl"
					title={t.locale.displayMode}
				>
					<Palette aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent className="w-64">
				<ThemePreferenceRadioGroup onChange={onChange} preference={preference} />
			</MenuContent>
		</Menu>
	);
}
