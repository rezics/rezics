import { type Index, MeiliSearch } from "meilisearch";
import { PROGRESS_INDEX_NAME } from "./progress";
import {
  type ExpectedMeiliIndexSchema,
  type ExpectedMeiliIndexUid,
  getExpectedMeiliIndexSchema,
  getExpectedMeiliIndexSettings,
  getExpectedMeiliIndexUids,
} from "./schema";
import { SHELF_ITEM_INDEX_NAME } from "./shelf-item";

export interface MeiliConfig {
  host: string;
  apiKey: string;
}

const MEILI_TASK_WAIT_OPTIONS = {
  timeout: 60_000,
  interval: 100,
} as const;

export class SearchClient {
  readonly meili: MeiliSearch;
  readonly contentIndex: Index;
  readonly feedbackIndex: Index;
  readonly userIndex: Index;
  readonly postIndex: Index;
  readonly commentIndex: Index;
  readonly pollIndex: Index;
  readonly shelfItemIndex: Index;
  readonly realmIndex: Index;
  readonly zoneIndex: Index;
  readonly tagIndex: Index;
  readonly labelIndex: Index;
  readonly entityIndex: Index;
  readonly progressIndex: Index;

  constructor(config: MeiliConfig) {
    this.meili = new MeiliSearch({ host: config.host, apiKey: config.apiKey });
    this.contentIndex = this.meili.index("content");
    this.feedbackIndex = this.meili.index("feedbacks");
    this.userIndex = this.meili.index("users");
    this.postIndex = this.meili.index("posts");
    this.commentIndex = this.meili.index("comments");
    this.pollIndex = this.meili.index("polls");
    this.shelfItemIndex = this.meili.index(SHELF_ITEM_INDEX_NAME);
    this.realmIndex = this.meili.index("realms");
    this.zoneIndex = this.meili.index("zones");
    this.tagIndex = this.meili.index("tags");
    this.labelIndex = this.meili.index("labels");
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

  private async waitForTasks(tasks: Array<{ taskUid?: number } | undefined>) {
    await Promise.all(
      tasks
        .map((task) => task?.taskUid)
        .filter((taskUid): taskUid is number => typeof taskUid === "number")
        .map((taskUid) =>
          this.meili.tasks.waitForTask(taskUid, MEILI_TASK_WAIT_OPTIONS),
        ),
    );
  }

  private isMissingIndexError(error: unknown): boolean {
    const typed = error as { cause?: { code?: string }; code?: string };
    return (
      typed.cause?.code === "index_not_found" ||
      typed.code === "index_not_found"
    );
  }

  private knownIndexNames(): string[] {
    return getExpectedMeiliIndexUids();
  }

  private indexForUid(uid: ExpectedMeiliIndexUid): Index {
    switch (uid) {
      case "content":
        return this.contentIndex;
      case "feedbacks":
        return this.feedbackIndex;
      case "users":
        return this.userIndex;
      case "posts":
        return this.postIndex;
      case "comments":
        return this.commentIndex;
      case "polls":
        return this.pollIndex;
      case SHELF_ITEM_INDEX_NAME:
        return this.shelfItemIndex;
      case "realms":
        return this.realmIndex;
      case "zones":
        return this.zoneIndex;
      case "tags":
        return this.tagIndex;
      case "labels":
        return this.labelIndex;
      case "entities":
        return this.entityIndex;
      case PROGRESS_INDEX_NAME:
        return this.progressIndex;
    }
  }

  private async initIndexFromSchema(
    schema: ExpectedMeiliIndexSchema,
  ): Promise<void> {
    const index = this.indexForUid(schema.uid);
    const settingsTask = await index.updateSettings(
      getExpectedMeiliIndexSettings(schema),
    );
    const primaryKeyTask = await index.addDocuments([], {
      primaryKey: schema.primaryKey,
    });
    await this.waitForTasks([settingsTask, primaryKeyTask]);
  }

  // ANCHOR: Index initialization — 索引初始化

  async initContentIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("content"));
  }

  async initFeedbackIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("feedbacks"));
  }

  async initUserIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("users"));
  }

  async initPostIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("posts"));
  }

  async initCommentIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("comments"));
  }

  async initPollIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("polls"));
  }

  async initShelfItemIndex(): Promise<void> {
    await this.initIndexFromSchema(
      getExpectedMeiliIndexSchema(SHELF_ITEM_INDEX_NAME),
    );
  }

  async initRealmIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("realms"));
  }

  async initZoneIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("zones"));
  }

  async initTagIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("tags"));
  }

  async initLabelIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("labels"));
  }

  async initEntityIndex(): Promise<void> {
    await this.initIndexFromSchema(getExpectedMeiliIndexSchema("entities"));
  }

  async initProgressIndex(): Promise<void> {
    await this.initIndexFromSchema(
      getExpectedMeiliIndexSchema(PROGRESS_INDEX_NAME),
    );
  }

  // ANCHOR: Content document operations — 内容文档操作

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

  // ANCHOR: Feedback document operations — 反馈文档操作

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

  // ANCHOR: User document operations — 用户文档操作

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

  // ANCHOR: Post document operations — 帖子文档操作

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

  // ANCHOR: Comment document operations — 评论文档操作

  addOrUpdateComments(docs: any[]) {
    return this.commentIndex.addDocuments(docs);
  }
  patchComments(docs: any[]) {
    return this.commentIndex.updateDocuments(docs);
  }
  deleteComments(ids: string[]) {
    return this.commentIndex.deleteDocuments(ids);
  }
  deleteAllComments() {
    return this.commentIndex.deleteAllDocuments();
  }

  // ANCHOR: Poll document operations — 投票文档操作

  addOrUpdatePolls(docs: any[]) {
    return this.pollIndex.addDocuments(docs);
  }
  patchPolls(docs: any[]) {
    return this.pollIndex.updateDocuments(docs);
  }
  deletePolls(ids: string[]) {
    return this.pollIndex.deleteDocuments(ids);
  }
  deleteAllPolls() {
    return this.pollIndex.deleteAllDocuments();
  }

  // ANCHOR: Shelf item document operations — 书架条目文档操作

  addOrUpdateShelfItems(docs: any[]) {
    return this.shelfItemIndex.addDocuments(docs);
  }
  patchShelfItems(docs: any[]) {
    return this.shelfItemIndex.updateDocuments(docs);
  }
  deleteShelfItems(ids: string[]) {
    return this.shelfItemIndex.deleteDocuments(ids);
  }
  deleteAllShelfItems() {
    return this.shelfItemIndex.deleteAllDocuments();
  }

  // ANCHOR: Realm document operations — realm 文档操作

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

  // ANCHOR: Zone document operations — zone 文档操作

  addOrUpdateZones(docs: any[]) {
    return this.zoneIndex.addDocuments(docs);
  }
  patchZones(docs: any[]) {
    return this.zoneIndex.updateDocuments(docs);
  }
  deleteZones(ids: string[]) {
    return this.zoneIndex.deleteDocuments(ids);
  }
  deleteAllZones() {
    return this.zoneIndex.deleteAllDocuments();
  }

  // ANCHOR: Tag document operations — tag 文档操作

  addOrUpdateTags(docs: any[]) {
    return this.tagIndex.addDocuments(docs);
  }
  patchTags(docs: any[]) {
    return this.tagIndex.updateDocuments(docs);
  }
  deleteTags(ids: string[]) {
    return this.tagIndex.deleteDocuments(ids);
  }
  deleteAllTags() {
    return this.tagIndex.deleteAllDocuments();
  }

  // ANCHOR: Label document operations — label 文档操作

  addOrUpdateLabels(docs: any[]) {
    return this.labelIndex.addDocuments(docs);
  }
  patchLabels(docs: any[]) {
    return this.labelIndex.updateDocuments(docs);
  }
  deleteLabels(ids: string[]) {
    return this.labelIndex.deleteDocuments(ids);
  }
  deleteAllLabels() {
    return this.labelIndex.deleteAllDocuments();
  }

  // ANCHOR: Entity document operations — 实体文档操作

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

  // ANCHOR: Progress document operations — 进度文档操作

  addOrUpdateProgress(docs: any[]) {
    return this.progressIndex.addDocuments(docs);
  }
  deleteProgress(id: string) {
    return this.progressIndex.deleteDocument(id);
  }
  deleteAllProgress() {
    return this.progressIndex.deleteAllDocuments();
  }

  async resetKnownIndexes() {
    const tasks = await Promise.all(
      this.knownIndexNames().map(async (uid) => {
        try {
          return await this.meili.deleteIndex(uid);
        } catch (error) {
          if (this.isMissingIndexError(error)) return undefined;
          throw error;
        }
      }),
    );
    await this.waitForTasks(tasks);
  }

  // ANCHOR: Index deletion — 索引删除

  async deleteAllIndexes() {
    const { results } = await this.meili.getIndexes();
    await Promise.allSettled(
      results.map((index) => this.meili.deleteIndex(index.uid)),
    );
  }

  // ANCHOR: Key management — 密钥管理

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
