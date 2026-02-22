import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setCookie, deleteCookie } from '@tanstack/react-start/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { loginInputSchema, emailSchema, changePasswordSchema, signupInputSchema } from '@/lib/schemas'
import { actionAuthMiddleware } from './middleware'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'auth' })

export interface LoginState {
  error?: string
}

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string(), password: z.string(), returnUrl: z.string().optional() }))
  .handler(async ({ data }): Promise<LoginState> => {
    const result = loginInputSchema.safeParse({
      email: data.email,
      password: data.password,
    })

    if (!result.success) {
      const firstError = result.error.issues[0]
      return { error: firstError.message }
    }

    try {
      const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const token = await signToken({
        email: user.email,
        name: user.name,
        role: user.role,
      })

      setCookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return {}
    } catch {
      return { error: 'Ett fel uppstod vid inloggning' }
    }
  })

export interface ResetPasswordState {
  error?: string
  success?: boolean
}

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string() }))
  .handler(async ({ data }): Promise<ResetPasswordState> => {
    const result = emailSchema.safeParse({ email: data.email })

    if (!result.success) {
      const firstError = result.error.issues[0]
      return { error: firstError.message }
    }

    try {
      const appUrl = env.APP_URL || 'http://localhost:3000'

      const postgrestResponse = await fetch(
        `${env.POSTGREST_URL}/rpc/request_password_reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_email: result.data.email,
            p_app_url: appUrl,
          }),
        },
      )

      if (!postgrestResponse.ok) {
        logger.error(
          { responseBody: await postgrestResponse.text() },
          'Password reset request failed',
        )
      }

      return { success: true }
    } catch (error) {
      logger.error({ err: error instanceof Error ? error : String(error) }, 'Password reset error')
      return { success: true }
    }
  })

export interface CompleteResetPasswordState {
  error?: string
  success?: boolean
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESET_ERROR_MESSAGES: Record<string, string> = {
  'invalid-or-expired-token':
    'Ogiltig eller utgången återställningslänk. Begär en ny.',
  'password-not-meet-requirements':
    'Lösenordet måste vara minst 8 tecken och innehålla versaler, gemener och siffror',
}

export const completeResetPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string(), password: z.string() }))
  .handler(async ({ data }): Promise<CompleteResetPasswordState> => {
    try {
      if (!data.token || !UUID_REGEX.test(data.token)) {
        return { error: 'Ogiltig eller saknad token' }
      }

      if (!data.password) {
        return { error: 'Lösenord är obligatoriskt' }
      }

      const postgrestResponse = await fetch(
        `${env.POSTGREST_URL}/rpc/complete_password_reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_token: data.token,
            p_new_password: data.password,
          }),
        },
      )

      if (!postgrestResponse.ok) {
        let errorData: { code?: string; message?: string } | null = null
        try {
          errorData = await postgrestResponse.json()
        } catch {
          logger.error(
            { status: postgrestResponse.status },
            'Password reset completion failed with non-JSON response',
          )
          return { error: 'Kunde inte återställa lösenordet' }
        }

        logger.error({ detail: errorData }, 'Password reset completion failed')

        if (errorData?.message && errorData.message in RESET_ERROR_MESSAGES) {
          return { error: RESET_ERROR_MESSAGES[errorData.message] }
        }

        return { error: 'Kunde inte återställa lösenordet' }
      }

      return { success: true }
    } catch (error) {
      logger.error({ err: error instanceof Error ? error : String(error) }, 'Password reset completion error')
      return { error: 'Ett fel uppstod' }
    }
  })

export interface SignupState {
  error?: string
}

export const signupFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string(), email: z.string(), password: z.string(), confirmPassword: z.string(), returnUrl: z.string().optional() }))
  .handler(async ({ data }): Promise<SignupState> => {
    const result = signupInputSchema.safeParse({
      name: data.name,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    })

    if (!result.success) {
      const firstError = result.error.issues[0]
      return { error: firstError.message }
    }

    try {
      const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const token = await signToken({
        email: user.email,
        name: user.name,
        role: user.role,
      })

      setCookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return {}
    } catch {
      return { error: 'Ett fel uppstod vid registrering' }
    }
  })

export interface ChangePasswordState {
  error?: string
  success?: boolean
}

export const changePasswordFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ oldPassword: z.string(), newPassword: z.string(), confirmNewPassword: z.string() }))
  .middleware([actionAuthMiddleware])
  .handler(async ({ data, context }): Promise<ChangePasswordState> => {
    const result = changePasswordSchema.safeParse({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
      confirmNewPassword: data.confirmNewPassword,
    })

    if (!result.success) {
      const firstError = result.error.issues[0]
      return { error: firstError.message }
    }

    try {
      if (!context.postgrestToken || !context.session?.email) {
        return { error: 'Du måste vara inloggad' }
      }

      const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/reset_password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.postgrestToken}`,
        },
        body: JSON.stringify({
          p_email: context.session.email,
          p_old_password: result.data.oldPassword,
          p_new_password: result.data.newPassword,
        }),
      })

      if (!postgrestResponse.ok) {
        const errorText = await postgrestResponse.text()
        logger.error({ responseBody: errorText, email: context.session?.email }, 'Password change failed')

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
      logger.error({ err: error instanceof Error ? error : String(error), email: context.session?.email }, 'Password change error')
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

export interface LogoutState {
  error?: string
}

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async (): Promise<LogoutState> => {
    try {
      deleteCookie('auth-token')
      return {}
    } catch {
      return { error: 'Utloggning misslyckades' }
    }
  })

export interface DeleteAccountState {
  error?: string
  success?: boolean
}

export const deleteAccountFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ password: z.string().optional(), deleteData: z.boolean().optional() }))
  .middleware([actionAuthMiddleware])
  .handler(async ({ data, context }): Promise<DeleteAccountState> => {
    try {
      if (!context.postgrestToken || !context.session?.email) {
        return { error: 'Du måste vara inloggad' }
      }

      const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/delete_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.postgrestToken}`,
        },
        body: JSON.stringify({
          p_password: data.password || null,
          p_delete_data: data.deleteData ?? false,
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

      deleteCookie('auth-token')

      return { success: true }
    } catch (error) {
      logger.error({ err: error instanceof Error ? error : String(error), email: context.session?.email }, 'Account deletion error')
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

