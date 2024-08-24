import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import prisma from 'lib/prisma';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  console.log("Health analysis API route called");
  try {
    const { userId } = auth();
    if (!userId) {
      console.log("Unauthorized request to health analysis");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create a new task in the database
    let task;
    try {
      task = await prisma.task.create({
        data: {
          userId,
          status: 'processing',
        },
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Spawn the Python script as a background process
    const python = spawn('python', ['backend/chatbot.py', userId, 'health_analysis']);

    python.stdout.on('data', async (data) => {
      const output = data.toString().trim();
      console.log('Python script output:', output);
      
      if (output.includes('HEALTH_ANALYSIS_START') && output.includes('HEALTH_ANALYSIS_END')) {
        const healthAnalysis = output.split('HEALTH_ANALYSIS_START\n')[1].split('\nHEALTH_ANALYSIS_END')[0];
        try {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'success',
              result: healthAnalysis,
            },
          });
        } catch (updateError) {
          console.error('Error updating task:', updateError);
        }
      }
    });

    python.stderr.on('data', (data) => {
      console.log('Python script log:', data.toString());
    });

    python.on('close', async (code) => {
      console.log(`Python script exited with code ${code}`);
      if (code !== 0) {
        try {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'error',
              result: `Process exited with code ${code}`,
            },
          });
        } catch (updateError) {
          console.error('Error updating task:', updateError);
        }
      }
    });

    return NextResponse.json({ taskId: task.id, message: 'Health analysis generation started' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred while processing the request' }, { status: 500 });
  }
}