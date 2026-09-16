export const getAuthFriendlyError = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.includes('Firebase is not configured')) {
      return 'Sign-in is not configured yet. Please contact an administrator.'
    }

    if (error.message.includes('auth/invalid-credential')) {
      return 'The email address or password is incorrect.'
    }

    if (error.message.includes('auth/email-already-in-use')) {
      return 'An account already exists for this email address.'
    }
  }

  console.log('Unhandled auth error:', error)

  return 'Something went wrong. Please try again.'
}
