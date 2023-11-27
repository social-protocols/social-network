
import { db } from "#app/db.ts";
import { type Post } from '#app/db/types.ts'; // this is the Database interface we defined earlier

import { Direction, vote } from "#app/vote.ts";

import { getOrInsertTagId } from './tag.ts';

import assert from 'assert';

import { logAuthorImpression } from './attention.ts'


// express the above fn in typescript with kysely queries
export async function createPost(
    tag: string,
    parentId: number | null,
    content: string,
    authorId: string,
): Promise<number> {
    const results: { id: number }[] = await db
        .insertInto('Post')
        .values({ content, parentId, authorId })
        .returning('id')
        .execute();

    const createdPostId = results[0].id;

    const tagId: number = await getOrInsertTagId(tag);
    const direction: Direction = Direction.Up;
    await vote(tag, authorId, createdPostId, null, direction);

    await logAuthorImpression(authorId, tagId, createdPostId)

    return createdPostId;
}

export async function getPost(id: number): Promise<Post> {

    let result: Post | undefined = await db.selectFrom('Post')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()

    assert(result != null)
    return result
}
