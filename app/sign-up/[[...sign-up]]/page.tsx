import React from 'react';
import { SignUp } from '@clerk/nextjs';
import { createUserAndStoreKey } from '@/utils/chartUtils';

const SignUpPage: React.FC = () => {
  const handleSignUpComplete = async (user: any) => {
    try {
      // Assuming the user object contains the necessary information
      await createUserAndStoreKey(user.id, user.password);
      // You might want to redirect the user or show a success message here
    } catch (error) {
      console.error('Failed to create user and store key:', error);
      // Handle error (e.g., show an error message to the user)
    }
  };

  return (
    <>
      <SignUp afterSignUpUrl="/dashboard" />
    </>
  );
};

export default SignUpPage;