import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message } = await req.json();

  return new Promise((resolve) => {
    const python = spawn('python', ['backend/chatbot.py', userId, message]);

    let botResponse = '';

    python.stdout.on('data', (data) => {
      botResponse += data.toString();
    });

    python.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
    });

    python.on('close', (code) => {
      console.log(`Child process exited with code ${code}`);
      resolve(NextResponse.json({ message: botResponse.trim() }));
    });
  });
}