import { tagKeys } from "@rezics/api/tag/tag";
import { unitKeys } from "@rezics/api/unit/unit";
import { LANGUAGES, UnitType, type UnitDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { RealmExtraManageSection } from "./RealmExtraManageSection";

const meta = {
  title: "Domain/Realm/RealmExtraManageSection",
  component: RealmExtraManageSection,
} satisfies Meta;

export default meta;
type Story = StoryObj;

const REALM_ID = "realm-manage-fixture";

function makePostUnit(id: string, title: string): UnitDTO {
  return {
    id,
    type: UnitType.POST,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    defaultLanguage: LANGUAGES.EN,
    translations: [{ unitId: id, language: LANGUAGES.EN, title }],
  } as UnitDTO;
}

function Seeded({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(tagKeys.search("tag"), {
      total: 2,
      tags: [
        { unitId: "tag-a", label: "Analysis", slug: "analysis" },
        { unitId: "tag-b", label: "Question", slug: "question" },
      ],
    });
    qc.setQueryData(unitKeys.search("post", { type: "POST", limit: 8 }), {
      total: 2,
      units: [
        makePostUnit("post-rule", "Realm rule post"),
        makePostUnit("post-about", "About this realm"),
      ],
    });
  }, [qc]);

  return <div className="max-w-3xl p-4">{children}</div>;
}

export const Empty: Story = {
  render: () => (
    <Seeded>
      <RealmExtraManageSection realmId={REALM_ID} extra={{}} />
    </Seeded>
  ),
};

export const Populated: Story = {
  render: () => (
    <Seeded>
      <RealmExtraManageSection
        realmId={REALM_ID}
        extra={{
          rule: "post-rule",
          about: "post-about",
          banner: {
            kind: "url",
            url: "https://picsum.photos/seed/realm/960/320",
          },
          tagTree: [
            { disabled: true, label: "Format" },
            { tagId: "tag-a", label: "Analysis" },
            { tagId: "tag-b", label: "Question", disabled: true },
          ],
        }}
      />
    </Seeded>
  ),
};
