/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../search-bar'

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}))

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPush.mockClear()
    // Reset search params
    mockSearchParams.delete('q')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('URL synchronization', () => {
    it('shows empty input when URL has no query param', () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('')
    })

    it('syncs input value with URL query param on mount', () => {
      mockSearchParams.set('q', 'test')

      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('test')
    })

    it('updates input value when URL changes (browser navigation)', async () => {
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('')

      // Simulate URL change (e.g., browser back button)
      mockSearchParams.set('q', 'updated-search')

      // Re-render to simulate the component receiving new searchParams
      rerender(<SearchBar />)

      expect(input).toHaveValue('updated-search')
    })

    it('does NOT sync URL to input when input is focused (user is typing)', async () => {
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('')

      // Focus the input (user starts typing)
      fireEvent.focus(input)

      // Simulate user typing something
      await act(async () => {
        fireEvent.change(input, { target: { value: 'user-typing' } })
      })

      expect(input).toHaveValue('user-typing')

      // Simulate URL change while focused (e.g., from a previous debounced search)
      mockSearchParams.set('q', 'different-value')
      rerender(<SearchBar />)

      // Input should KEEP the user's typed value, NOT sync from URL
      expect(input).toHaveValue('user-typing')
    })

    it('syncs URL to input when input is blurred (not focused)', async () => {
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('')

      // Focus, type, then blur
      fireEvent.focus(input)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'typed-value' } })
      })
      fireEvent.blur(input)

      expect(input).toHaveValue('typed-value')

      // Simulate URL change after blur (e.g., browser back button)
      mockSearchParams.set('q', 'url-value')
      rerender(<SearchBar />)

      // Input should sync from URL since it's not focused
      expect(input).toHaveValue('url-value')
    })

    it('handles browser back/forward navigation when input is unfocused', async () => {
      // Start with a URL query
      mockSearchParams.set('q', 'initial-search')
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('initial-search')

      // Simulate browser back to empty search
      mockSearchParams.delete('q')
      rerender(<SearchBar />)

      expect(input).toHaveValue('')

      // Simulate browser forward to the search
      mockSearchParams.set('q', 'initial-search')
      rerender(<SearchBar />)

      expect(input).toHaveValue('initial-search')

      // Simulate navigating to a different search in history
      mockSearchParams.set('q', 'other-search')
      rerender(<SearchBar />)

      expect(input).toHaveValue('other-search')
    })

    it('preserves user input during rapid URL changes when focused', async () => {
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')

      // User focuses and starts typing
      fireEvent.focus(input)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'my-search' } })
      })

      // Simulate multiple rapid URL changes (e.g., debounced updates)
      mockSearchParams.set('q', 'my')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Preserves user input

      mockSearchParams.set('q', 'my-s')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Still preserves user input

      mockSearchParams.set('q', 'my-search')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Still preserves user input

      // User blurs the input
      fireEvent.blur(input)

      // Now a URL change should sync
      mockSearchParams.set('q', 'external-change')
      rerender(<SearchBar />)
      expect(input).toHaveValue('external-change')
    })
  })

  describe('clearing search', () => {
    it('resets input value to empty string when clear button is clicked', async () => {
      mockSearchParams.set('q', 'existing-search')

      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('existing-search')

      // Find and click the clear button
      const clearButton = screen.getByRole('button', { name: /rensa/i })
      await act(async () => {
        fireEvent.click(clearButton)
      })

      expect(input).toHaveValue('')
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('does not show clear button when input is empty', () => {
      render(<SearchBar />)

      const clearButton = screen.queryByRole('button', { name: /rensa/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('shows clear button when input has value', () => {
      mockSearchParams.set('q', 'something')

      render(<SearchBar />)

      const clearButton = screen.getByRole('button', { name: /rensa/i })
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('debouncing', () => {
    it('updates input value immediately when typing', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'p' } })
      })

      // Input should update immediately
      expect(input).toHaveValue('p')

      // But navigation should NOT have been called yet
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('delays navigation until debounce timeout', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'pizza' } })
      })

      // Input updates immediately
      expect(input).toHaveValue('pizza')
      // Navigation not called yet
      expect(mockPush).not.toHaveBeenCalled()

      // Advance timers past the debounce delay (300ms)
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Now navigation should have been called
      expect(mockPush).toHaveBeenCalledWith('/sok?q=pizza')
    })

    it('resets debounce timer on each keystroke', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')

      // Type 'p'
      await act(async () => {
        fireEvent.change(input, { target: { value: 'p' } })
      })

      // Wait 200ms (less than 300ms debounce)
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Navigation should not have been called
      expect(mockPush).not.toHaveBeenCalled()

      // Type 'pi' (this should reset the debounce timer)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'pi' } })
      })

      // Wait another 200ms (total 400ms since first keystroke, but only 200ms since second)
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Navigation should still not have been called
      expect(mockPush).not.toHaveBeenCalled()

      // Wait another 100ms to complete debounce from second keystroke
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Now navigation should be called with 'pi'
      expect(mockPush).toHaveBeenCalledWith('/sok?q=pi')
      expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('navigates to home when input is cleared via typing', async () => {
      mockSearchParams.set('q', 'existing')

      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('existing')

      // Clear the input by typing empty string
      await act(async () => {
        fireEvent.change(input, { target: { value: '' } })
      })

      expect(input).toHaveValue('')

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  describe('form submission', () => {
    it('navigates immediately on form submit (bypasses debounce)', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: 'instant' } })
      })

      // Submit the form immediately without waiting for debounce
      await act(async () => {
        fireEvent.submit(form)
      })

      // Navigation should happen immediately
      expect(mockPush).toHaveBeenCalledWith('/sok?q=instant')
    })

    it('trims whitespace from search term on submit', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '  padded search  ' } })
        fireEvent.submit(form)
      })

      expect(mockPush).toHaveBeenCalledWith('/sok?q=padded%20search')
    })

    it('navigates to home when submitting empty form', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.submit(form)
      })

      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
