import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { PostDetails } from '#app/components/ui/post.tsx'
import { type Post } from '#app/db/types.ts'
import { db } from '#app/db.ts'
import {
	type ReplyTree,
	type ScoredPost,
	getReplyTree,
	getScoredPost,
} from '#app/ranking.ts'
import { getUserId } from '#app/utils/auth.server.ts'

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
		.execute(async trx => getReplyTree(trx, postId))

	return json({ post, replyTree, loggedIn })
}

export default function Post() {
	const { post, replyTree, loggedIn } = useLoaderData<typeof loader>()
	return (
		<>
			<div className={'mb-5'}>
				<PostDetails post={post} teaser={false} loggedIn={loggedIn} />
			</div>
			<h1 className={'mb-5'}>Replies</h1>
			<TreeReplies replyTree={replyTree} loggedIn={loggedIn} />
		</>
	)
}

export function TreeReplies({
	replyTree,
	loggedIn,
}: {
	replyTree: ReplyTree
	loggedIn: boolean
}) {
	if (replyTree.replies.length === 0) {
		return <></>
	}
	return (
		<>
			{replyTree.replies.map(tree => {
				return (
					<>
						<PostDetails post={tree.post} teaser={false} loggedIn={loggedIn} />
						<div
							className={
								'border-left-solid ml-2 border-l-4 border-gray-300 pl-2'
							}
						>
							<TreeReplies replyTree={tree} loggedIn={loggedIn} />
						</div>
					</>
				)
			})}
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