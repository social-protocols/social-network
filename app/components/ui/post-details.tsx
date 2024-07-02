import { useNavigate } from '@remix-run/react'
import type * as Immutable from 'immutable'
import { type Map } from 'immutable'
import { type Dispatch, type SetStateAction } from 'react'
import {
	Direction,
	type ImmutableReplyTree,
	type CommentTreeState,
	type Post,
} from '#app/types/api-types.ts'
import { invariant } from '#app/utils/misc.tsx'
import { PostActionBar } from './post-action-bar.tsx'
import { PostContent } from './post-content.tsx'
import { PostInfoBar } from './post-info-bar.tsx'
import { VoteButtons } from './vote-buttons.tsx'

/* Keep this relatively high, so people don't often have to click "read more"
   to read most content. But also not too high, so people don't have to
   scroll past big walls of text of posts they are not interested in */
const postTeaserMaxLines = 20

export function PostDetails({
	post,
	teaser,
	loggedIn,
	voteHereIndicator,
	className,
	focussedPostId,
	pathFromFocussedPost,
	commentTreeState,
	setCommentTreeState,
	isCollapsedState,
	setIsCollapsedState,
	onReplySubmit,
	onCollapseParentSiblings,
}: {
	post: Post
	teaser: boolean
	loggedIn: boolean
	voteHereIndicator?: boolean
	className?: string
	focussedPostId: number
	pathFromFocussedPost: Immutable.List<number>
	commentTreeState: CommentTreeState
	setCommentTreeState: Dispatch<SetStateAction<CommentTreeState>>
	isCollapsedState?: Immutable.Map<number, boolean>
	setIsCollapsedState?: Dispatch<SetStateAction<Map<number, boolean>>>
	onReplySubmit: (reply: ImmutableReplyTree) => void
	onCollapseParentSiblings: (
		pathFromFocussedPost: Immutable.List<number>,
	) => void
}) {
	voteHereIndicator = voteHereIndicator ?? false

	const postState = commentTreeState.posts[post.id]
	invariant(
		postState !== undefined,
		`post ${post.id} not found in commentTreeState`,
	)

	const currentVoteState = postState.voteState
	const needsVoteOnCriticalComment: boolean =
		currentVoteState.vote !== Direction.Neutral && !currentVoteState.isInformed

	const isCollapsed = isCollapsedState?.get(post.id) || false

	const navigate = useNavigate()

	const marginLeft = loggedIn ? 'ml-[40px]' : 'ml-2'

	const isDeleted = postState.isDeleted

	return (
		<div className={'flex w-full ' + (className ? className : '')}>
			{isCollapsed ? (
				<div className={'flex ' + marginLeft}>
					<PostInfoBar
						post={post}
						postState={postState}
						pathFromFocussedPost={pathFromFocussedPost}
						isConvincing={false}
						voteHereIndicator={voteHereIndicator}
						isCollapsedState={isCollapsedState}
						setIsCollapsedState={setIsCollapsedState}
						onCollapseParentSiblings={onCollapseParentSiblings}
					/>
				</div>
			) : (
				<>
					<div style={{ display: loggedIn ? 'block' : 'none' }}>
						<VoteButtons
							postId={post.id}
							focussedPostId={focussedPostId}
							needsVoteOnCriticalComment={needsVoteOnCriticalComment}
							commentTreeState={commentTreeState}
							setCommentTreeState={setCommentTreeState}
						/>
					</div>
					<div
						className={
							'ml-2 flex w-full min-w-0 flex-col' +
							(teaser ? ' postteaser' : '')
						}
					>
						<PostInfoBar
							post={post}
							postState={postState}
							pathFromFocussedPost={pathFromFocussedPost}
							isConvincing={false}
							voteHereIndicator={voteHereIndicator}
							isCollapsedState={isCollapsedState}
							setIsCollapsedState={setIsCollapsedState}
							onCollapseParentSiblings={onCollapseParentSiblings}
						/>
						{!isDeleted ? (
							<PostContent
								content={post.content}
								maxLines={teaser ? postTeaserMaxLines : undefined}
								deactivateLinks={false}
								linkTo={`/post/${post.id}`}
							/>
						) : (
							<div
								style={{ cursor: 'pointer' }}
								className={'italic text-gray-400'}
								onClick={() =>
									`/post/${post.id}` && navigate(`/post/${post.id}`)
								}
							>
								This post was deleted.
							</div>
						)}
						<PostActionBar
							post={post}
							focussedPostId={focussedPostId}
							loggedIn={loggedIn}
							isDeleted={isDeleted}
							setCommentTreeState={setCommentTreeState}
							onReplySubmit={onReplySubmit}
						/>
					</div>
				</>
			)}
		</div>
	)
}
