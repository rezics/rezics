/**
 * Service-level integration tests for the TranslationGroup attach/detach flow.
 * Requires a live Postgres reachable via DATABASE_URL.
 *
 * Run with: RUN_DB_TESTS=1 bun test src/translation-group/translation-group.service.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { prisma, UnitStatus, UnitType } from "../../prisma/client";
import { translationGroupService } from "./translation-group.service";

const RUN = process.env.RUN_DB_TESTS === "1";
const describeWithDb = RUN ? describe : describe.skip;

const createdUnitIds = new Set<string>();
const content = (source: string) => markdownContentDoc(source);

async function makePost(opts: {
  defaultLanguage?: string;
  type?: typeof UnitType.POST | typeof UnitType.TAG;
  authorUserId: string;
}) {
  const type = opts.type ?? UnitType.POST;
  const unit = await prisma.unit.create({
    data: {
      type,
      userId: opts.authorUserId,
      slugScope: opts.authorUserId,
      defaultLanguage: opts.defaultLanguage,
      status: UnitStatus.PUBLISHED,
      ...(type === UnitType.POST
        ? {
            post: {
              create: {
                authorUserId: opts.authorUserId,
                content: content(
                  `seed content for ${opts.defaultLanguage ?? "n/a"}`,
                ) as never,
              },
            },
            ...(opts.defaultLanguage
              ? {
                  supportLanguages: {
                    create: {
                      language: opts.defaultLanguage,
                      isPrimary: true,
                    },
                  },
                }
              : {}),
          }
        : {}),
    },
    select: { id: true },
  });
  createdUnitIds.add(unit.id);
  return unit.id;
}

describeWithDb("TranslationGroupService", () => {
  let userId: string;

  beforeAll(async () => {
    // Bootstrap an author user (not full User row — Unit allows null userId)
    const idRow = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT uuidv7() as id`;
    const bootstrapId = idRow[0]!.id;
    const u = await prisma.unit.create({
      data: { id: bootstrapId, type: UnitType.POST, slugScope: bootstrapId },
      select: { id: true },
    });
    createdUnitIds.add(u.id);
    userId = u.id;
  });

  afterAll(async () => {
    for (const id of createdUnitIds) {
      await prisma.unit.delete({ where: { id } }).catch(() => {});
    }
  });

  test("first attach creates a TranslationGroup with both languages", async () => {
    const a = await makePost({ defaultLanguage: "en", authorUserId: userId });

    const { newUnitId, groupId } =
      await translationGroupService.attachTranslation(
        a,
        { language: "ja", content: content("日本語") },
        userId,
      );
    createdUnitIds.add(newUnitId);

    const group = await prisma.translationGroup.findUniqueOrThrow({
      where: { id: groupId },
    });
    expect(group.supportedLanguages.sort()).toEqual(["en", "ja"]);

    const updatedA = await prisma.unit.findUniqueOrThrow({ where: { id: a } });
    expect(updatedA.translationGroupId).toBe(groupId);
  });

  test("subsequent attach extends supportedLanguages", async () => {
    const a = await makePost({ defaultLanguage: "en", authorUserId: userId });
    const first = await translationGroupService.attachTranslation(
      a,
      { language: "ja", content: content("ja") },
      userId,
    );
    createdUnitIds.add(first.newUnitId);

    const second = await translationGroupService.attachTranslation(
      a,
      { language: "zh-hant", content: content("zh") },
      userId,
    );
    createdUnitIds.add(second.newUnitId);

    expect(second.groupId).toBe(first.groupId);
    const group = await prisma.translationGroup.findUniqueOrThrow({
      where: { id: first.groupId },
    });
    expect(group.supportedLanguages.sort()).toEqual(["en", "ja", "zh-hant"]);
  });

  test("attaching a duplicate language is rejected", async () => {
    const a = await makePost({ defaultLanguage: "en", authorUserId: userId });
    const first = await translationGroupService.attachTranslation(
      a,
      { language: "ja", content: content("ja") },
      userId,
    );
    createdUnitIds.add(first.newUnitId);

    await expect(
      translationGroupService.attachTranslation(
        a,
        { language: "ja", content: content("duplicate") },
        userId,
      ),
    ).rejects.toThrow();
  });

  test("detach removes the language from supportedLanguages", async () => {
    const a = await makePost({ defaultLanguage: "en", authorUserId: userId });
    const { newUnitId, groupId } =
      await translationGroupService.attachTranslation(
        a,
        { language: "ja", content: content("ja") },
        userId,
      );
    createdUnitIds.add(newUnitId);

    await translationGroupService.detachTranslation(newUnitId);

    const group = await prisma.translationGroup.findUnique({
      where: { id: groupId },
    });
    expect(group?.supportedLanguages).toEqual(["en"]);
    const detached = await prisma.unit.findUniqueOrThrow({
      where: { id: newUnitId },
    });
    expect(detached.translationGroupId).toBeNull();
  });

  test("detaching the last member deletes the group", async () => {
    const a = await makePost({ defaultLanguage: "en", authorUserId: userId });
    const { newUnitId, groupId } =
      await translationGroupService.attachTranslation(
        a,
        { language: "ja", content: content("ja") },
        userId,
      );
    createdUnitIds.add(newUnitId);

    await translationGroupService.detachTranslation(a);
    await translationGroupService.detachTranslation(newUnitId);

    const group = await prisma.translationGroup.findUnique({
      where: { id: groupId },
    });
    expect(group).toBeNull();
  });

  test("attaching to a non-POST unit is rejected", async () => {
    const tag = await makePost({
      defaultLanguage: "en",
      type: UnitType.TAG,
      authorUserId: userId,
    });
    await expect(
      translationGroupService.attachTranslation(
        tag,
        { language: "ja", content: content("x") },
        userId,
      ),
    ).rejects.toThrow(/POST/);
  });
});
