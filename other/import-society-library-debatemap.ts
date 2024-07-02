import fs from 'fs'
import { db } from '#app/db.ts'
import { createPost } from '../app/repositories/post.ts'
import { invariant } from '../app/utils/misc.tsx'

// Filename is first commandline argument
// const debateFilename = 'society-library-openai-debatemap.json'
const debateFilename = process.argv[2]
invariant(debateFilename !== undefined, 'missing filename argument')
console.log('debateFilename:', debateFilename)

const withUpvote = false

var topLevelQuestion: Question = JSON.parse(
	fs.readFileSync(debateFilename, 'utf-8'),
) as Question

const username: string = (() => {
	const id = process.argv[3]
	invariant(id, 'no userId provided')
	return id
})()
console.log('author username: ', username)

const userId = await db.transaction().execute(async trx => {
	const user = await trx
		.selectFrom('User')
		.select('id')
		.where('username', '=', username)
		.executeTakeFirstOrThrow()
	return user.id
})

console.log('Got debate map for question', topLevelQuestion)

const postId = await importQuestion(topLevelQuestion)

console.log('Imported debate map. Root post-id = ', postId)

// type Node = Question | Category | Claim

type Question = {
	question: string
	positions: Position[]
}
type Position = {
	position: string
	categories: Category[]
}
type Category = {
	claims: Claim[]
}
type Claim = {
	claim: string
	examples: Example[]
	counter_claims: string[]
}
type Example = {
	original_example: string
	evidence: Evidence[]
}
type Evidence = {
	quote: string
	url: string
	reasoning: string
}

function removePrefix(wording: string, prefix: string) {
	if (wording.startsWith(prefix)) {
		return wording.slice(prefix.length)
	}
	return wording
}

async function importQuestion(question: Question): Promise<number> {
	let wording = removePrefix(question.question, '[question] ')

	const postId = await db.transaction().execute(async trx => {
		return await createPost(trx, null, wording, userId, {
			isPrivate: true,
			withUpvote: withUpvote,
		})
	})
	console.log(`Inserted question. post ${postId}: ${wording}`)

	for (const position of question.positions) {
		await importPosition(postId, position)
	}

	return postId
}

async function importPosition(parentId: number, position: Position) {
	let wording = removePrefix(position.position, '[position] ')

	const postId = await db.transaction().execute(async trx => {
		return await createPost(trx, parentId, wording, userId, {
			isPrivate: true,
			withUpvote: withUpvote,
		})
	})
	console.log(`Inserted position. post ${postId}: ${wording}`)

	for (const category of position.categories) {
		await importCategory(postId, category)
	}
}

async function importCategory(parentId: number, category: Category) {
	for (const claim of category.claims) {
		await importClaim(parentId, claim)
	}
}

async function importClaim(parentId: number, claim: Claim) {
	let wording = removePrefix(claim.claim, '[for reasons like] ')

	const postId = await db.transaction().execute(async trx => {
		return await createPost(trx, parentId, wording, userId, {
			isPrivate: true,
			withUpvote: withUpvote,
		})
	})
	console.log(`Inserted claim. post ${postId}: ${wording}`)

	for (const example of claim.examples) {
		await importExample(postId, example)
	}
	for (const counterClaim of claim.counter_claims) {
		await importCounterClaim(postId, counterClaim)
	}
}

async function importExample(parentId: number, example: Example) {
	let wording = removePrefix(example.original_example, '[original example] ')

	const postId = await db.transaction().execute(async trx => {
		return await createPost(trx, parentId, wording, userId, {
			isPrivate: true,
			withUpvote: withUpvote,
		})
	})
	console.log(`Inserted example. post ${postId}: ${wording}`)

	for (const evidence of example.evidence) {
		await importEvidence(postId, evidence)
	}
}

async function importEvidence(parentId: number, evidence: Evidence) {
	const postId = await db.transaction().execute(async trx => {
		return await createPost(
			trx,
			parentId,
			`
> ${evidence.quote}

${evidence.url} 

${evidence.reasoning}
			`,
			userId,
			{ isPrivate: true, withUpvote: withUpvote },
		)
	})

	console.log(
		`Inserted evidence. post ${postId}: ${evidence.quote} ${evidence.url} ${evidence.reasoning}`,
	)
}

async function importCounterClaim(parentId: number, counterClaim: string) {
	const wording = removePrefix(
		counterClaim,
		'[Those who disagree with this point might reason] ',
	)

	const postId = await db.transaction().execute(async trx => {
		return await createPost(trx, parentId, wording, userId, {
			isPrivate: true,
			withUpvote: withUpvote,
		})
	})
	console.log(`Inserted counter claim. post ${postId}: ${wording}`)
}
