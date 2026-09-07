/** Pinned VNDB Types.pm 514f2391cc12aa94ce420354863c52538641d9b1; source codes map to native meanings. */
export const VndbPlatformMap = {
	win: "windows",
	lin: "linux",
	mac: "mac_os",
	web: "web_browser",
	tdo: "3do",
	ios: "ios",
	and: "android",
	bdp: "blu_ray_player",
	dos: "dos",
	dvd: "dvd_player",
	drc: "dreamcast",
	nes: "famicom",
	sfc: "super_famicom",
	fm7: "fm_7",
	fm8: "fm_8",
	fmt: "fm_towns",
	gba: "game_boy_advance",
	gbc: "game_boy_color",
	msx: "msx",
	nds: "nintendo_ds",
	swi: "nintendo_switch",
	sw2: "nintendo_switch_2",
	wii: "nintendo_wii",
	wiu: "nintendo_wii_u",
	n3d: "nintendo_3ds",
	p88: "pc_88",
	p98: "pc_98",
	pce: "pc_engine",
	pcf: "pc_fx",
	psp: "playstation_portable",
	ps1: "playstation",
	ps2: "playstation_2",
	ps3: "playstation_3",
	ps4: "playstation_4",
	ps5: "playstation_5",
	psv: "playstation_vita",
	smd: "sega_mega_drive",
	scd: "sega_mega_cd",
	sat: "sega_saturn",
	vnd: "vnds",
	x1s: "sharp_x1",
	x68: "sharp_x68000",
	xb1: "xbox",
	xb3: "xbox_360",
	xbo: "xbox_one",
	xxs: "xbox_series",
	mob: "other_mobile",
	oth: "other",
} as const;
export const VndbMediumMap = {
	blr: "blu_ray_disc",
	mrt: "cartridge",
	cas: "cassette",
	cd: "compact_disc",
	dc: "download_card",
	dvd: "dvd",
	flp: "floppy_disk",
	gdr: "gd_rom",
	in: "internet_download",
	mem: "memory_card",
	nod: "nintendo_optical_disc",
	umd: "universal_media_disc",
	otc: "other",
} as const;

export function vndbPlatform(value: string) {
	const match = Object.entries(VndbPlatformMap).find(([key]) => key === value);
	if (!match) throw new TypeError(`VNDB platform ${value} requires vocabulary review`);
	return match[1];
}
export function vndbMedium(value: string) {
	const match = Object.entries(VndbMediumMap).find(([key]) => key === value);
	if (!match) throw new TypeError(`VNDB medium ${value} requires vocabulary review`);
	return match[1];
}
