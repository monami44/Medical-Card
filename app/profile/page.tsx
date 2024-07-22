'use client';

import React, { useEffect } from 'react';
import { UserProfile } from '@clerk/nextjs';
import { fetchAndStoreGmailToken } from '../utils/fetchGmailToken';

const ProfilePage: React.FC = () => {
  useEffect(() => {
    const fetchToken = async (): Promise<void> => {
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