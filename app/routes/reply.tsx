import { type ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { db } from '#app/db.ts'
import { createPost } from '#app/repositories/post.ts'
import { getCommentTreeState, getReplyTree } from '#app/repositories/ranking.ts'
import { requireUserId } from '#app/utils/auth.server.ts'

type ReplyData = {
	parentId: number
	focussedPostId: number
	content: string
	isPrivate: number
}

const replyDataSchema = z.object({
	parentId: z.number(),
	focussedPostId: z.number(),
	content: z.string(),
	isPrivate: z.number(),
})

export const action = async (args: ActionFunctionArgs) => {
	let request = args.request
	const userId: string = await requireUserId(request)

	const { parentId, focussedPostId, content, isPrivate }: ReplyData =
		replyDataSchema.parse(await request.json())

	invariant(content, 'content !== undefined')

	return await db.transaction().execute(async trx => {
		const postId = await createPost(trx, parentId, content, userId, {
			isPrivate: Boolean(isPrivate),
			withUpvote: true,
		})
		if (focussedPostId) {
			const commentTreeState = await getCommentTreeState(
				trx,
				focussedPostId,
				userId,
			)
			return {
				commentTreeState,
				newReplyTree: await getReplyTree(trx, postId, userId, commentTreeState),
			}
		} else return {}
	})
}
