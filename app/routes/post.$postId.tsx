import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Map } from 'immutable'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ParentThread } from '#app/components/ui/parent-thread.tsx'
import { PostDetails } from '#app/components/ui/post-details.tsx'
import { TreeReplies } from '#app/components/ui/reply-tree.tsx'
import { type Post } from '#app/db/types.ts'
import { db } from '#app/db.ts'
import { getTransitiveParents } from '#app/post.ts'
import {
	type ReplyTree,
	type ScoredPost,
	getReplyTree,
	getScoredPost,
	getCommentTreeState,
	type CommentTreeState,
	getAllPostIdsInTree,
} from '#app/ranking.ts'
import { getUserId } from '#app/utils/auth.server.ts'
import { Direction, defaultVoteState } from '#app/vote.ts'

const postIdSchema = z.coerce.number()

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId: string | null = await getUserId(request)
	const loggedIn = userId !== null

	const postId = postIdSchema.parse(params.postId)
	const post: ScoredPost = await db
		.transaction()
		.execute(async trx => getScoredPost(trx, postId))

	const replyTree: ReplyTree = await db
		.transaction()
		.execute(async trx => getReplyTree(trx, postId, userId))

	const transitiveParents = await db
		.transaction()
		.execute(async trx => getTransitiveParents(trx, post.id))

	const postData: CommentTreeState = await db
		.transaction()
		.execute(async trx => await getCommentTreeState(trx, postId, userId))

	return json({ post, replyTree, transitiveParents, postData, loggedIn })
}

export default function Post() {
	const { post, replyTree, transitiveParents, postData, loggedIn } =
		useLoaderData<typeof loader>()

	const [postDataState, setPostDataState] = useState<CommentTreeState>(postData)

	const currentVoteState =
		postDataState[post.id]?.voteState || defaultVoteState(post.id)

	let initialIsCollapsedState = Map<number, boolean>()
	const allIds = getAllPostIdsInTree(replyTree)
	allIds.forEach(id => {
		if (!(id == post.id)) {
			initialIsCollapsedState = initialIsCollapsedState.set(id, false)
		}
	})
	const [isCollapsedState, setIsCollapsedState] = useState<
		Map<number, boolean>
	>(initialIsCollapsedState)

	return (
		<>
			<ParentThread transitiveParents={transitiveParents} />
			<PostDetails
				post={post}
				teaser={false}
				loggedIn={loggedIn}
				className={'mb-2 rounded-sm bg-post p-2'}
				focussedPostId={post.id}
				postDataState={postDataState}
				setPostDataState={setPostDataState}
			/>
			<div
				className={
					'border-left-solid ml-2 border-l-4 border-post border-transparent pl-3'
				}
			>
				<TreeReplies
					replyTree={replyTree}
					criticalCommentId={post.criticalThreadId}
					targetHasVote={currentVoteState.vote !== Direction.Neutral}
					loggedIn={loggedIn}
					focussedPostId={post.id}
					postDataState={postDataState}
					setPostDataState={setPostDataState}
					isCollapsedState={isCollapsedState}
					setIsCollapsedState={setIsCollapsedState}
				/>
			</div>
		</>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: () => <p>Post not found</p>,
			}}
		/>
	)
}
