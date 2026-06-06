import type { Meta, StoryObj } from "@storybook/react-vite";
import { SourceEvidencePreview } from "./SourceEvidencePreview";

const meta = {
  title: "Book/Source Evidence Preview",
  component: SourceEvidencePreview,
  parameters: {
    docs: {
      description: {
        component:
          "Evidence-backed credits open a preview; credits without evidence keep direct Entity navigation.",
      },
    },
  },
} satisfies Meta<typeof SourceEvidencePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithEvidence: Story = {
  args: {
    entityUnitId: "publisher-1",
    entitySlug: "qidian-publisher",
    entityName: "Qidian Publisher",
    roleLabel: "Publisher",
    evidence: [
      {
        id: "evidence-1",
        unitId: "book-1",
        entityId: "publisher-1",
        role: "publisher",
        sourceRefId: "ref-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
        canonicalUrl: "https://book.qidian.com/info/123",
        claimPath: "$.bookInfo.publisher",
        observedUrl: "https://book.qidian.com/info/123",
        observedAt: "2026-05-25T00:00:00.000Z",
        sourceSite: {
          entityUnitId: "source-site-1",
          key: "qidian",
          entity: {
            unitId: "source-site-1",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            slug: "qidian",
            translations: [
              {
                unitId: "source-site-1",
                language: "zh-Hant",
                title: "起點中文網",
              },
            ],
          },
        },
      },
    ],
  },
};

export const WithoutEvidence: Story = {
  args: {
    entityUnitId: "publisher-1",
    entitySlug: "qidian-publisher",
    entityName: "Qidian Publisher",
    roleLabel: "Publisher",
  },
};
