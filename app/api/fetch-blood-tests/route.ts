import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout, stderr } = await execAsync('python backend/get_email.py');
    if (stderr) {
      console.error('Error:', stderr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const data = JSON.parse(stdout);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}