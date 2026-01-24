/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InstructionEditor } from '../instruction-editor'

interface Instruction {
  step: string
  group_id?: string | null
}

interface GroupInfo {
  id: string
  name: string
}

describe('InstructionEditor', () => {
  describe('group reordering functionality', () => {
    describe('getGroupOrder behavior (via isFirstGroup/isLastGroup button states)', () => {
      it('enables all move buttons when there are multiple groups', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1', group_id: 'group-1' },
          { step: 'Step 2', group_id: 'group-2' },
          { step: 'Step 3', group_id: 'group-3' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-1', name: 'Grupp 1' },
          { id: 'group-2', name: 'Grupp 2' },
          { id: 'group-3', name: 'Grupp 3' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Get all group containers
        const groupContainers = screen.getAllByRole('textbox', { name: '' })
          .filter((el) => el.closest('.bg-orange-50\\/50'))
          .map((el) => el.closest('.bg-orange-50\\/50')!)

        // First group: up disabled, down enabled
        const firstGroupButtons = within(groupContainers[0] as HTMLElement).getAllByRole('button')
        const firstUpButton = firstGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp upp')
        const firstDownButton = firstGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp ner')
        expect(firstUpButton).toBeDisabled()
        expect(firstDownButton).not.toBeDisabled()

        // Middle group: both enabled
        const middleGroupButtons = within(groupContainers[1] as HTMLElement).getAllByRole('button')
        const middleUpButton = middleGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp upp')
        const middleDownButton = middleGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp ner')
        expect(middleUpButton).not.toBeDisabled()
        expect(middleDownButton).not.toBeDisabled()

        // Last group: up enabled, down disabled
        const lastGroupButtons = within(groupContainers[2] as HTMLElement).getAllByRole('button')
        const lastUpButton = lastGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp upp')
        const lastDownButton = lastGroupButtons.find(b => b.getAttribute('aria-label') === 'Flytta grupp ner')
        expect(lastUpButton).not.toBeDisabled()
        expect(lastDownButton).toBeDisabled()
      })

      it('disables both move buttons when there is only one group', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1', group_id: 'group-1' },
        ]
        const groups: GroupInfo[] = [{ id: 'group-1', name: 'Grupp 1' }]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        const upButton = screen.getByRole('button', { name: 'Flytta grupp upp' })
        const downButton = screen.getByRole('button', { name: 'Flytta grupp ner' })

        expect(upButton).toBeDisabled()
        expect(downButton).toBeDisabled()
      })

      it('handles ungrouped instructions correctly (does not affect group order)', () => {
        const instructions: Instruction[] = [
          { step: 'Ungrouped step 1', group_id: null },
          { step: 'Ungrouped step 2' },
          { step: 'Step in group 1', group_id: 'group-1' },
          { step: 'Step in group 2', group_id: 'group-2' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-1', name: 'Grupp 1' },
          { id: 'group-2', name: 'Grupp 2' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Should have 2 group headers
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        const downButtons = screen.getAllByRole('button', { name: 'Flytta grupp ner' })

        // First group: up disabled, down enabled
        expect(upButtons[0]).toBeDisabled()
        expect(downButtons[0]).not.toBeDisabled()

        // Last group: up enabled, down disabled
        expect(upButtons[1]).not.toBeDisabled()
        expect(downButtons[1]).toBeDisabled()
      })
    })

    describe('isFirstGroup', () => {
      it('returns true for the first group (up button is disabled)', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1', group_id: 'group-1' },
          { step: 'Step 2', group_id: 'group-2' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-1', name: 'First Group' },
          { id: 'group-2', name: 'Second Group' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })

        // First group's up button should be disabled (isFirstGroup returns true)
        expect(upButtons[0]).toBeDisabled()
        // Second group's up button should be enabled
        expect(upButtons[1]).not.toBeDisabled()
      })
    })

    describe('isLastGroup', () => {
      it('returns true for the last group (down button is disabled)', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1', group_id: 'group-1' },
          { step: 'Step 2', group_id: 'group-2' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-1', name: 'First Group' },
          { id: 'group-2', name: 'Second Group' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        const downButtons = screen.getAllByRole('button', { name: 'Flytta grupp ner' })

        // First group's down button should be enabled
        expect(downButtons[0]).not.toBeDisabled()
        // Last group's down button should be disabled (isLastGroup returns true)
        expect(downButtons[1]).toBeDisabled()
      })
    })

    describe('moveGroup', () => {
      it('moves group up correctly (swaps with previous group)', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step A2', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Click "move up" on the second group (group-b)
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        fireEvent.click(upButtons[1])

        // Verify onChange was called with reordered instructions
        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // Group B should now come before Group A
        // Expected order: ungrouped (none), group-b, group-a
        expect(newInstructions).toHaveLength(3)
        expect(newInstructions[0].group_id).toBe('group-b')
        expect(newInstructions[0].step).toBe('Step B1')
        expect(newInstructions[1].group_id).toBe('group-a')
        expect(newInstructions[1].step).toBe('Step A1')
        expect(newInstructions[2].group_id).toBe('group-a')
        expect(newInstructions[2].step).toBe('Step A2')
      })

      it('moves group down correctly (swaps with next group)', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
          { step: 'Step B2', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Click "move down" on the first group (group-a)
        const downButtons = screen.getAllByRole('button', { name: 'Flytta grupp ner' })
        fireEvent.click(downButtons[0])

        // Verify onChange was called with reordered instructions
        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // Group A should now come after Group B
        // Expected order: group-b, group-a
        expect(newInstructions).toHaveLength(3)
        expect(newInstructions[0].group_id).toBe('group-b')
        expect(newInstructions[0].step).toBe('Step B1')
        expect(newInstructions[1].group_id).toBe('group-b')
        expect(newInstructions[1].step).toBe('Step B2')
        expect(newInstructions[2].group_id).toBe('group-a')
        expect(newInstructions[2].step).toBe('Step A1')
      })

      it('does nothing when moving up on first group (boundary check)', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // The first group's up button should be disabled
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        expect(upButtons[0]).toBeDisabled()

        // Try to click it anyway (should do nothing)
        fireEvent.click(upButtons[0])

        // onChange should not have been called
        expect(onChange).not.toHaveBeenCalled()
      })

      it('does nothing when moving down on last group (boundary check)', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // The last group's down button should be disabled
        const downButtons = screen.getAllByRole('button', { name: 'Flytta grupp ner' })
        expect(downButtons[1]).toBeDisabled()

        // Try to click it anyway (should do nothing)
        fireEvent.click(downButtons[1])

        // onChange should not have been called
        expect(onChange).not.toHaveBeenCalled()
      })

      it('preserves ungrouped instructions at the start when reordering groups', () => {
        const instructions: Instruction[] = [
          { step: 'Ungrouped 1', group_id: null },
          { step: 'Ungrouped 2' },
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Move group B up
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        fireEvent.click(upButtons[1])

        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // Ungrouped instructions should remain at the start
        expect(newInstructions).toHaveLength(4)
        expect(newInstructions[0].group_id).toBeFalsy()
        expect(newInstructions[0].step).toBe('Ungrouped 1')
        expect(newInstructions[1].group_id).toBeFalsy()
        expect(newInstructions[1].step).toBe('Ungrouped 2')
        // Group B should now be before Group A
        expect(newInstructions[2].group_id).toBe('group-b')
        expect(newInstructions[2].step).toBe('Step B1')
        expect(newInstructions[3].group_id).toBe('group-a')
        expect(newInstructions[3].step).toBe('Step A1')
      })

      it('preserves all instructions within groups when reordering', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step A2', group_id: 'group-a' },
          { step: 'Step A3', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
          { step: 'Step B2', group_id: 'group-b' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Move group B up
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        fireEvent.click(upButtons[1])

        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // All instructions should be preserved
        expect(newInstructions).toHaveLength(5)

        // Group B instructions should come first (in original order)
        expect(newInstructions[0].group_id).toBe('group-b')
        expect(newInstructions[0].step).toBe('Step B1')
        expect(newInstructions[1].group_id).toBe('group-b')
        expect(newInstructions[1].step).toBe('Step B2')

        // Group A instructions should come after (in original order)
        expect(newInstructions[2].group_id).toBe('group-a')
        expect(newInstructions[2].step).toBe('Step A1')
        expect(newInstructions[3].group_id).toBe('group-a')
        expect(newInstructions[3].step).toBe('Step A2')
        expect(newInstructions[4].group_id).toBe('group-a')
        expect(newInstructions[4].step).toBe('Step A3')
      })

      it('handles three groups correctly when moving middle group', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
          { step: 'Step C1', group_id: 'group-c' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
          { id: 'group-c', name: 'Group C' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Move middle group (B) up
        const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' })
        fireEvent.click(upButtons[1])

        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // Order should be: B, A, C
        expect(newInstructions[0].group_id).toBe('group-b')
        expect(newInstructions[1].group_id).toBe('group-a')
        expect(newInstructions[2].group_id).toBe('group-c')
      })

      it('correctly handles moving middle group down', () => {
        const instructions: Instruction[] = [
          { step: 'Step A1', group_id: 'group-a' },
          { step: 'Step B1', group_id: 'group-b' },
          { step: 'Step C1', group_id: 'group-c' },
        ]
        const groups: GroupInfo[] = [
          { id: 'group-a', name: 'Group A' },
          { id: 'group-b', name: 'Group B' },
          { id: 'group-c', name: 'Group C' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor
            instructions={instructions}
            groups={groups}
            onChange={onChange}
          />
        )

        // Move middle group (B) down
        const downButtons = screen.getAllByRole('button', { name: 'Flytta grupp ner' })
        fireEvent.click(downButtons[1])

        expect(onChange).toHaveBeenCalledTimes(1)
        const [newInstructions] = onChange.mock.calls[0]

        // Order should be: A, C, B
        expect(newInstructions[0].group_id).toBe('group-a')
        expect(newInstructions[1].group_id).toBe('group-c')
        expect(newInstructions[2].group_id).toBe('group-b')
      })
    })

    describe('edge cases', () => {
      it('renders without groups', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1' },
          { step: 'Step 2' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor instructions={instructions} onChange={onChange} />
        )

        // Should not have any group move buttons
        const upButtons = screen.queryAllByRole('button', {
          name: 'Flytta grupp upp',
        })
        const downButtons = screen.queryAllByRole('button', {
          name: 'Flytta grupp ner',
        })

        expect(upButtons).toHaveLength(0)
        expect(downButtons).toHaveLength(0)
      })

      it('renders empty state without groups', () => {
        const instructions: Instruction[] = []
        const onChange = vi.fn()

        render(
          <InstructionEditor instructions={instructions} onChange={onChange} />
        )

        // Should show empty message
        expect(screen.getByText(/inga instruktioner ännu/i)).toBeInTheDocument()

        // Should not have any group move buttons
        const upButtons = screen.queryAllByRole('button', {
          name: 'Flytta grupp upp',
        })
        expect(upButtons).toHaveLength(0)
      })

      it('extracts groups from instructions when not provided explicitly', () => {
        const instructions: Instruction[] = [
          { step: 'Step 1', group_id: 'existing-group' },
          { step: 'Step 2', group_id: 'existing-group' },
        ]
        const onChange = vi.fn()

        render(
          <InstructionEditor instructions={instructions} onChange={onChange} />
        )

        // Should have group move buttons (group was extracted from instructions)
        const upButtons = screen.queryAllByRole('button', {
          name: 'Flytta grupp upp',
        })
        const downButtons = screen.queryAllByRole('button', {
          name: 'Flytta grupp ner',
        })

        expect(upButtons).toHaveLength(1)
        expect(downButtons).toHaveLength(1)
      })
    })
  })
})
