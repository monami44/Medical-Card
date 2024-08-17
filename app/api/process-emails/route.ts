import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { exec } from "child_process";
import { promisify } from "util";
import { getUserById } from 'lib/users';
import { encryptData } from 'lib/encryption';

const execAsync = promisify(exec);

export async function POST() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  try {
    const { user, error } = await getUserById({ clerkUserId: userId });

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Execute the Python script with the user ID
    const { stdout, stderr } = await execAsync(`python backend/get_email.py ${user.id}`);

    if (stderr) {
      console.error('Python script error:', stderr);
      return NextResponse.json({ error: "Error processing emails" }, { status: 500 });
    }

    // Parse the output from the Python script
    const processedData = JSON.parse(stdout);
    console.log('Processed data from Python script:', processedData);

    // Encrypt the processed data and raw attachments
    try {
      if (!processedData.bloodTestResults || processedData.bloodTestResults.length === 0) {
        console.log('No blood test results to encrypt');
        return NextResponse.json({ message: 'No blood test results found' }, { status: 200 });
      }

      console.log('Encrypting blood test results:', JSON.stringify(processedData.bloodTestResults).substring(0, 200));
      const encryptedBloodTestResults = encryptData(JSON.stringify(processedData.bloodTestResults), user.encryptedUserKey);

      const encryptedAttachments = processedData.rawAttachments.map(attachment => ({
        filename: attachment.filename,
        data: encryptData(attachment.data, user.encryptedUserKey),
        testDate: attachment.testDate // Added this line
      }));

      // Return the encrypted data to the client
      return NextResponse.json({
        bloodTestResults: encryptedBloodTestResults,
        rawAttachments: encryptedAttachments
      });
    } catch (encryptionError) {
      console.error('Encryption error:', encryptionError);
      return NextResponse.json({ error: 'Error encrypting data' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}