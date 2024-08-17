import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from 'lib/users';
import { decryptData } from 'lib/encryption';

export async function POST(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  try {
    const { user, error } = await getUserById({ clerkUserId: userId });

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { encryptedData } = await req.json();

    if (!encryptedData) {
      return NextResponse.json({ error: "No encrypted data provided" }, { status: 400 });
    }

    const decryptedData = decryptData(encryptedData, user.encryptedUserKey);

    return NextResponse.json({ data: decryptedData });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}