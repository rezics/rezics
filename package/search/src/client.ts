import { type Index, MeiliSearch } from "meilisearch";

export interface MeiliConfig {
  host: string;
  apiKey: string;
}

export class SearchClient {
  readonly meili: MeiliSearch;
  readonly bookIndex: Index;
  readonly unitIndex: Index;
  readonly readlistIndex: Index;
  readonly feedbackIndex: Index;
  readonly userIndex: Index;

  constructor(config: MeiliConfig) {
    this.meili = new MeiliSearch({ host: config.host, apiKey: config.apiKey });
    this.bookIndex = this.meili.index("books");
    this.unitIndex = this.meili.index("units");
    this.readlistIndex = this.meili.index("readlists");
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

  async initBookIndex(): Promise<void> {
    await this.bookIndex.updateSettings({
      searchableAttributes: [
        "id",
        "title",
        "description",
        "tagSearch",
        "authors",
        "presses",
        "isbn",
        "producers",
        "extra",
      ],
      filterableAttributes: [
        "isLicensed",
        "nsfw",
        "tagSearch",
        "authorIds",
        "pressIds",
        "producerIds",
        "textLength",
      ],
      sortableAttributes: ["createdAt", "updatedAt"],
    });
    this.bookIndex.addDocuments([], { primaryKey: "id" });
  }

  async initUnitIndex(): Promise<void> {
    await this.unitIndex.updateSettings({
      searchableAttributes: ["id", "title", "content", "tags"],
      filterableAttributes: [
        "targetUnitId",
        "type",
        "status",
        "userId",
        "domainIds",
        "nsfw",
        "tags",
      ],
      sortableAttributes: ["createdAt", "updatedAt"],
    });
    this.unitIndex.addDocuments([], { primaryKey: "id" });
  }

  async initReadlistIndex(): Promise<void> {
    await this.readlistIndex.updateSettings({
      searchableAttributes: ["id", "title", "content", "tags"],
      filterableAttributes: [
        "targetUnitId",
        "bookIds",
        "reviewIds",
        "type",
        "status",
        "userId",
        "domainIds",
        "nsfw",
        "tags",
      ],
      sortableAttributes: ["createdAt", "updatedAt"],
    });
    this.readlistIndex.addDocuments([], { primaryKey: "id" });
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
      filterableAttributes: ["slug", "email", "type", "joinDate"],
      sortableAttributes: ["joinDate", "followersCount", "followingsCount"],
    });
    this.userIndex.addDocuments([], { primaryKey: "id" });
  }

  // ANCHOR: Document operations

  addOrUpdateBooks(books: any[]) {
    return this.bookIndex.addDocuments(books);
  }
  deleteBooks(ids: string[]) {
    return this.bookIndex.deleteDocuments(ids);
  }
  deleteAllBooks() {
    return this.bookIndex.deleteAllDocuments();
  }

  addOrUpdateUnits(units: any[]) {
    return this.unitIndex.addDocuments(units);
  }
  deleteUnits(ids: string[]) {
    return this.unitIndex.deleteDocuments(ids);
  }
  deleteAllUnits() {
    return this.unitIndex.deleteAllDocuments();
  }

  addOrUpdateReadlists(readlists: any[]) {
    return this.readlistIndex.addDocuments(readlists);
  }
  deleteReadlists(ids: string[]) {
    return this.readlistIndex.deleteDocuments(ids);
  }
  deleteAllReadlists() {
    return this.readlistIndex.deleteAllDocuments();
  }

  addOrUpdateFeedbacks(feedbacks: any[]) {
    return this.feedbackIndex.addDocuments(feedbacks);
  }
  deleteFeedbacks(ids: string[]) {
    return this.feedbackIndex.deleteDocuments(ids);
  }
  deleteAllFeedbacks() {
    return this.feedbackIndex.deleteAllDocuments();
  }

  addOrUpdateUsers(users: any[]) {
    return this.userIndex.addDocuments(users);
  }
  deleteUsers(ids: string[]) {
    return this.userIndex.deleteDocuments(ids);
  }
  deleteAllUsers() {
    return this.userIndex.deleteAllDocuments();
  }

  // ANCHOR: Key management

  async getSearchKey(): Promise<string> {
    const resp = await this.meili.createKey({
      actions: ["search"],
      indexes: ["books", "units", "readlists"],
      expiresAt: null,
    });
    return resp.key;
  }

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
