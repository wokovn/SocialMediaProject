import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Modal from './Modal'

describe('Modal component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} title="Test Modal" onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen={true} title="Test Modal" onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    )

    const closeButton = screen.getByRole('button', { name: /^Close$/ })
    fireEvent.click(closeButton)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop and closeOnBackdrop is true', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose} closeOnBackdrop={true}>
        <div>Modal Content</div>
      </Modal>
    )

    const backdrop = screen.getByRole('button', { name: /close modal backdrop/i })
    fireEvent.click(backdrop)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking backdrop and closeOnBackdrop is false', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose} closeOnBackdrop={false}>
        <div>Modal Content</div>
      </Modal>
    )

    const backdrop = screen.getByRole('button', { name: /close modal backdrop/i })
    fireEvent.click(backdrop)
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('renders custom actions in the footer when provided', () => {
    render(
      <Modal
        isOpen={true}
        title="Test Modal"
        onClose={() => {}}
        actions={<button>Submit Action</button>}
      >
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.getByRole('button', { name: /submit action/i })).toBeInTheDocument()
  })
})
