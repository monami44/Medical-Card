import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { getUserById } from 'lib/users';
import { decryptData } from 'lib/encryption';

export async function POST(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  try {
    console.log('Fetching user data');
    const { user, error } = await getUserById({ clerkUserId: userId });

    if (error || !user) {
      console.error('User not found:', error);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log('User data fetched successfully');

    const { encryptedData } = await req.json();

    if (!encryptedData) {
      console.error('No encrypted data provided');
      return NextResponse.json({ error: "No encrypted data provided" }, { status: 400 });
    }

    console.log('Attempting to decrypt data');
    const decryptedData = decryptData(encryptedData, user.encryptedUserKey);
    console.log('Data decrypted successfully');

    // Log a sample of the decrypted data (be careful not to log sensitive information)
    const sampleData = JSON.parse(decryptedData);
    console.log('Sample of decrypted data:', 
      typeof sampleData === 'object' ? 
        JSON.stringify(sampleData).substring(0, 100) : 
        sampleData.substring(0, 100)
    );

    return NextResponse.json({ data: JSON.parse(decryptedData) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}