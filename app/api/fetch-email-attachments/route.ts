import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'Missing userId or password' }, { status: 400 });
    }

    const { stdout, stderr } = await execAsync(`python backend/get_email.py ${userId} ${password}`);
    
    if (stderr) {
      console.log('Python script output:', stderr);
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (parseError) {
      console.error('Error parsing Python script output:', stdout);
      return NextResponse.json({ error: 'Invalid output from Python script' }, { status: 500 });
    }

    if (result.error) {
      console.error('Python script returned an error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}