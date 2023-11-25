// import { Spacer } from '#app/components/spacer.tsx'
// import { Icon } from '#app/components/ui/icon.tsx'
import { json, type DataFunctionArgs } from '@remix-run/node'
// import { Form, Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { Location, logImpression } from "#app/attention.ts"
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { topNote, voteRate } from '#app/probabilities.ts'
import { prisma } from '#app/utils/db.server.ts'
import { invariantResponse } from '#app/utils/misc.tsx'
import { type Post } from '@prisma/client'
import { useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { z } from 'zod'

const GLOBAL_TAG = "global";

const postIdSchema = z.coerce.number()



export async function loader({ params }: DataFunctionArgs) {
	invariant(params.postId, 'Missing postid param')
	const postId: number = postIdSchema.parse(params.postId)

	const post: Post | null = await prisma.post.findFirst({
		select: {
			id: true,
			parentId: true,
			content: true,
			authorId: true,
			createdAt: true,
			// question_id: true,
		},
		where: {
			id: postId,
		},
	})


	invariantResponse(post, 'Post not found', { status: 404 })

	const tag = GLOBAL_TAG;
	const note = await topNote(tag, postId)

	const vr = await voteRate(tag, postId)
	console.log(`Vote rate is ${vr}`)


	const noteId = note != null ? note.id : 0

	await logImpression(100, tag, postId, Location.POST_PAGE, 0)
	await logImpression(100, tag, noteId, Location.TOP_NOTE_ON_POST_PAGE, 0)

	return json({ post, note })
}

export default function Post() {
	const { post, note } = useLoaderData<typeof loader>()

	return <div>
		<div>This is a post: {post.content}</div>
		<div>Top Note: {note ? note.content : ""}</div>
	</div>
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>Post not found</p>,
			}}
		/>
	)
}
