import type {
  CommentSearchOptions,
  CommentSearchResult,
  ContentSearchOptions,
  ContentSearchResult,
  EntitySearchOptions,
  EntitySearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  LabelSearchOptions,
  LabelSearchResult,
  PollSearchOptions,
  PollSearchResult,
  PostSearchOptions,
  PostSearchResult,
  RealmSearchOptions,
  RealmSearchResult,
  TagSearchOptions,
  TagSearchResult,
  UserListQuery,
  UserSearchResult,
  ZoneSearchOptions,
  ZoneSearchResult,
} from "@rezics/contract";
import {
  syncAllComments,
  syncAllContent,
  syncAllEntities,
  syncAllFeedbacks,
  syncAllLabels,
  syncAllPolls,
  syncAllPosts,
  syncAllRealms,
  syncAllTags,
  syncAllUsers,
  syncAllZones,
  syncSingleContent,
} from "@rezics/search";
import { searchComments } from "./comment/comment.service";
import { searchContent } from "./content/content.service";
import { searchEntities } from "./entity/entity.service";
import { searchFeedbacks } from "./feedback/feedback.api";
import { searchLabels } from "./label/label.service";
import { searchPolls } from "./poll/poll.service";
import { searchPosts } from "./post/post.service";
import { searchRealms } from "./realm/realm.service";
import { searchClient } from "./search-client";
import { searchTags } from "./tag/tag.service";
import { searchUsers } from "./user/user.api";
import { searchZones } from "./zone/zone.service";

export class MeiliService {
  async searchContent(
    options: ContentSearchOptions,
  ): Promise<ContentSearchResult> {
    return searchContent(options);
  }

  async searchFeedbacks(
    options: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> {
    return searchFeedbacks(options);
  }

  async searchUsers(options: UserListQuery): Promise<UserSearchResult> {
    return searchUsers(options);
  }

  async searchPosts(options: PostSearchOptions): Promise<PostSearchResult> {
    return searchPosts(options);
  }

  async searchPolls(options: PollSearchOptions): Promise<PollSearchResult> {
    return searchPolls(options);
  }

  async searchComments(
    options: CommentSearchOptions,
  ): Promise<CommentSearchResult> {
    return searchComments(options);
  }

  async searchRealms(options: RealmSearchOptions): Promise<RealmSearchResult> {
    return searchRealms(options);
  }

  async searchZones(options: ZoneSearchOptions): Promise<ZoneSearchResult> {
    return searchZones(options);
  }

  async searchTags(options: TagSearchOptions): Promise<TagSearchResult> {
    return searchTags(options);
  }

  async searchLabels(options: LabelSearchOptions): Promise<LabelSearchResult> {
    return searchLabels(options);
  }

  async searchEntities(
    options: EntitySearchOptions,
  ): Promise<EntitySearchResult> {
    return searchEntities(options);
  }

  async initContentIndex(): Promise<void> {
    await searchClient.initContentIndex();
  }

  async initFeedbacksIndex(): Promise<void> {
    await searchClient.initFeedbackIndex();
  }

  async initUsersIndex(): Promise<void> {
    await searchClient.initUserIndex();
  }

  async initPostsIndex(): Promise<void> {
    await searchClient.initPostIndex();
  }

  async initCommentsIndex(): Promise<void> {
    await searchClient.initCommentIndex();
  }

  async initPollsIndex(): Promise<void> {
    await searchClient.initPollIndex();
  }

  async initRealmsIndex(): Promise<void> {
    await searchClient.initRealmIndex();
  }

  async initZonesIndex(): Promise<void> {
    await searchClient.initZoneIndex();
  }

  async initTagsIndex(): Promise<void> {
    await searchClient.initTagIndex();
  }

  async initLabelsIndex(): Promise<void> {
    await searchClient.initLabelIndex();
  }

  async initEntitiesIndex(): Promise<void> {
    await searchClient.initEntityIndex();
  }

  async initProgressIndex(): Promise<void> {
    await searchClient.initProgressIndex();
  }

  async syncAllContent(): Promise<unknown> {
    return syncAllContent(searchClient);
  }

  async syncSingleContent(unitId: string): Promise<void> {
    return syncSingleContent(searchClient, unitId);
  }

  async syncAllFeedbacks(): Promise<unknown> {
    return syncAllFeedbacks(searchClient);
  }

  async syncAllUsers(): Promise<unknown> {
    return syncAllUsers(searchClient);
  }

  async syncAllPosts(): Promise<unknown> {
    return syncAllPosts(searchClient);
  }

  async syncAllPolls(): Promise<unknown> {
    return syncAllPolls(searchClient);
  }

  async syncAllComments(): Promise<unknown> {
    return syncAllComments(searchClient);
  }

  async syncAllRealms(): Promise<unknown> {
    return syncAllRealms(searchClient);
  }

  async syncAllZones(): Promise<unknown> {
    return syncAllZones(searchClient);
  }

  async syncAllTags(): Promise<unknown> {
    return syncAllTags(searchClient);
  }

  async syncAllLabels(): Promise<unknown> {
    return syncAllLabels(searchClient);
  }

  async syncAllEntities(): Promise<unknown> {
    return syncAllEntities(searchClient);
  }

  async deleteAllFeedbacks() {
    return searchClient.deleteAllFeedbacks();
  }

  async deleteAllUsers() {
    return searchClient.deleteAllUsers();
  }

  async deleteAllPosts() {
    return searchClient.deleteAllPosts();
  }

  async deleteAllPolls() {
    return searchClient.deleteAllPolls();
  }

  async deleteAllRealms() {
    return searchClient.deleteAllRealms();
  }

  async deleteAllZones() {
    return searchClient.deleteAllZones();
  }

  async deleteAllTags() {
    return searchClient.deleteAllTags();
  }

  async deleteAllLabels() {
    return searchClient.deleteAllLabels();
  }

  async deleteAllEntities() {
    return searchClient.deleteAllEntities();
  }

  async deleteAllIndexes() {
    return searchClient.deleteAllIndexes();
  }

  async createAdminKey() {
    return searchClient.getAdminKey();
  }

  async listKeys() {
    return searchClient.listKeys();
  }

  async deleteKey(keyUid: string) {
    return searchClient.deleteKey(keyUid);
  }
}

export const meiliService = new MeiliService();
