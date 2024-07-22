import { auth } from '@clerk/nextjs';

interface UserResponse {
  user: {
    gmailAccessToken: string;
  };
}

export const fetchAndStoreGmailToken = async (): Promise<string> => {
  console.log('Fetching stored Gmail token');
  try {
    const { getToken } = auth();
    const token = await getToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch('/api/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('Response received:', response.status);
    
    if (!response.ok) {
      const errorData: { error: string } = await response.json();
      throw new Error(`Failed to fetch stored Gmail token: ${response.status}. ${errorData.error}`);
    }
    
    const data: UserResponse = await response.json();
    console.log('Stored Gmail token fetched:', data);
    return data.user.gmailAccessToken;
  } catch (error) {
    console.error('Error fetching stored Gmail token:', error);
    throw error;
  }
};