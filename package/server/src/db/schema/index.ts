import type { relations } from "../relations";
import * as schema from "./schema";

export { schema };
export type ServerSchema = typeof schema;
export type ServerRelations = typeof relations;

export type AccountEnforcementRow =
  typeof schema.AccountEnforcement.$inferSelect;
export type NewAccountEnforcementRow =
  typeof schema.AccountEnforcement.$inferInsert;
export type ApiTokenRow = typeof schema.ApiToken.$inferSelect;
export type NewApiTokenRow = typeof schema.ApiToken.$inferInsert;
export type BookRow = typeof schema.Book.$inferSelect;
export type NewBookRow = typeof schema.Book.$inferInsert;
export type CommentRow = typeof schema.Comment.$inferSelect;
export type NewCommentRow = typeof schema.Comment.$inferInsert;
export type CommentPromotionRow = typeof schema.CommentPromotion.$inferSelect;
export type NewCommentPromotionRow =
  typeof schema.CommentPromotion.$inferInsert;
export type ContentStructureRow = typeof schema.ContentStructure.$inferSelect;
export type NewContentStructureRow =
  typeof schema.ContentStructure.$inferInsert;
export type ContentStructureAnchorRow =
  typeof schema.ContentStructureAnchor.$inferSelect;
export type NewContentStructureAnchorRow =
  typeof schema.ContentStructureAnchor.$inferInsert;
export type ContentStructureNodeRow =
  typeof schema.ContentStructureNode.$inferSelect;
export type NewContentStructureNodeRow =
  typeof schema.ContentStructureNode.$inferInsert;
export type ContentTranslationRow =
  typeof schema.ContentTranslation.$inferSelect;
export type NewContentTranslationRow =
  typeof schema.ContentTranslation.$inferInsert;
export type CreditAttributionRow = typeof schema.CreditAttribution.$inferSelect;
export type NewCreditAttributionRow =
  typeof schema.CreditAttribution.$inferInsert;
export type CreditAttributionEvidenceRow =
  typeof schema.CreditAttributionEvidence.$inferSelect;
export type NewCreditAttributionEvidenceRow =
  typeof schema.CreditAttributionEvidence.$inferInsert;
export type EchoKVRow = typeof schema.EchoKV.$inferSelect;
export type NewEchoKVRow = typeof schema.EchoKV.$inferInsert;
export type EmailVerificationContractRow =
  typeof schema.EmailVerificationContract.$inferSelect;
export type NewEmailVerificationContractRow =
  typeof schema.EmailVerificationContract.$inferInsert;
export type EntityRow = typeof schema.Entity.$inferSelect;
export type NewEntityRow = typeof schema.Entity.$inferInsert;
export type FeedbackRow = typeof schema.Feedback.$inferSelect;
export type NewFeedbackRow = typeof schema.Feedback.$inferInsert;
export type GameRow = typeof schema.Game.$inferSelect;
export type NewGameRow = typeof schema.Game.$inferInsert;
export type GameSystemRequirementRow =
  typeof schema.GameSystemRequirement.$inferSelect;
export type NewGameSystemRequirementRow =
  typeof schema.GameSystemRequirement.$inferInsert;
export type HistoryOutboxRow = typeof schema.HistoryOutbox.$inferSelect;
export type NewHistoryOutboxRow = typeof schema.HistoryOutbox.$inferInsert;
export type JwksRow = typeof schema.Jwks.$inferSelect;
export type NewJwksRow = typeof schema.Jwks.$inferInsert;
export type JwtServiceRow = typeof schema.JwtService.$inferSelect;
export type NewJwtServiceRow = typeof schema.JwtService.$inferInsert;
export type LinkRow = typeof schema.Link.$inferSelect;
export type NewLinkRow = typeof schema.Link.$inferInsert;
export type MediaRow = typeof schema.Media.$inferSelect;
export type NewMediaRow = typeof schema.Media.$inferInsert;
export type ModerationActionRow = typeof schema.ModerationAction.$inferSelect;
export type NewModerationActionRow =
  typeof schema.ModerationAction.$inferInsert;
export type ModerationCaseRow = typeof schema.ModerationCase.$inferSelect;
export type NewModerationCaseRow = typeof schema.ModerationCase.$inferInsert;
export type PollRow = typeof schema.Poll.$inferSelect;
export type NewPollRow = typeof schema.Poll.$inferInsert;
export type PollOptionRow = typeof schema.PollOption.$inferSelect;
export type NewPollOptionRow = typeof schema.PollOption.$inferInsert;
export type PollVoteRow = typeof schema.PollVote.$inferSelect;
export type NewPollVoteRow = typeof schema.PollVote.$inferInsert;
export type PostRow = typeof schema.Post.$inferSelect;
export type NewPostRow = typeof schema.Post.$inferInsert;
export type PostPollReferenceRow = typeof schema.PostPollReference.$inferSelect;
export type NewPostPollReferenceRow =
  typeof schema.PostPollReference.$inferInsert;
export type PostUnitReferenceRow = typeof schema.PostUnitReference.$inferSelect;
export type NewPostUnitReferenceRow =
  typeof schema.PostUnitReference.$inferInsert;
export type RealmRow = typeof schema.Realm.$inferSelect;
export type NewRealmRow = typeof schema.Realm.$inferInsert;
export type RealmCapabilityGrantRow =
  typeof schema.RealmCapabilityGrant.$inferSelect;
export type NewRealmCapabilityGrantRow =
  typeof schema.RealmCapabilityGrant.$inferInsert;
export type RealmMemberRow = typeof schema.RealmMember.$inferSelect;
export type NewRealmMemberRow = typeof schema.RealmMember.$inferInsert;
export type RealmRuleAcknowledgementRow =
  typeof schema.RealmRuleAcknowledgement.$inferSelect;
export type NewRealmRuleAcknowledgementRow =
  typeof schema.RealmRuleAcknowledgement.$inferInsert;
export type RealmTagApplicationRow =
  typeof schema.RealmTagApplication.$inferSelect;
export type NewRealmTagApplicationRow =
  typeof schema.RealmTagApplication.$inferInsert;
export type RealmTagApplicationVoteRow =
  typeof schema.RealmTagApplicationVote.$inferSelect;
export type NewRealmTagApplicationVoteRow =
  typeof schema.RealmTagApplicationVote.$inferInsert;
export type RealmTagContextRow = typeof schema.RealmTagContext.$inferSelect;
export type NewRealmTagContextRow = typeof schema.RealmTagContext.$inferInsert;
export type ScoreAggregateRow = typeof schema.ScoreAggregate.$inferSelect;
export type NewScoreAggregateRow = typeof schema.ScoreAggregate.$inferInsert;
export type ScoreEntryRow = typeof schema.ScoreEntry.$inferSelect;
export type NewScoreEntryRow = typeof schema.ScoreEntry.$inferInsert;
export type ScoreRealmFieldRow = typeof schema.ScoreRealmField.$inferSelect;
export type NewScoreRealmFieldRow = typeof schema.ScoreRealmField.$inferInsert;
export type SeriesRow = typeof schema.Series.$inferSelect;
export type NewSeriesRow = typeof schema.Series.$inferInsert;
export type SeriesContentIndexRow =
  typeof schema.SeriesContentIndex.$inferSelect;
export type NewSeriesContentIndexRow =
  typeof schema.SeriesContentIndex.$inferInsert;
export type ShelfRow = typeof schema.Shelf.$inferSelect;
export type NewShelfRow = typeof schema.Shelf.$inferInsert;
export type ShelfItemRow = typeof schema.ShelfItem.$inferSelect;
export type NewShelfItemRow = typeof schema.ShelfItem.$inferInsert;
export type SlugScopeRow = typeof schema.SlugScope.$inferSelect;
export type NewSlugScopeRow = typeof schema.SlugScope.$inferInsert;
export type StaffAuditLogRow = typeof schema.StaffAuditLog.$inferSelect;
export type NewStaffAuditLogRow = typeof schema.StaffAuditLog.$inferInsert;
export type StaffGrantRow = typeof schema.StaffGrant.$inferSelect;
export type NewStaffGrantRow = typeof schema.StaffGrant.$inferInsert;
export type SubjectAttributionRow =
  typeof schema.SubjectAttribution.$inferSelect;
export type NewSubjectAttributionRow =
  typeof schema.SubjectAttribution.$inferInsert;
export type SubscriptionRow = typeof schema.Subscription.$inferSelect;
export type NewSubscriptionRow = typeof schema.Subscription.$inferInsert;
export type UserSubscriptionListEntryRow =
  typeof schema.UserSubscriptionListEntry.$inferSelect;
export type NewUserSubscriptionListEntryRow =
  typeof schema.UserSubscriptionListEntry.$inferInsert;
export type TagVoteRow = typeof schema.TagVote.$inferSelect;
export type NewTagVoteRow = typeof schema.TagVote.$inferInsert;
export type UnitRow = typeof schema.Unit.$inferSelect;
export type NewUnitRow = typeof schema.Unit.$inferInsert;
export type UnitAliasRow = typeof schema.UnitAlias.$inferSelect;
export type NewUnitAliasRow = typeof schema.UnitAlias.$inferInsert;
export type UnitAliasVoteRow = typeof schema.UnitAliasVote.$inferSelect;
export type NewUnitAliasVoteRow = typeof schema.UnitAliasVote.$inferInsert;
export type UnitCollaboratorRow = typeof schema.UnitCollaborator.$inferSelect;
export type NewUnitCollaboratorRow =
  typeof schema.UnitCollaborator.$inferInsert;
export type UnitExternalLinkRow = typeof schema.UnitExternalLink.$inferSelect;
export type NewUnitExternalLinkRow =
  typeof schema.UnitExternalLink.$inferInsert;
export type UnitFieldLockRow = typeof schema.UnitFieldLock.$inferSelect;
export type NewUnitFieldLockRow = typeof schema.UnitFieldLock.$inferInsert;
export type UnitHistoryClockRow = typeof schema.UnitHistoryClock.$inferSelect;
export type NewUnitHistoryClockRow =
  typeof schema.UnitHistoryClock.$inferInsert;
export type UnitRealmRow = typeof schema.UnitRealm.$inferSelect;
export type NewUnitRealmRow = typeof schema.UnitRealm.$inferInsert;
export type UnitSupportLanguageRow =
  typeof schema.UnitSupportLanguage.$inferSelect;
export type NewUnitSupportLanguageRow =
  typeof schema.UnitSupportLanguage.$inferInsert;
export type UnitTagRow = typeof schema.UnitTag.$inferSelect;
export type NewUnitTagRow = typeof schema.UnitTag.$inferInsert;
export type UnitTranslationRow = typeof schema.UnitTranslation.$inferSelect;
export type NewUnitTranslationRow = typeof schema.UnitTranslation.$inferInsert;
export type UserRow = typeof schema.User.$inferSelect;
export type NewUserRow = typeof schema.User.$inferInsert;
export type UserBlockRow = typeof schema.UserBlock.$inferSelect;
export type NewUserBlockRow = typeof schema.UserBlock.$inferInsert;
export type UserContentNodeProgressRow =
  typeof schema.UserContentNodeProgress.$inferSelect;
export type NewUserContentNodeProgressRow =
  typeof schema.UserContentNodeProgress.$inferInsert;
export type UserTagApplicationRow =
  typeof schema.UserTagApplication.$inferSelect;
export type NewUserTagApplicationRow =
  typeof schema.UserTagApplication.$inferInsert;
export type UserUnitProgressRow = typeof schema.UserUnitProgress.$inferSelect;
export type NewUserUnitProgressRow =
  typeof schema.UserUnitProgress.$inferInsert;
export type ZoneRow = typeof schema.Zone.$inferSelect;
export type NewZoneRow = typeof schema.Zone.$inferInsert;
export * from "../relations";
export * from "./alias";
export * from "./attribution";
export * from "./book";
export * from "./progress";
export * from "./columns";
export * from "./comment";
export * from "./content-structure";
export * from "./custom-types";
export * from "./engagement";
export * from "./entity";
export * from "./game";
export * from "./governance";
export * from "./identity";
export * from "./jwt";
export * from "./link";
export * from "./media";
export * from "./misc";
export { HistoryOutbox as historyOutbox } from "./misc";
export * from "./moderation";
export * from "./poll";
export * from "./post";
export * from "./realm";
export * from "./score";
export * from "./series";
export * from "./shelf";
export * from "./tagging";
export * from "./translation";
export * from "./unit";
export * from "./user";
export * from "./zone";
