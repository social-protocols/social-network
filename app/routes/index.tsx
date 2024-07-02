import { json, type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { useLoaderData, useParams } from '@remix-run/react'
import { Markdown } from '#app/components/markdown.tsx'
import InfoText from '#app/components/ui/info-text.tsx'
import { db } from '#app/db.ts'
import { updateHN } from '#app/repositories/hackernews.ts'
import {
	getDiscussionOfTheDay,
	getTransitiveParents,
} from '#app/repositories/post.ts'
import { getCommentTreeState, getReplyTree } from '#app/repositories/ranking.ts'
import {
	type CommentTreeState,
	type ReplyTree,
	type Post,
} from '#app/types/api-types.ts'
import { getUserId } from '#app/utils/auth.server.ts'
import { DiscussionView } from './post.$postId.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	const discussionOfTheDayPostId = await db
		.transaction()
		.execute(async trx => await getDiscussionOfTheDay(trx))
	const userId: string | null = await getUserId(request)
	const loggedIn = userId !== null

	if (discussionOfTheDayPostId === undefined) {
		console.log(
			"Couldn't find current discussion of the day post, redirecting to /explore",
		)
		return redirect('/explore')
	}

	const {
		mutableReplyTree,
		transitiveParents,
		commentTreeState,
	}: {
		mutableReplyTree: ReplyTree
		transitiveParents: Post[]
		commentTreeState: CommentTreeState
	} = await db.transaction().execute(async trx => {
		await updateHN(trx, discussionOfTheDayPostId)
		const commentTreeState = await getCommentTreeState(
			trx,
			discussionOfTheDayPostId,
			userId,
		)
		return {
			mutableReplyTree: await getReplyTree(
				trx,
				discussionOfTheDayPostId,
				userId,
				commentTreeState,
			),
			transitiveParents: await getTransitiveParents(
				trx,
				discussionOfTheDayPostId,
			),
			commentTreeState,
		}
	})

	return json({
		mutableReplyTree,
		transitiveParents,
		commentTreeState,
		loggedIn,
	})
}

export default function Index() {
	const { mutableReplyTree, transitiveParents, commentTreeState, loggedIn } =
		useLoaderData<typeof loader>()

	const params = useParams()

	return (
		<>
			<InfoText />
			<div className="markdown mb-4 mt-8">
				<Markdown deactivateLinks={false}>## Discussion of the Day 🔥</Markdown>
			</div>
			<DiscussionView
				key={params['postId']}
				mutableReplyTree={mutableReplyTree}
				transitiveParents={transitiveParents}
				initialCommentTreeState={commentTreeState}
				loggedIn={loggedIn}
			/>
		</>
	)
}
