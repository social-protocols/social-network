import type * as Immutable from 'immutable'
import moment from 'moment'
import { useRef, type Dispatch, type SetStateAction } from 'react'
import { type PostState, type Post } from '#app/types/api-types.ts'
import { Icon } from './icon.tsx'

export function PostInfoBar({
	post,
	postState,
	pathFromFocussedPost,
	isConvincing,
	voteHereIndicator,
	isCollapsedState,
	setIsCollapsedState,
	onCollapseParentSiblings,
}: {
	post: Post
	postState: PostState
	pathFromFocussedPost: Immutable.List<number>
	isConvincing: boolean
	voteHereIndicator: boolean
	isCollapsedState?: Immutable.Map<number, boolean>
	setIsCollapsedState?: Dispatch<SetStateAction<Immutable.Map<number, boolean>>>
	onCollapseParentSiblings: (
		pathFromFocussedPost: Immutable.List<number>,
	) => void
}) {
	const ageString = moment(post.createdAt).fromNow()

	const isCollapsed = isCollapsedState?.get(post.id) || false

	function toggleCollapse() {
		if (isCollapsedState && setIsCollapsedState) {
			let newisCollapsedState = isCollapsedState.set(post.id, !isCollapsed)
			setIsCollapsedState(newisCollapsedState)
		}
	}

	const myRef = useRef<HTMLDivElement>(null)
	const scrollIntoView = () => {
		if (myRef.current) {
			myRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	return (
		<>
			<div className="flex w-full items-center space-x-2 text-sm sm:items-baseline">
				{isConvincing && (
					<span title="Convincing" className="">
						💡
					</span>
				)}
				<span className="opacity-50">{ageString}</span>
				<span className="opacity-50">-</span>
				<span className="opacity-50">{postState.voteCount} votes</span>
				{voteHereIndicator && (
					<span
						title="Take a position here to give your vote above more weight"
						className="rounded bg-blue-100 px-1 text-blue-500 dark:bg-[#2c333e] dark:text-[#7dcfff]"
					>
						Vote here
					</span>
				)}
				{isCollapsedState && (
					<>
						<button
							title={
								isCollapsed ? 'Expand this comment' : 'Collapse this comment'
							}
							className="text-[30px] sm:text-base"
							onClick={toggleCollapse}
						>
							{isCollapsed ? (
								<Icon name="plus-circled" />
							) : (
								<Icon name="minus-circled" />
							)}
						</button>
						<button
							title="Collapse unrelated comments"
							className="my-[-2px] text-[30px] sm:text-base"
							onClick={() => {
								onCollapseParentSiblings(pathFromFocussedPost)
								scrollIntoView()
							}}
						>
							<Icon name="target" />
						</button>
					</>
				)}
			</div>
		</>
	)
}
