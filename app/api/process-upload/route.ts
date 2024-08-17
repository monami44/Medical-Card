import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { exec } from "child_process";
import { promisify } from "util";
import { getUserById } from 'lib/users';
import { encryptData } from 'lib/encryption';


const execAsync = promisify(exec);

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

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64FileData = fileBuffer.toString('base64');
    const { stdout, stderr } = await execAsync(`python backend/get_email.py "${file.name}" "${base64FileData}"`);

    if (stderr) {
      console.error('Python script error:', stderr);
      return NextResponse.json({ error: "Error processing file" }, { status: 500 });
    }

    // Parse the output from the Python script
    const processedData = JSON.parse(stdout);

    // Check if there are blood test results
    if (!processedData.bloodTestResults || processedData.bloodTestResults.length === 0) {
      console.log('No blood test results to encrypt');
      return NextResponse.json({ message: 'No blood test results found' }, { status: 200 });
    }

    // Encrypt the processed data and raw attachments
    const encryptedBloodTestResults = encryptData(JSON.stringify(processedData.bloodTestResults), user.encryptedUserKey);

    const encryptedAttachments = processedData.rawAttachments.map(attachment => ({
      filename: attachment.filename,
      data: encryptData(attachment.data, user.encryptedUserKey),
      testDate: attachment.testDate
    }));

    // Return the encrypted data to the client
    return NextResponse.json({
      bloodTestResults: encryptedBloodTestResults,
      rawAttachments: encryptedAttachments
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}