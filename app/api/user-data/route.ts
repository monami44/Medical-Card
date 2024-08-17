import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from 'lib/users';
import { decryptData } from 'lib/encryption';
import { supabaseClient } from 'utils/supabaseClient';

export async function GET(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  try {
    const { user, error } = await getUserById({ clerkUserId: userId });

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json({ error: `Failed to fetch user: ${error.message}` }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = supabaseClient();
    const { data: encryptedData, error: fetchError } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching encrypted data:', fetchError);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    if (!encryptedData) {
      return NextResponse.json({ data: null });
    }

    console.log('Attempting to decrypt data');
    const decryptedData = decryptData(encryptedData.data, user.encryptedUserKey);
    console.log('Data decrypted successfully');

    return NextResponse.json({ data: JSON.parse(decryptedData) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}