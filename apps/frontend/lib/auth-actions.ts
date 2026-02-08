'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { signToken, verifyToken, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { loginInputSchema, emailSchema, changePasswordSchema, signupInputSchema } from '@/lib/schemas'

export interface LoginState {
  error?: string
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const returnUrl = formData.get('returnUrl') as string || '/'

  // Validate with Zod
  const result = loginInputSchema.safeParse({ email, password })

  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError.message }
  }

  try {
    // Call PostgREST login endpoint
    const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login_email: result.data.email,
        login_password: result.data.password,
      }),
    })

    if (!postgrestResponse.ok) {
      if (postgrestResponse.status === 401 || postgrestResponse.status === 400) {
        return { error: 'Fel e-post eller lösenord' }
      }
      return { error: 'Inloggning misslyckades' }
    }

    const user = await postgrestResponse.json()

    // Sign JWT with user's email, name, and role
    const token = await signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Set httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Redirect on success - this throws so won't return
    redirect(returnUrl)
  } catch (error) {
    // Re-throw redirect errors
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    return { error: 'Ett fel uppstod vid inloggning' }
  }
}

export interface ResetPasswordState {
  error?: string
  success?: boolean
}

export async function requestPasswordReset(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const email = formData.get('email') as string

  // Validate email with Zod
  const result = emailSchema.safeParse({ email })

  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError.message }
  }

  try {
    // Get the app URL for the reset link
    const appUrl = env.APP_URL || 'http://localhost:3000'

    // Call PostgREST RPC function directly
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/request_password_reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_email: result.data.email,
          p_app_url: appUrl,
        }),
      }
    )

    if (!postgrestResponse.ok) {
      // Log error for debugging but don't expose details to client
      console.error(
        'Password reset request failed:',
        await postgrestResponse.text()
      )
    }

    // Always return success for security (don't reveal if email exists)
    return { success: true }
  } catch (error) {
    console.error('Password reset error:', error)
    // Still return success for security
    return { success: true }
  }
}

export interface ChangePasswordState {
  error?: string
  success?: boolean
}

export interface SignupState {
  error?: string
}

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const returnUrl = formData.get('returnUrl') as string || '/'

  // Validate with Zod
  const result = signupInputSchema.safeParse({ name, email, password, confirmPassword })

  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError.message }
  }

  try {
    // Call PostgREST signup endpoint
    const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_name: result.data.name,
        p_email: result.data.email,
        p_password: result.data.password,
        p_provider: null,
      }),
    })

    if (!postgrestResponse.ok) {
      const errorText = await postgrestResponse.text()

      if (postgrestResponse.status === 400) {
        // Check for common error messages
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          return { error: 'E-postadressen är redan registrerad' }
        }
        if (errorText.includes('password') || errorText.includes('lösenord')) {
          return { error: 'Lösenordet uppfyller inte kraven: minst 8 tecken, en versal, en gemen och en siffra' }
        }
      }

      return { error: 'Registrering misslyckades' }
    }

    const user = await postgrestResponse.json()

    // Sign JWT with user's email, name, and role
    const token = await signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Set httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Redirect on success - this throws so won't return
    redirect(returnUrl)
  } catch (error) {
    // Re-throw redirect errors
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    return { error: 'Ett fel uppstod vid registrering' }
  }
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const oldPassword = formData.get('oldPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmNewPassword = formData.get('confirmNewPassword') as string

  // Validate with Zod
  const result = changePasswordSchema.safeParse({ oldPassword, newPassword, confirmNewPassword })

  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError.message }
  }

  try {
    // Get the auth token and extract email
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return { error: 'Du måste vara inloggad' }
    }

    const payload = await verifyToken(authToken)
    if (!payload?.email) {
      return { error: 'Ogiltig session' }
    }

    // Create PostgREST token
    const postgrestToken = await signPostgrestToken(payload.email)

    // Call PostgREST reset_password endpoint
    const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/reset_password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${postgrestToken}`,
      },
      body: JSON.stringify({
        p_email: payload.email,
        p_old_password: result.data.oldPassword,
        p_new_password: result.data.newPassword,
      }),
    })

    if (!postgrestResponse.ok) {
      const errorText = await postgrestResponse.text()
      console.error('Password change failed:', errorText)

      // Parse PostgREST error to get the error code
      try {
        const errorJson = JSON.parse(errorText)
        const errorCode = errorJson.code || errorJson.message

        if (errorCode === 'invalid-credentials' || errorText.includes('invalid-credentials')) {
          return { error: 'Fel nuvarande lösenord' }
        }
        if (errorCode === 'password-not-meet-requirements' || errorText.includes('password-not-meet-requirements')) {
          return { error: 'Nytt lösenord uppfyller inte kraven' }
        }
      } catch {
        // If we can't parse the error, fall through to generic message
      }

      return { error: 'Kunde inte byta lösenord' }
    }

    return { success: true }
  } catch (error) {
    console.error('Password change error:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}

export interface DeleteAccountState {
  error?: string
  success?: boolean
}

export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const password = formData.get('password') as string | null

  try {
    // Get the auth token and extract email
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return { error: 'Du måste vara inloggad' }
    }

    const payload = await verifyToken(authToken)
    if (!payload?.email) {
      return { error: 'Ogiltig session' }
    }

    // Create PostgREST token
    const postgrestToken = await signPostgrestToken(payload.email)

    // Call PostgREST delete_account endpoint
    const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/delete_account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${postgrestToken}`,
      },
      body: JSON.stringify({
        p_password: password || null,
        p_delete_data: false,
      }),
    })

    if (!postgrestResponse.ok) {
      let errorMessage = 'Ett fel uppstod vid radering av konto'

      try {
        const errorData = await postgrestResponse.json()
        const dbMessage = errorData?.message || ''

        if (dbMessage.includes('not-authenticated')) {
          errorMessage = 'Ej autentiserad'
        } else if (dbMessage.includes('user-not-found')) {
          errorMessage = 'Användaren hittades inte'
        } else if (dbMessage.includes('invalid-password')) {
          errorMessage = 'Fel lösenord'
        } else if (dbMessage.includes('password-required')) {
          errorMessage = 'Lösenord krävs'
        }
      } catch {
        // If parsing fails, use default error message
      }

      return { error: errorMessage }
    }

    // Clear the auth cookie on success
    cookieStore.delete('auth-token')

    return { success: true }
  } catch (error) {
    console.error('Account deletion error:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}
