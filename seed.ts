import { createId } from '@paralleldrive/cuid2'
import { sql } from 'kysely'
import { logTagPageView, seedStats } from '#app/attention.ts'
import { db } from '#app/db.ts'
import { createPost } from '#app/post.ts'
import { getRankedPosts } from '#app/ranking.ts'

import { Direction, vote } from '#app/vote.ts'

export async function seed() {
	console.log('seeding...')
	// insert into user(idInt, username, email) values (100, "alice", "alice@test.com");
	// insert into user(idInt, username, email) values (101, "bob", "bob@test.com");
	let alice = '100'
	let bob = '101'
	let charlie = '102'

	await db
		.insertInto('User')
		.values({
			id: alice,
			username: 'alice',
			email: 'alice@test.com',
			// password: { create: createPassword('alice') },
		})
		.execute()

	await db
		.insertInto('User')
		.values({
			id: bob,
			username: 'bob',
			email: 'bob@test.com',
			// password: { create: createPassword('bob') },
		})
		.execute()

	await db
		.insertInto('User')
		.values({
			id: charlie,
			username: 'charlie',
			email: 'charlie@test.com',
			// password: { create: createPassword('charlie') },
		})
		.execute()

	// await seedStats()

	// First, alice creates a post
	const tag = 'global'
	let post1 = await createPost(
		tag,
		null,
		'So, pregnant people can’t cross state lines to get abortions but guys like Kyle Rittenhouse can cross state lines to murder people. Seems fair.',
		alice,
	)

	// Then, bob views the page
	const rankedPosts = await getRankedPosts(tag)
	logTagPageView(bob, tag, rankedPosts)

	// Then bob posts a response to alice's post
	let post2 = await createPost(
		tag,
		post1,
		'Kyle Rittenhouse was acquitted of murder charges. Clear video evidence showed he acted in self defense.',
		bob,
	)

	// And also downvotes (with their own post as a note -- this is an important detail)
	await vote(tag, bob, post1, post2, Direction.Down, null)

	// bob views home page
	await getRankedPosts(tag)
	logTagPageView(alice, tag, rankedPosts)

	// And responds to bob's response
	let post3 = await createPost(
		tag,
		post2,
		'That trial was a sham. They were never going to convict.',
		alice,
	)

	// And then creates another unrelated post
	let post4 = await createPost(
		tag,
		null,
		'Sudafed, Benadryl and most decongestants don’t work: FDA advisory panel https://trib.al/sJmOJBP',
		alice,
	)

	// Bob then views the page again
	await getRankedPosts(tag)
	logTagPageView(bob, tag, rankedPosts)

	// And respond's to Alices's latest post
	await createPost(
		tag,
		post4,
		'This is misleading. Regular Benadryl is an antihistamine; it is not a decongestant. There is a Benadryl branded product that is impacted. https://www.nbcnews.com/news/amp/rcna104424',
		bob,
	)

	// Alice post's again
	let post6 = await createPost(
		tag,
		null,
		"Right now, real wages for the average American worker is higher than it was before the pandemic, with lower wage workers seeing the largest gains. That's Bidenomics.",
		alice,
	)

	// Bob then views the page once again
	await getRankedPosts(tag)
	// console.log("Ranked posts", posts)
	logTagPageView(bob, tag, rankedPosts)

	// And respond's to Alice's third post
	let post7 = await createPost(
		tag,
		post6,
		"The tweet's claim about real wages contains a factual error. On 3/15/20 when US COVID lockdowns began real wages adjusted for inflation (AFI) were $11.15. As of 7/16/23 real wages AFI are $11.05. Real wages AFI remain lower (not higher) than before the pandemic.",
		bob,
	)
	await vote(tag, alice, post6, post7, Direction.Down, null)

	// agreed with 2 (shown 3)
	await vote(tag, charlie, post2, post3, Direction.Up, null)
	// changed mind after seeing 2
	await vote(tag, charlie, post1, post2, Direction.Down, null)
	// changed mind back (for no particular reason)
	await vote(tag, charlie, post1, post2, Direction.Up, null)

	// duplicate vote
	await vote(tag, charlie, post1, post2, Direction.Up, null)

	// changed mind back again
	await vote(tag, charlie, post1, post2, Direction.Down, null)

	// and toggles some other votes
	await vote(tag, charlie, post1, post2, Direction.Down, null)
	await vote(tag, charlie, post2, post3, Direction.Down, null)
	await vote(tag, charlie, post2, post3, Direction.Up, null)

	// Add a developer user and session ID that is already in my browser, so I remain logged in after I reseed the DB.
	await db
		.insertInto('User')
		.values({
			id: 'clptz40870002cdvq8rqkbfs5',
			username: 'developer',
			email: 'test@test.com',
			// password: { create: createPassword('jonathan') },
		})
		.execute()

	await sql`insert into session(id, expirationDate, createdAt, updatedAt, userId) values ('clptz40870001cdvqn4rnggxv', 1704471496999, 1701877981251, 1701877981251, 'clptz40870002cdvq8rqkbfs5')`.execute(
		db,
	)
}

seed().catch(e => {
	console.error(e)
	process.exit(1)
})
