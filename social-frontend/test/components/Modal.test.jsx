import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Modal from '../../src/components/Modal';

describe('Modal Component', () => {
    it('renders its children when isOpen is true', () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()}>
                <div data-testid="modal-content">Modal Content</div>
            </Modal>
        );

        expect(screen.getByTestId('modal-content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        render(
            <Modal isOpen={false} onClose={vi.fn()}>
                <div data-testid="modal-content">Modal Content</div>
            </Modal>
        );

        expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const handleClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={handleClose}>
                <div data-testid="modal-content">Modal Content</div>
            </Modal>
        );

        // Assuming Modal has a generic close button, typically a button with 'X' or SVG
        const closeButtons = screen.getAllByRole('button');
        if (closeButtons.length > 0) {
            fireEvent.click(closeButtons[0]);
            expect(handleClose).toHaveBeenCalled();
        }
    });
});
