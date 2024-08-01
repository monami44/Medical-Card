import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { storeSaltInSupabase } from '@/utils/encryption';

export async function POST(req: Request) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const { salt, password } = await req.json();
    console.log('Received salt:', salt);
    console.log('Received password:', password ? '[REDACTED]' : 'undefined');
    
    await storeSaltInSupabase(userId, new Uint8Array(Object.values(salt)));
    return NextResponse.json({ message: "Encryption setup successful" }, { status: 200 });
  } catch (error) {
    console.error('Error setting up encryption:', error);
    return NextResponse.json({ 
      error: 'Failed to set up encryption', 
      details: error.message, 
      stack: error.stack,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
    }, { status: 500 });
  }
}