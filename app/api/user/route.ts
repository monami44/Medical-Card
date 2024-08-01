import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from 'lib/users';
import redis from 'lib/redis';

export async function GET(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  try {
    // Check Redis cache first
    const cachedUser = await redis.get(`user:${userId}`);
    if (typeof cachedUser === 'string') {
      return NextResponse.json({ user: JSON.parse(cachedUser) });
    }

    const { user, error } = await getUserById({ clerkUserId: userId });

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json({ error: `Failed to fetch user: ${error.message}` }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cache the user data in Redis
    await redis.set(`user:${userId}`, JSON.stringify(user), { ex: 3600 }); // Cache for 1 hour

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}