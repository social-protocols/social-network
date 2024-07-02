import * as Immutable from 'immutable'
import { type Transaction, sql } from 'kysely'
import { MAX_POSTS_PER_PAGE } from '#app/constants.ts'
import {
	type Effect,
	type VoteState,
	type ReplyTree,
	type ImmutableReplyTree,
	type CommentTreeState,
	type FrontPagePost,
} from '#app/types/api-types.ts'
import { invariant } from '#app/utils/misc.tsx'
import { type DBEffect } from '../types/db-types.ts'
import { type DB } from '../types/kysely-types.ts'
import { relativeEntropy } from '../utils/entropy.ts'
import {
	getDescendantCount,
	getDescendants,
	getPost,
	getReplyIds,
	getPostWithScore,
} from './post.ts'
import { defaultVoteState, getUserVotes } from './vote.ts'

export function toImmutableReplyTree(replyTree: ReplyTree): ImmutableReplyTree {
	return {
		...replyTree,
		replies: Immutable.List(replyTree.replies.map(toImmutableReplyTree)),
	}
}

export function addReplyToReplyTree(
	tree: ImmutableReplyTree,
	reply: ImmutableReplyTree,
): ImmutableReplyTree {
	if (reply.post.parentId == tree.post.id) {
		return {
			...tree,
			replies: tree.replies.insert(0, reply),
		}
	}
	return {
		...tree,
		replies: tree.replies.map(child => addReplyToReplyTree(child, reply)),
	}
}

export async function getCommentTreeState(
	trx: Transaction<DB>,
	targetPostId: number,
	userId: string | null,
): Promise<CommentTreeState> {
	const descendantIds = await getDescendants(trx, targetPostId)

	const results = await trx
		.selectFrom('Post')
		.leftJoin('FullScore', join =>
			join.onRef('FullScore.postId', '=', 'Post.id'),
		)
		.select([
			'Post.id as postId',
			'FullScore.p as p',
			'FullScore.oSize as voteCount',
			'Post.deletedAt as deletedAt',
		])
		.where('Post.id', 'in', descendantIds.concat([targetPostId]))
		.where('p', 'is not', null)
		.execute()

	const criticalCommentId = (
		await trx
			.selectFrom('FullScore')
			.where('postId', '=', targetPostId)
			.select('criticalThreadId')
			.executeTakeFirstOrThrow()
	).criticalThreadId

	const userVotes: VoteState[] | undefined = userId
		? await getUserVotes(trx, userId, descendantIds.concat([targetPostId]))
		: undefined

	let commentTreeState: CommentTreeState = {
		targetPostId,
		criticalCommentId,
		posts: {},
	}
	await Promise.all(
		results.map(async result => {
			commentTreeState.posts[result.postId] = {
				// We have to use the non-null assertion here because kysely doesn't
				// return values as non-null type even if we filter nulls with a where
				// condition. We can, however, be sure that the values are never null.
				// See: https://kysely.dev/docs/examples/SELECT/not-null
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				p: result.p!,
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				voteCount: result.voteCount!,
				voteState:
					userVotes?.find(voteState => voteState.postId == result.postId) ||
					defaultVoteState(result.postId),
				effectOnTargetPost:
					(await getEffect(trx, targetPostId, result.postId)) ?? null,
				isDeleted: result.deletedAt != null,
			}
		}),
	)

	return commentTreeState
}

export function getAllPostIdsInTree(
	tree: ImmutableReplyTree,
): Immutable.List<number> {
	if (tree.replies.size === 0) {
		return Immutable.List([tree.post.id])
	}
	return Immutable.List(tree.replies.flatMap(getAllPostIdsInTree)).insert(
		0,
		tree.post.id,
	)
}

export async function getReplyTree(
	trx: Transaction<DB>,
	postId: number,
	userId: string | null,
	commentTreeState: CommentTreeState,
): Promise<ReplyTree> {
	const directReplyIds = await getReplyIds(trx, postId)
	const post = await getPostWithScore(trx, postId)

	const replies: ReplyTree[] = await Promise.all(
		// Recursively get all subtrees.
		// Stopping criterion: Once we reach a leaf node, its replies will be an
		// empty array, so the Promise.all will resolve immediately.
		directReplyIds.map(
			async replyId =>
				await getReplyTree(trx, replyId, userId, commentTreeState),
		),
	)

	// Sort replies by EffectSize on targetPost
	// (in-place sort)
	replies.sort((a, b) => {
		const effectA = commentTreeState.posts[a.post.id]?.effectOnTargetPost
		const effectB = commentTreeState.posts[a.post.id]?.effectOnTargetPost
		invariant(
			effectA !== undefined,
			`post ${a.post.id} not found in commentTreeState`,
		)
		invariant(
			effectB !== undefined,
			`post ${b.post.id} not found in commentTreeState`,
		)
		if (effectA != null) {
			invariant(
				effectA.commentId == a.post.id,
				`Wrong effect source ${effectA.commentId}. Should be ${a.post.id}`,
			)
			invariant(
				effectA.postId == commentTreeState.targetPostId,
				`Found effect on ${effectA.postId}. Required effect on ${commentTreeState.targetPostId}`,
			)
		}
		if (effectB != null) {
			invariant(
				effectB.commentId == b.post.id,
				`Wrong effect source ${effectB.commentId}. Should be ${b.post.id}`,
			)
			invariant(
				effectB.postId == commentTreeState.targetPostId,
				`Found effect on ${effectB.postId}. Required effect on ${commentTreeState.targetPostId}`,
			)
		}
		const effectSizeA = effectSizeOnTarget(effectA)
		const effectSizeB = effectSizeOnTarget(effectB)

		const tieBreaker = b.post.score - a.post.score
		return effectSizeB - effectSizeA || tieBreaker
	})

	return {
		post: post,
		replies: replies,
	}
}

function effectSizeOnTarget(effectOnTarget: Effect | null): number {
	const targetP = effectOnTarget?.p ?? 0
	const targetQ = effectOnTarget?.q ?? 0
	const targetPSize = effectOnTarget?.pSize ?? 0
	return relativeEntropy(targetP, targetQ) * targetPSize
}

export async function getEffect(
	trx: Transaction<DB>,
	postId: number,
	commentId: number,
): Promise<DBEffect | undefined> {
	const effect: DBEffect | undefined = await trx
		.selectFrom('Effect')
		.where('postId', '=', postId)
		.where('commentId', '=', commentId)
		.selectAll()
		.executeTakeFirst()
	return effect
}

export async function getEffects(
	trx: Transaction<DB>,
	postId: number,
): Promise<DBEffect[]> {
	let query = trx
		.selectFrom('Post')
		.innerJoin('EffectWithDefault as Effect', join =>
			join.on('Effect.commentId', '=', postId),
		)
		.innerJoin('Post as TargetPost', 'TargetPost.id', 'Effect.postId')
		.selectAll('Effect')
		.where('Post.id', '=', postId)
		.orderBy('TargetPost.createdAt')

	const effects = await query.execute()
	return effects
}

export async function getChronologicalToplevelPosts(
	trx: Transaction<DB>,
): Promise<FrontPagePost[]> {
	let query = trx
		.selectFrom('Post')
		.where('Post.parentId', 'is', null)
		.where('Post.deletedAt', 'is', null)
		.innerJoin('FullScore', 'FullScore.postId', 'Post.id')
		.leftJoin('PostStats', join =>
			join.onRef('PostStats.postId', '=', 'Post.id'),
		)
		.selectAll('Post')
		.selectAll('FullScore')
		.select(sql<number>`replies`.as('nReplies'))
		.orderBy('Post.createdAt', 'desc')
		.limit(MAX_POSTS_PER_PAGE)

	const scoredPosts = await query.execute()

	const res = await Promise.all(
		scoredPosts.map(async post => {
			return {
				...post,
				parent: post.parentId ? await getPost(trx, post.parentId) : null,
				effects: await getEffects(trx, post.id),
				nTransitiveComments: await getDescendantCount(trx, post.id),
			}
		}),
	)

	return res
}
