import { type Index, MeiliSearch } from "meilisearch";

export interface MeiliConfig {
  host: string;
  apiKey: string;
}

export class SearchClient {
  readonly meili: MeiliSearch;
  readonly contentIndex: Index;
  readonly feedbackIndex: Index;
  readonly userIndex: Index;

  constructor(config: MeiliConfig) {
    this.meili = new MeiliSearch({ host: config.host, apiKey: config.apiKey });
    this.contentIndex = this.meili.index("content");
    this.feedbackIndex = this.meili.index("feedbacks");
    this.userIndex = this.meili.index("users");
  }

  async checkHealth(): Promise<boolean> {
    try {
      const health = await this.meili.health();
      return health.status === "available";
    } catch {
      return false;
    }
  }

  // ANCHOR: Index initialization

  async initContentIndex(): Promise<void> {
    await this.contentIndex.updateSettings({
      searchableAttributes: [
        "titles",
        "subtitles",
        "descriptions",
        "summaries",
        "creditNames",
        "tagLabels",
      ],
      filterableAttributes: [
        "type",
        "tagIds",
        "realmIds",
        "realmTagKeys",
        "languages",
        "nsfw",
        "visibility",
        "isLicensed",
      ],
      sortableAttributes: ["createdAt", "updatedAt", "publishedAt"],
    });
    this.contentIndex.addDocuments([], { primaryKey: "id" });
  }

  async initFeedbackIndex(): Promise<void> {
    await this.feedbackIndex.updateSettings({
      searchableAttributes: ["id", "content", "url"],
      filterableAttributes: [
        "userId",
        "unitId",
        "type",
        "resolved",
        "createdAt",
        "updatedAt",
      ],
      sortableAttributes: ["createdAt", "updatedAt"],
    });
    this.feedbackIndex.addDocuments([], { primaryKey: "id" });
  }

  async initUserIndex(): Promise<void> {
    await this.userIndex.updateSettings({
      searchableAttributes: ["name", "slug", "email", "bio", "description"],
      filterableAttributes: ["slug", "email", "joinDate"],
      sortableAttributes: ["joinDate", "followersCount", "followingsCount"],
    });
    this.userIndex.addDocuments([], { primaryKey: "id" });
  }

  // ANCHOR: Content document operations

  addOrUpdateContent(docs: any[]) {
    return this.contentIndex.addDocuments(docs);
  }
  deleteContent(ids: string[]) {
    return this.contentIndex.deleteDocuments(ids);
  }
  deleteAllContent() {
    return this.contentIndex.deleteAllDocuments();
  }

  // ANCHOR: Feedback document operations

  addOrUpdateFeedbacks(feedbacks: any[]) {
    return this.feedbackIndex.addDocuments(feedbacks);
  }
  deleteFeedbacks(ids: string[]) {
    return this.feedbackIndex.deleteDocuments(ids);
  }
  deleteAllFeedbacks() {
    return this.feedbackIndex.deleteAllDocuments();
  }

  // ANCHOR: User document operations

  addOrUpdateUsers(users: any[]) {
    return this.userIndex.addDocuments(users);
  }
  deleteUsers(ids: string[]) {
    return this.userIndex.deleteDocuments(ids);
  }
  deleteAllUsers() {
    return this.userIndex.deleteAllDocuments();
  }

  // ANCHOR: Index deletion

  async deleteAllIndexes() {
    const { results } = await this.meili.getIndexes();
    await Promise.allSettled(
      results.map((index) => this.meili.deleteIndex(index.uid)),
    );
  }

  // ANCHOR: Key management

  async getAdminKey() {
    return this.meili.createKey({
      actions: ["*"],
      indexes: ["*"],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });
  }

  async listKeys() {
    return this.meili.getKeys();
  }

  async deleteKey(keyUid: string) {
    return this.meili.deleteKey(keyUid);
  }
}
