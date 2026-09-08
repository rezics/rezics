import Elysia, { t } from "elysia";
import session, { resolveIdentity } from "../../auth/session";
import { AuthenticationRequired } from "../../auth/errors";
import { database } from "../../database";
import { getPublicEntitySummariesByIds } from "../../participation/presentation";
import { searchDomainIdentifiers } from "../../search/service";
import { resolveViewerContentRatings, contentRatingPolicyFromAllowlist } from "../../content-rating/policy";
import { LocalizationLanguageQuery } from "../schema";
import { CreditAttributionResponse } from "../schema/response";
import { decodeDomainCursor, encodeDomainCursor } from "../../catalog/domain-api-pagination";
import { z } from "zod";
import { ValidationError } from "../errors";

/** @alpha @remarks Direct candidates require target consent; a readable catalog entry alone never supplies that consent. */
export default new Elysia({prefix:"/entity-candidates",name:"catalog-entity-candidates"}).use(session)
	.get("",{query:t.Object({mode:t.UnionEnum(["direct","public"],{default:"public"}),query:t.Optional(t.String({maxLength:500})),
		cursor:t.Optional(t.String({maxLength:8192})),limit:t.Integer({minimum:1,maximum:50,default:10}),...LocalizationLanguageQuery}),
		response:t.Object({items:t.Array(CreditAttributionResponse.properties.creditedEntity,{maxItems:50}),nextCursor:t.Nullable(t.String())}),
		detail:{operationId:"listCatalogEntityCandidates",summary:"Find public Entities eligible for the chosen attribution step",tags:["Catalog Entity"]}},
		async({query,request})=>{
			const identity=await resolveIdentity(request,"unit:read");
			const scope=`entity-candidates:${query.mode}:${query.query??""}`;
			const cursor=(()=>{try{return decodeDomainCursor(scope,query.cursor,z.string().max(4096));}
				catch(cause){if(cause instanceof TypeError)throw new ValidationError({message:cause.message});throw cause;}})();
			if(query.mode==="direct") {
				if(!identity.entity) throw new AuthenticationRequired();
				const authorization=identity.authorization;
				if(!(await authorization.platform.hasCapability("entity.associations.override"))) {
					if(cursor) return {items:[],nextCursor:null};
					return database.transaction(async tx=>{
						const id=identity.entity.id;
						if(!(await authorization.entity.allowsAssociationCommand(tx,id,"credit","direct"))) return {items:[],nextCursor:null};
						const map=await getPublicEntitySummariesByIds([id],query.localizationLanguages??[],tx);
						const item=map.get(id);
						const readable=await authorization.unit.readableUnitIdsInTransaction(tx,[id]);
						const matches=!query.query?.trim() || query.query.trim().toLowerCase()===id || item?.title?.toLocaleLowerCase().includes(query.query.trim().toLocaleLowerCase());
						return {items:item&&readable.has(id)&&matches?[item]:[],nextCursor:null};
					},{isolationLevel:"repeatable read"});
				}
			}
			const exactId=z.uuid().safeParse(query.query?.trim());
			if(exactId.success) {
				if(cursor) return {items:[],nextCursor:null};
				return database.transaction(async tx=>{
					const id=exactId.data.toLowerCase();
					const item=(await getPublicEntitySummariesByIds([id],query.localizationLanguages??[],tx)).get(id);
					const readable=await identity.authorization.unit.readableUnitIdsInTransaction(tx,[id]);
					return {items:item&&readable.has(id)?[item]:[],nextCursor:null};
				},{isolationLevel:"repeatable read"});
			}
			const page=await searchDomainIdentifiers("entities",{query:query.query??"",limit:query.limit,cursor,
				sort:query.query?.trim()?"relevance":"createdAt:desc",owners:["entity"],localizationLanguages:query.localizationLanguages,
				contentRatingPolicy:contentRatingPolicyFromAllowlist(await resolveViewerContentRatings(identity.authorization.profileId))});
			const items=await database.transaction(async tx=>{
				const ids=page.hits.map(item=>item.id);
				const map=await getPublicEntitySummariesByIds(ids,query.localizationLanguages??[],tx);
				const readable=await identity.authorization.unit.readableUnitIdsInTransaction(tx,ids);
				return ids.flatMap(id=>{const value=map.get(id);return value&&readable.has(id)?[value]:[];});
			},{isolationLevel:"repeatable read"});
			return {items,nextCursor:page.nextCursor?encodeDomainCursor(scope,page.nextCursor):null};
		});
