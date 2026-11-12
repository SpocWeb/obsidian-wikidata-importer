import { describe, expect, test } from "bun:test";
import { Entity, legacyLabel, normalizeLabel } from "./wikidata";

describe("normalizeLabel (unified path-name rule)", () => {
	const cases: Array<[string, string]> = [
		["Thema: Krise", "Thema_Krise"],
		[
			"2026-11-11 Stürzt die Welt in die nächste Finanzkrise?",
			"2026-11-11_Stürzt_die_Welt_in_die_nächste_Finanzkrise_",
		],
		["Y-Kollektiv – Der Podcast", "Y-Kollektiv_Der_Podcast"],
		[
			"Wild Wild Web - Geschichten aus dem Internet",
			"Wild_Wild_Web-Geschichten_aus_dem_Internet",
		],
		["AC/DC", "AC_DC"],
		["Teil 1 (Interview), Folge 2", "Teil_1(Interview),Folge_2"],
		["Everybody’s Free", "Everybody_s_Free"],
		["100 Sekunden Wissen", "100_Sekunden_Wissen"],
		["  Hard Fork  ", "Hard_Fork"],
		["#Tag [x] 50%", "_Tag_x_50_"],
		["a 😀 b", "a_b"],
		["a\tb\r\nc", "a_b_c"],
		["Hard_Fork-2026", "Hard_Fork-2026"],
	];

	test.each(cases)("%p -> %p", (input, expected) => {
		expect(normalizeLabel(input, "_")).toBe(expected);
	});

	test("uses the configured replacement character", () => {
		expect(normalizeLabel("Thema: Krise 2", "-")).toBe("Thema-Krise-2");
	});
});

describe("legacyLabel", () => {
	test("keeps the old regex behaviour", () => {
		expect(legacyLabel("Y-Kollektiv – Der Podcast", "_")).toBe(
			"Y_Kollektiv_Der_Podcast",
		);
		expect(legacyLabel("Thema: Krise?", "_")).toBe("Thema_Krise_");
		expect(legacyLabel("Wild Wild Web - Geschichten", "_")).toBe(
			"Wild_Wild_Web_Geschichten",
		);
	});
});

describe("entity links prefer existing old-style notes", () => {
	const options = (noteExists?: (link: string) => boolean) => ({
		language: "en",
		ignoreCategories: false,
		ignoreWikipediaPages: false,
		ignoreIDs: false,
		ignorePropertiesWithTimeRanges: false,
		// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional
		internalLinkPrefix: "db/${label}",
		spaceReplacement: "_",
		noteExists,
	});

	const bindings = [
		{
			propertyLabel: { value: "podcast" },
			value: { value: "http://www.wikidata.org/entity/Q1" },
			valueLabel: { value: "Y-Kollektiv - Der Podcast" },
		},
	];

	const link = (noteExists?: (link: string) => boolean): unknown => {
		const ret = {};
		// parseBindings is private; the test drives it with fake SPARQL bindings
		(Entity.fromId("Q42") as any).parseBindings(
			bindings,
			options(noteExists),
			ret,
		);
		return (ret as any).podcast;
	};

	test("new-style name when no lookup is given", () => {
		expect(link()).toEqual(["[[db/Y-Kollektiv-Der_Podcast]]"]);
	});

	test("new-style name when its note exists", () => {
		expect(link((l) => l === "db/Y-Kollektiv-Der_Podcast")).toEqual([
			"[[db/Y-Kollektiv-Der_Podcast]]",
		]);
	});

	test("old-style name when only that note exists", () => {
		expect(link((l) => l === "db/Y_Kollektiv_Der_Podcast")).toEqual([
			"[[db/Y_Kollektiv_Der_Podcast]]",
		]);
	});

	test("new-style name when neither note exists", () => {
		expect(link(() => false)).toEqual(["[[db/Y-Kollektiv-Der_Podcast]]"]);
	});

	test("an empty replacement leaves the label alone and never looks up", () => {
		const ret = {};
		(Entity.fromId("Q42") as any).parseBindings(
			bindings,
			{
				...options(() => {
					throw new Error("must not be called");
				}),
				spaceReplacement: "",
			},
			ret,
		);
		expect((ret as any).podcast).toEqual([
			"[[db/Y-Kollektiv - Der Podcast]]",
		]);
	});
});

describe("Entity.noteName", () => {
	// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional
	const prefix = "db/${label}";

	test("names the note like the entity links to it", () => {
		expect(Entity.noteName(prefix, "Y-Kollektiv - Der Podcast", "1", "_")).toBe(
			"db/Y-Kollektiv-Der_Podcast.md",
		);
		expect(Entity.noteName(prefix, "AC/DC", "1", "_")).toBe("db/AC_DC.md");
	});

	test("an empty replacement keeps the raw label as before", () => {
		expect(Entity.noteName(prefix, "Thema Krise", "1", "")).toBe(
			"db/Thema Krise.md",
		);
	});
});
