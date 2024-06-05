import { type Transaction, sql } from 'kysely'
import { type DB } from './db/kysely-types.ts'
import { getScoredPost, type ScoredPost } from './ranking.ts'
import { relativeEntropy } from './utils/entropy.ts'
import { invariant } from './utils/misc.tsx'

export type ThreadPost = ScoredPost & {
	isCritical: boolean
	effectOnParentSize?: number
}

export async function getCriticalThread(
	trx: Transaction<DB>,
	postId: number,
): Promise<ThreadPost[]> {
	const postWithCriticalThreadId = await trx
		.withRecursive('CriticalThread', db =>
			db
				.selectFrom('ScoreWithDefault as Score')
				.where('postId', '=', postId)
				.select(['postId', 'topCommentId', 'criticalThreadId'])
				.unionAll(db =>
					db
						.selectFrom('ScoreWithDefault as S')
						.innerJoin('CriticalThread as CT', 'S.postId', 'CT.topCommentId')
						.select(['S.postId', 'S.topCommentId', 'S.criticalThreadId']),
				),
		)
		.selectFrom('CriticalThread')
		.select('postId')
		.select(eb =>
			eb.fn
				.coalesce(sql<number>`criticalThreadId`, sql<number>`postId`)
				.as('criticalThreadId'),
		)
		.where('postId', '>', postId)
		.execute()

	let isCriticalMap = new Map<number, boolean>()
	postWithCriticalThreadId.forEach(post => {
		isCriticalMap.set(post.postId, post.criticalThreadId !== post.postId)
	})

	const scoredPosts = await Promise.all(
		postWithCriticalThreadId.map(post => getScoredPost(trx, post.postId)),
	)

	const effects = await trx
		.selectFrom('Effect')
		.where(
			'commentId',
			'in',
			scoredPosts.map(post => post.id),
		)
		.selectAll('Effect')
		.execute()

	const effectSizes = effects.map(effect => {
		invariant(
			effect.commentId,
			`Got effect for post ${effect.postId} with commentId = null`,
		)
		return {
			postId: effect.commentId,
			effectSize: relativeEntropy(effect.p, effect.q),
		}
	})

	const effectMap = new Map<number, number>()
	effectSizes.forEach(effectSize => {
		effectMap.set(effectSize.postId, effectSize.effectSize)
	})

	const threadPosts: ThreadPost[] = scoredPosts.map(post => {
		let isCritical = isCriticalMap.get(post.id)
		if (isCritical == null || isCritical == undefined) {
			isCritical = false
			console.warn(
				`Can't determine isCritical for post ${post.id}. Defaulting to false.`,
			)
		}
		return {
			...post,
			isCritical: isCritical,
			effectOnParentSize: effectMap.get(post.id),
		}
	})

	return threadPosts
}
