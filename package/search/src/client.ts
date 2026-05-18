import { type Index, MeiliSearch } from "meilisearch";
import { PROGRESS_INDEX_NAME } from "./progress";

export interface MeiliConfig {
  host: string;
  apiKey: string;
}

export class SearchClient {
  readonly meili: MeiliSearch;
  readonly contentIndex: Index;
  readonly feedbackIndex: Index;
  readonly userIndex: Index;
  readonly postIndex: Index;
  readonly realmIndex: Index;
  readonly entityIndex: Index;
  readonly progressIndex: Index;

  constructor(config: MeiliConfig) {
    this.meili = new MeiliSearch({ host: config.host, apiKey: config.apiKey });
    this.contentIndex = this.meili.index("content");
    this.feedbackIndex = this.meili.index("feedbacks");
    this.userIndex = this.meili.index("users");
    this.postIndex = this.meili.index("posts");
    this.realmIndex = this.meili.index("realms");
    this.entityIndex = this.meili.index("entities");
    this.progressIndex = this.meili.index(PROGRESS_INDEX_NAME);
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
        "subjectNames",
        "tagLabels",
      ],
      filterableAttributes: [
        "type",
        "postKind",
        "tagIds",
        "realmIds",
        "realmTagKeys",
        "languages",
        "rating",
        "visibility",
        "isLicensed",
        "textLength",
        "userId",
        "containedUnitIds",
        "subjectEntityIds",
        "subjectKinds",
        "subjectRoles",
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

  async initPostIndex(): Promise<void> {
    await this.postIndex.updateSettings({
      searchableAttributes: ["body", "targetTitles", "authorName"],
      filterableAttributes: [
        "kind",
        "targetUnitId",
        "realmIds",
        "authorUserId",
        "depth",
        "isLocked",
        "rootPostUnitId",
        "parentPostUnitId",
        "rootTargetUnitId",
        "rootTargetUnitType",
      ],
      sortableAttributes: ["createdAt", "updatedAt", "replyCount"],
    });
    this.postIndex.addDocuments([], { primaryKey: "id" });
  }

  async initRealmIndex(): Promise<void> {
    await this.realmIndex.updateSettings({
      searchableAttributes: ["titles", "descriptions"],
      filterableAttributes: ["isPublic", "isOfficial"],
      sortableAttributes: ["memberCount", "createdAt", "updatedAt"],
    });
    this.realmIndex.addDocuments([], { primaryKey: "id" });
  }

  async initEntityIndex(): Promise<void> {
    await this.entityIndex.updateSettings({
      searchableAttributes: ["titles", "summaries", "slug"],
      filterableAttributes: ["kind", "verified", "ownerUnitId"],
      sortableAttributes: ["createdAt", "updatedAt"],
    });
    this.entityIndex.addDocuments([], { primaryKey: "id" });
  }

  async initProgressIndex(): Promise<void> {
    await this.progressIndex.updateSettings({
      searchableAttributes: [],
      filterableAttributes: ["unitId", "userId", "status", "progressBucket"],
      sortableAttributes: ["lastSeenAt"],
    });
    await this.progressIndex.addDocuments([], { primaryKey: "id" });
  }

  // ANCHOR: Content document operations

  addOrUpdateContent(docs: any[]) {
    return this.contentIndex.addDocuments(docs);
  }
  patchContent(docs: any[]) {
    return this.contentIndex.updateDocuments(docs);
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
  patchFeedbacks(docs: any[]) {
    return this.feedbackIndex.updateDocuments(docs);
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
  patchUsers(docs: any[]) {
    return this.userIndex.updateDocuments(docs);
  }
  deleteUsers(ids: string[]) {
    return this.userIndex.deleteDocuments(ids);
  }
  deleteAllUsers() {
    return this.userIndex.deleteAllDocuments();
  }

  // ANCHOR: Post document operations

  addOrUpdatePosts(docs: any[]) {
    return this.postIndex.addDocuments(docs);
  }
  patchPosts(docs: any[]) {
    return this.postIndex.updateDocuments(docs);
  }
  deletePosts(ids: string[]) {
    return this.postIndex.deleteDocuments(ids);
  }
  deleteAllPosts() {
    return this.postIndex.deleteAllDocuments();
  }

  // ANCHOR: Realm document operations

  addOrUpdateRealms(docs: any[]) {
    return this.realmIndex.addDocuments(docs);
  }
  patchRealms(docs: any[]) {
    return this.realmIndex.updateDocuments(docs);
  }
  deleteRealms(ids: string[]) {
    return this.realmIndex.deleteDocuments(ids);
  }
  deleteAllRealms() {
    return this.realmIndex.deleteAllDocuments();
  }

  // ANCHOR: Entity document operations

  addOrUpdateEntities(docs: any[]) {
    return this.entityIndex.addDocuments(docs);
  }
  patchEntities(docs: any[]) {
    return this.entityIndex.updateDocuments(docs);
  }
  deleteEntities(ids: string[]) {
    return this.entityIndex.deleteDocuments(ids);
  }
  deleteAllEntities() {
    return this.entityIndex.deleteAllDocuments();
  }

  // ANCHOR: Progress document operations

  addOrUpdateProgress(docs: any[]) {
    return this.progressIndex.addDocuments(docs);
  }
  deleteProgress(id: string) {
    return this.progressIndex.deleteDocument(id);
  }
  deleteAllProgress() {
    return this.progressIndex.deleteAllDocuments();
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
