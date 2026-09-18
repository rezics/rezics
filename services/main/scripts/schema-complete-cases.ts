import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { applicationModel } from "@rezics/schema/model/generated";
import { termId } from "@rezics/schema/identity";

/** @internal Rejected cross-domain states on the real complete migration, never an application database. */
export async function checkCompleteSchema(pool: Pool) {
	const client = await pool.connect();
	let assertions = 0;
	const exec = (text: string, values: unknown[] = []) => client.query(text, values);
	const rejects = async (text: string, values: unknown[], code = "23514") => {
		await exec("SAVEPOINT bad_state");
		try {
			await assert.rejects(
				() => exec(text, values),
				(error: unknown) => error instanceof Error && "code" in error && error.code === code,
			);
			assertions++;
		} finally {
			await exec("ROLLBACK TO SAVEPOINT bad_state");
		}
	};
	const uuid = () => randomUUID();
	try {
		await exec("BEGIN");
		const image = uuid(),
			video = uuid(),
			representation = uuid(),
			otherRepresentation = uuid(),
			blob = uuid();
		await exec("INSERT INTO media_item(id,kind) VALUES ($1,'image'),($2,'video')", [image, video]);
		assert.equal(
			(
				await exec(
					"select count(*)::int n from reference_value where target_indexed_media_id=ANY($1::uuid[])",
					[[image, video]],
				)
			).rows[0].n,
			0,
		);
		assertions++;
		await exec(
			"INSERT INTO media_blob(id,storage_domain,algorithm,digest,byte_length,availability) VALUES ($1,'fixture','sha256','opaque','900719925474099312345','observed')",
			[blob],
		);
		assert.equal(
			(await exec("SELECT byte_length::text n FROM media_blob WHERE id=$1", [blob])).rows[0].n,
			"900719925474099312345",
		);
		assertions++;
		await rejects(
			"INSERT INTO media_blob(id,storage_domain,algorithm,digest,byte_length,availability) VALUES ($1,'fixture','sha256','fractional',1.5,'observed')",
			[uuid()],
		);
		await exec(
			"INSERT INTO media_representation(id,media_id,mime_type,width,height) VALUES ($1,$2,'image/png',200,100),($3,$4,'video/mp4',1920,1080)",
			[representation, image, otherRepresentation, video],
		);
		const fragment = uuid();
		await exec(
			"INSERT INTO media_fragment(id,representation_id,x,y,width,height,coordinate_unit) VALUES ($1,$2,0,0,50,50,'percent')",
			[fragment, representation],
		);
		await rejects(
			"INSERT INTO media_fragment(id,representation_id,x,y,width,height,coordinate_unit) VALUES ($1,$2,80,0,30,100,'percent')",
			[uuid(), representation],
		);
		await rejects(
			"INSERT INTO media_stream(representation_id,ordinal,kind,duration_ticks,time_scale) VALUES ($1,0,'video',10,0)",
			[representation],
		);
		const object = uuid(),
			reference = uuid(),
			creator = termId("https://schema.org/creator"),
			name = termId("https://schema.org/name");
		await exec("INSERT INTO description_object(id,visibility,state) VALUES ($1,'public','draft')", [
			object,
		]);
		await exec("INSERT INTO reference_value(id,target_description_id) VALUES ($1,$2)", [
			reference,
			object,
		]);
		await rejects(
			"INSERT INTO reference_value(id,target_description_id,target_indexed_media_id) VALUES ($1,$2,$3)",
			[uuid(), object, image],
		);
		const use = uuid(),
			useRevision = uuid(),
			slot = uuid(),
			selection = uuid();
		await exec("INSERT INTO media_use(id,subject_ref_id,media_id,role_id) VALUES ($1,$2,$3,$4)", [
			use,
			reference,
			image,
			creator,
		]);
		await rejects(
			"INSERT INTO media_use_revision(use_id,id,media_id,representation_id) VALUES ($1,$2,$3,$4)",
			[use, uuid(), image, otherRepresentation],
			"23503",
		);
		await exec(
			"INSERT INTO media_use_revision(use_id,id,media_id,representation_id,fragment_id) VALUES ($1,$2,$3,$4,$5)",
			[use, useRevision, image, representation, fragment],
		);
		await exec(
			"INSERT INTO media_slot(id,subject_ref_id,role_id,minimum,maximum) VALUES ($1,$2,$3,1,1)",
			[slot, reference, creator],
		);
		await exec("INSERT INTO media_selection_revision(slot_id,id) VALUES ($1,$2)", [
			slot,
			selection,
		]);
		await rejects("UPDATE media_selection_revision SET sealed=true WHERE slot_id=$1 AND id=$2", [
			slot,
			selection,
		]);
		await rejects(
			"INSERT INTO media_selection_head(slot_id,revision_id,version) VALUES ($1,$2,1)",
			[slot, selection],
		);
		await exec(
			"INSERT INTO media_selection_member(slot_id,selection_revision_id,position,subject_ref_id,role_id,use_id,use_revision_id) VALUES ($1,$2,0,$3,$4,$5,$6)",
			[slot, selection, reference, creator, use, useRevision],
		);
		await exec("UPDATE media_selection_revision SET sealed=true WHERE slot_id=$1 AND id=$2", [
			slot,
			selection,
		]);
		await exec("INSERT INTO media_selection_head(slot_id,revision_id,version) VALUES ($1,$2,1)", [
			slot,
			selection,
		]);
		await rejects("DELETE FROM media_selection_member WHERE slot_id=$1", [slot]);
		await rejects("UPDATE media_slot SET maximum=2 WHERE id=$1", [slot]);
		await rejects("UPDATE media_selection_head SET version=3 WHERE slot_id=$1", [slot]);
		const change = uuid(),
			revision = uuid(),
			other = uuid();
		await exec(
			"INSERT INTO description_change(id,object_id,nonce,payload_digest) VALUES ($1,$2,'edit-1','hash')",
			[change, object],
		);
		await rejects(
			"INSERT INTO description_revision(object_id,id,parent_id,change_id,model_id,profile_key) VALUES ($1,$2,$2,$3,$4,'described-resource')",
			[object, revision, change, applicationModel.id],
		);
		await exec(
			"INSERT INTO description_revision(object_id,id,change_id,model_id,profile_key) VALUES ($1,$2,$3,$4,'described-resource')",
			[object, revision, change, applicationModel.id],
		);
		const meaning = (
			await exec(
				"select definition_id from schema_release_term where term_id=$1 and release_id=$2",
				[name, applicationModel.sourceReleases.find((release) => release.key === "schemaorg")!.id],
			)
		).rows[0].definition_id;
		await exec(
			"INSERT INTO description_statement(object_id,revision_id,id,predicate_id,definition_id,state) VALUES ($1,$2,$3,$4,$5,'unknown')",
			[object, revision, uuid(), name, meaning],
		);
		await rejects(
			"INSERT INTO description_statement(object_id,revision_id,id,predicate_id,definition_id,state,lexical) VALUES ($1,$2,$3,$4,$5,'no-value','not absent')",
			[object, revision, uuid(), name, meaning],
		);

		await rejects(
			"INSERT INTO description_statement(object_id,revision_id,id,predicate_id,definition_id,state,order_key) VALUES ($1,$2,$3,$4,$5,'unknown','not-an-integer')",
			[object, revision, uuid(), name, meaning],
		);
		await exec(
			"UPDATE description_revision SET payload_state='erased' WHERE object_id=$1 AND id=$2",
			[object, revision],
		);
		await rejects(
			"INSERT INTO description_selection(object_id,revision_id,version,change_id) VALUES ($1,$2,1,$3)",
			[object, revision, change],
		);
		await rejects(
			"UPDATE description_revision SET payload_state='available' WHERE object_id=$1 AND id=$2",
			[object, revision],
		);
		const page = uuid(),
			pageRevision = uuid();
		await exec("INSERT INTO wiki_page(id,state) VALUES ($1,'draft'),($2,'draft')", [page, other]);
		await exec("INSERT INTO wiki_revision(page_id,id,language) VALUES ($1,$2,'en')", [
			page,
			pageRevision,
		]);
		await rejects(
			"INSERT INTO wiki_revision(page_id,id,language,parent_id) VALUES ($1,$2,'zh',$3)",
			[page, uuid(), pageRevision],
		);
		await rejects(
			"INSERT INTO wiki_head(page_id,language,branch,revision_id,version) VALUES ($1,'en','main',$2,1)",
			[page, pageRevision],
		);
		await exec(
			"INSERT INTO wiki_revision_payload(page_id,revision_id,title,format,body,digest) VALUES ($1,$2,'Page','markdown','\"Content\"','hash')",
			[page, pageRevision],
		);
		await exec(
			"INSERT INTO wiki_head(page_id,language,branch,revision_id,version) VALUES ($1,'en','main',$2,1)",
			[page, pageRevision],
		);
		await rejects(
			"INSERT INTO wiki_selection(page_id,language,revision_id,version) VALUES ($1,'en',$2,1)",
			[other, pageRevision],
		);
		await rejects("UPDATE wiki_head SET version=3 WHERE page_id=$1", [page]);
		// Native group membership uses current Auth/Self identities and does not fan out a new message into per-member counters.
		const user = uuid(),
			entity = uuid(),
			room = uuid(),
			message = uuid();
		await exec("INSERT INTO users(id,name,email) VALUES ($1,'Schema fixture',$2)", [
			user,
			`${user}@example.test`,
		]);
		await exec("INSERT INTO entity_identity(id,shape) VALUES ($1,'person')", [entity]);
		await exec("INSERT INTO auth_entity(auth_user_id,entity_id) VALUES ($1,$2)", [user, entity]);
		await exec("INSERT INTO conversation(id,kind) VALUES ($1,'group')", [room]);
		await rejects(
			"INSERT INTO message(id,conversation_id,sender_auth_user_id,sender_entity_id,content) VALUES ($1,$2,$3,$4,'Hello')",
			[message, room, user, entity],
		);
		await exec(
			"INSERT INTO conversation_member(conversation_id,user_id,entity_id,role,joined_at,history_from,revision) VALUES ($1,$2,$3,'owner',now(),now(),1)",
			[room, user, entity],
		);
		await exec(
			"INSERT INTO message(id,conversation_id,sender_auth_user_id,sender_entity_id,content) VALUES ($1,$2,$3,$4,'Hello')",
			[message, room, user, entity],
		);
		assert.equal(
			(await exec("SELECT count(*)::int n FROM message_revision WHERE message_id=$1", [message]))
				.rows[0].n,
			0,
		);
		assertions++;
		await exec("UPDATE message SET content='Edited' WHERE id=$1", [message]);
		assert.equal(
			(
				await exec("SELECT content FROM message_revision WHERE message_id=$1 AND revision=1", [
					message,
				])
			).rows[0].content,
			"Hello",
		);
		assertions++;
		await exec("UPDATE message SET content=NULL,deleted_at=clock_timestamp() WHERE id=$1", [
			message,
		]);
		assert.equal(
			(
				await exec(
					"SELECT count(*)::int n FROM message_revision WHERE message_id=$1 AND content IS NOT NULL",
					[message],
				)
			).rows[0].n,
			0,
		);
		assertions++;
		await rejects("UPDATE message SET content='Resurrect',deleted_at=NULL WHERE id=$1", [message]);
		await exec(
			"UPDATE conversation_member SET left_at=clock_timestamp(),revision=2 WHERE conversation_id=$1 AND user_id=$2",
			[room, user],
		);
		await rejects(
			"INSERT INTO message(id,conversation_id,sender_auth_user_id,sender_entity_id,content) VALUES ($1,$2,$3,$4,'After leaving')",
			[uuid(), room, user, entity],
		);
		const pkg = uuid(),
			release = uuid();
		await exec(
			"INSERT INTO registry_package(id,ecosystem,namespace,name,kind) VALUES ($1,'fixture','rezics','schema-test','software')",
			[pkg],
		);
		await exec(
			"INSERT INTO registry_release(package_id,id,version,digest,manifest,state) VALUES ($1,$2,'1','hash','{}','published')",
			[pkg, release],
		);
		await rejects(
			"INSERT INTO registry_file(package_id,release_id,path,blob_id,media_type) VALUES ($1,$2,'../secret',$3,'text/plain')",
			[pkg, release, blob],
		);
		await exec(
			"INSERT INTO registry_file(package_id,release_id,path,blob_id,media_type) VALUES ($1,$2,'aa/index.js',$3,'text/plain')",
			[pkg, release, blob],
		);
		const offering = uuid(),
			planGroup = uuid(),
			plan = uuid(),
			planRevision = uuid();
		await exec(
			"INSERT INTO subscription_offering(id,target_ref_id,operator_entity_id,state,revision) VALUES ($1,$2,$3,'active',1)",
			[offering, reference, entity],
		);
		await exec(
			"INSERT INTO subscription_plan_group(id,offering_id,mode,revision) VALUES ($1,$2,'parallel',1)",
			[planGroup, offering],
		);
		await exec(
			"INSERT INTO subscription_plan(id,offering_id,group_id,key,state) VALUES ($1,$2,$3,'fixture','active')",
			[plan, offering, planGroup],
		);
		await exec(
			"INSERT INTO subscription_plan_revision(plan_id,id,revision,title,terms) VALUES ($1,$2,1,'Fixture','{}')",
			[plan, planRevision],
		);
		await rejects(
			"INSERT INTO subscription_price(id,plan_id,plan_revision_id,currency,minor_units,interval_unit,interval_count) VALUES ($1,$2,$3,'USD',1.25,'month',1)",
			[uuid(), plan, planRevision],
		);
		await exec(
			"INSERT INTO subscription_price(id,plan_id,plan_revision_id,currency,minor_units,interval_unit,interval_count) VALUES ($1,$2,$3,'USD',1200,'month',1)",
			[uuid(), plan, planRevision],
		);
		const benefit = uuid(),
			benefitRevision = uuid(),
			award = uuid(),
			otherUser = uuid();
		await exec(
			"INSERT INTO subscription_benefit(id,namespace,key,kind) VALUES ($1,'fixture','read','content')",
			[benefit],
		);
		await exec(
			"INSERT INTO subscription_benefit_revision(benefit_id,id,revision,contract) VALUES ($1,$2,1,'{}')",
			[benefit, benefitRevision],
		);
		await exec(
			"INSERT INTO complimentary_award(id,beneficiary_user_id,issuer_entity_id,reason,receipt_key) VALUES ($1,$2,$3,'Gift','fixture')",
			[award, user, entity],
		);
		await exec("INSERT INTO users(id,name,email) VALUES ($1,'Other',$2)", [
			otherUser,
			`${otherUser}@example.test`,
		]);
		await rejects(
			"INSERT INTO entitlement_grant(id,beneficiary_user_id,benefit_id,benefit_revision_id,scope_ref_id) VALUES ($1,$2,$3,$4,$5)",
			[uuid(), user, benefit, benefitRevision, reference],
		);
		await rejects(
			"INSERT INTO entitlement_grant(id,beneficiary_user_id,benefit_id,benefit_revision_id,scope_ref_id,complimentary_award_id) VALUES ($1,$2,$3,$4,$5,$6)",
			[uuid(), otherUser, benefit, benefitRevision, reference, award],
			"23503",
		);
		await exec(
			"INSERT INTO entitlement_grant(id,beneficiary_user_id,benefit_id,benefit_revision_id,scope_ref_id,complimentary_award_id) VALUES ($1,$2,$3,$4,$5,$6)",
			[uuid(), user, benefit, benefitRevision, reference, award],
		);

		console.info(`PASS ${assertions} native schema invariants`);
	} finally {
		await exec("ROLLBACK");
		client.release();
	}
}
