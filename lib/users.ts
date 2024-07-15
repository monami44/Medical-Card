import prisma from 'lib/prisma'
import { User } from '@prisma/client'

export async function createUser(data: User) {
  try {
    const user = await prisma.user.create({ data })
    return { user }
  } catch (error) {
    return { error }
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

    const query = id ? { id } : { clerkUserId }

    const user = await prisma.user.findFirst({
      where: {
        ...query,
        deletedAt: null // Only fetch non-deleted users
      }
    })
    return { user }
  } catch (error) {
    return { error }
  }
}

export async function UpdateUser(id: string, data: Partial<User>) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data
    })
    return { user }
  } catch (error) {
    return { error }
  }
}

export async function softDeleteUser(clerkUserId: string) {
  try {
    const user = await prisma.user.update({
      where: { clerkUserId },
      data: { deletedAt: new Date() }
    })
    return { user }
  } catch (error) {
    return { error }
  }
}