import { Link, useNavigate } from '@remix-run/react'
import moment from 'moment'
import { type ScoredPost } from '#app/ranking.ts'
import { CommentIcon } from './post.tsx'

export function DeletedPost({ post }: { post: ScoredPost }) {
	const ageString = moment(post.createdAt).fromNow()
	
	const navigate = useNavigate()

	return (
		<div
			className={
				'mb-5 flex w-full flex-row space-x-4 rounded-lg bg-post px-5 pb-5'
			}
		>
			<div
				className={'flex w-full min-w-0 flex-col'}
			>
				<div className="mb-1 mt-2 flex text-sm">
					<span className="ml-auto opacity-50">{ageString}</span>
				</div>

				<div
					style={{ cursor: 'pointer' }}
					className={'italic text-gray-400'}
					onClick={() => `/tags/${post.tag}/posts/${post.id}` && navigate(`/tags/${post.tag}/posts/${post.id}`)}
				>
					This post was deleted.
				</div>

				<div className="mt-2 flex w-full text-sm">
					<Link to={`/tags/${post.tag}/posts/${post.id}`} className="ml-2">
						<CommentIcon needsVote={false} nReplies={post.nReplies} />
					</Link>
				</div>
			</div>
		</div>
	)
}