/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../search-bar'

// Mock @tanstack/react-router
const mockNavigate = vi.fn()
let mockLocation = { pathname: '/', search: '' }
let mockSearchParams: Record<string, string | undefined> = {}

function setMockLocation(pathname: string, search: string) {
  mockLocation = { pathname, search }
  // Parse search string into mockSearchParams
  const params = new URLSearchParams(search)
  const result: Record<string, string | undefined> = {}
  params.forEach((value, key) => { result[key] = value })
  mockSearchParams = result
}

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
  }),
  useLocation: () => mockLocation,
  useSearch: () => mockSearchParams,
}))

// Mock recent searches hook
vi.mock('@/lib/hooks/use-recent-searches', () => ({
  useRecentSearches: () => ({
    searches: [],
    addSearch: vi.fn(),
    removeSearch: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

// Mock icons
vi.mock('@/lib/icons', () => ({
  Search: (props: Record<string, unknown>) => <svg data-testid="search-icon" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  Clock: (props: Record<string, unknown>) => <svg data-testid="clock-icon" {...props} />,
}))

// Mock Popover (renders children directly)
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: () => null,
  PopoverAnchor: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigate.mockClear()
    setMockLocation('/', '')
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
      setMockLocation('/sok', '?q=test')

      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('test')
    })

    it('updates input value when URL changes (browser navigation)', async () => {
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('')

      // Simulate URL change (e.g., browser back button)
      setMockLocation('/sok', '?q=updated-search')

      // Re-render to simulate the component receiving new location
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

      // Simulate URL change while focused
      setMockLocation('/sok', '?q=different-value')
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

      // Simulate URL change after blur
      setMockLocation('/sok', '?q=url-value')
      rerender(<SearchBar />)

      // Input should sync from URL since it's not focused
      expect(input).toHaveValue('url-value')
    })

    it('handles browser back/forward navigation when input is unfocused', async () => {
      setMockLocation('/sok', '?q=initial-search')
      const { rerender } = render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('initial-search')

      // Simulate browser back to empty search
      setMockLocation('/', '')
      rerender(<SearchBar />)

      expect(input).toHaveValue('')

      // Simulate browser forward to the search
      setMockLocation('/sok', '?q=initial-search')
      rerender(<SearchBar />)

      expect(input).toHaveValue('initial-search')

      // Simulate navigating to a different search in history
      setMockLocation('/sok', '?q=other-search')
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

      // Simulate multiple rapid URL changes
      setMockLocation('/sok', '?q=my')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Preserves user input

      setMockLocation('/sok', '?q=my-s')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Still preserves user input

      setMockLocation('/sok', '?q=my-search')
      rerender(<SearchBar />)
      expect(input).toHaveValue('my-search') // Still preserves user input

      // User blurs the input
      fireEvent.blur(input)

      // Now a URL change should sync
      setMockLocation('/sok', '?q=external-change')
      rerender(<SearchBar />)
      expect(input).toHaveValue('external-change')
    })
  })

  describe('clearing search', () => {
    it('resets input value to empty string when clear button is clicked', async () => {
      setMockLocation('/sok', '?q=existing-search')

      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveValue('existing-search')

      // Find and click the clear button
      const clearButton = screen.getByRole('button', { name: /rensa/i })
      await act(async () => {
        fireEvent.click(clearButton)
      })

      expect(input).toHaveValue('')
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', search: undefined })
    })

    it('does not show clear button when input is empty', () => {
      render(<SearchBar />)

      const clearButton = screen.queryByRole('button', { name: /rensa/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('shows clear button when input has value', () => {
      setMockLocation('/sok', '?q=something')

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
      expect(mockNavigate).not.toHaveBeenCalled()
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
      expect(mockNavigate).not.toHaveBeenCalled()

      // Advance timers past the debounce delay (300ms)
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Now navigation should have been called with typed search params
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sok', search: { q: 'pizza' } })
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
      expect(mockNavigate).not.toHaveBeenCalled()

      // Type 'pi' (this should reset the debounce timer)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'pi' } })
      })

      // Wait another 200ms (total 400ms since first keystroke, but only 200ms since second)
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Navigation should still not have been called
      expect(mockNavigate).not.toHaveBeenCalled()

      // Wait another 100ms to complete debounce from second keystroke
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Now navigation should be called with 'pi'
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sok', search: { q: 'pi' } })
      expect(mockNavigate).toHaveBeenCalledTimes(1)
    })

    it('navigates to home when input is cleared via typing', async () => {
      setMockLocation('/sok', '?q=existing')

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

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', search: undefined })
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
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sok', search: { q: 'instant' } })
    })

    it('trims whitespace from search term on submit', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '  padded search  ' } })
        fireEvent.submit(form)
      })

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sok', search: { q: 'padded search' } })
    })

    it('navigates to home when submitting empty form', async () => {
      render(<SearchBar />)

      const input = screen.getByRole('searchbox')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.submit(form)
      })

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', search: undefined })
    })
  })
})
