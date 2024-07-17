'use client';

import { UserProfile } from '@clerk/nextjs';
import { useEffect } from 'react';
import { fetchAndStoreGmailToken } from '../utils/fetchGmailToken';

const ProfilePage = () => {
  useEffect(() => {
    const fetchToken = async () => {
      try {
        await fetchAndStoreGmailToken();
      } catch (error) {
        // Handle error (e.g., show a notification to the user)
        console.error('Failed to fetch Gmail token:', error);
      }
    };

    fetchToken();
  }, []);

  return (
    <>
      <UserProfile />
    </>
  );
};

export default ProfilePage;