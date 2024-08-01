import prisma from 'lib/prisma'
import { User } from '@prisma/client'

const serializeUser = (user) => {
  return {
    ...user,
    id: user.id.toString(), // Convert BigInt to string
  };
};

export async function createUser(data: Partial<User>) {
  try {
    console.log('Creating user with data:', data);
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        ...data,
        gmailAccessToken: data.gmailAccessToken || undefined,
      },
      create: {
        ...data,
        gmailAccessToken: data.gmailAccessToken || null,
      } as User
    });
    console.log('User created or updated:', serializeUser(user));
    return serializeUser(user);
  } catch (error) {
    console.error('Error creating or updating user:', error);
    throw error;
  }
}

export async function getUserById({
  id,
  clerkUserId
}: {
  id?: string
  clerkUserId?: string
}) {
  try {
    if (!id && !clerkUserId) {
      throw new Error('id or clerkUserId is required')
    }

    const query = id ? { id: BigInt(id) } : { clerkUserId }

    const user = await prisma.user.findUnique({
      where: query
    })
    return { user: user ? serializeUser(user) : null }
  } catch (error) {
    console.error('Error fetching user:', error)
    return { error: error instanceof Error ? error : new Error('Unknown error occurred') }
  }
}

export async function updateUser(clerkUserId: string, data: Partial<User>) {
  try {
    console.log(`Attempting to update user with clerkUserId: ${clerkUserId}`);
    console.log('Update data:', data);

    const user = await prisma.user.update({
      where: { clerkUserId },
      data
    });

    console.log('User updated successfully:', user);
    return { user: serializeUser(user) };
  } catch (error) {
    console.error('Error updating user:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error occurred') };
  }
}

export async function softDeleteUser(clerkUserId: string) {
  try {
    const user = await prisma.user.update({
      where: { clerkUserId },
      data: { deletedAt: new Date() }
    })
    return { user: serializeUser(user) }
  } catch (error) {
    return { error }
  }
}