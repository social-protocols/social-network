import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	await db.transaction().execute(async trx => {
		await sql`drop view CriticalThread`.execute(trx)

		await sql`
			create table CriticalThread (
				targetId integer primary key
				, criticalThreadId integer not null
				, depth integer not null
			) strict
		`.execute(trx)

		await sql`drop trigger afterInsertEffectEvent`.execute(trx)

		await sql`
			create trigger afterInsertEffectEvent after insert on EffectEvent begin

				insert or replace into Effect
				values (
					new.voteEventId,
					new.voteEventTime,
					new.postId,
					new.commentId,
					new.p,
					new.pCount,
					new.pSize,
					new.q,
					new.qCount,
					new.qSize,
					new.r,
					new.weight
				);

				delete from CriticalThread;

				insert or replace into CriticalThread
				with topCommentThread as (
						select
								postId as targetId
								, parentId
								, commentId as topCommentId
								, separation
								, max(weight) as weight
						from
								effect
								join post on (effect.commentId = post.id)
								join lineage on (postId = ancestorId and post.id = descendantId)
						group by targetId, parentId
						having weight > 0
				)
				select
						targetId
						, topCommentId as criticalThreadId
						, max(separation) as depth
				from topCommentThread
				group by targetId
				having targetId = new.postId;

			end
		`.execute(trx)

		await sql`create unique index CriticalThread_targetId on CriticalThread (targetId)`.execute(trx)
	})
}
