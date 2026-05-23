import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../src/App';

// Mock components to simplify App testing and avoid dependency issues
vi.mock('../src/pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));
vi.mock('../src/components/SignUp', () => ({
  default: () => <div data-testid="signup-page">Sign Up Page</div>,
}));
vi.mock('../src/pages/Home', () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));
vi.mock('../src/pages/Profile', () => ({
  default: () => <div data-testid="profile-page">Profile Page</div>,
}));

describe('App Routing', () => {
  it('renders the App and redirects to /login by default', () => {
    // Render the App wrapped with its internal Router
    render(<App />);
    
    // Check that it defaults/redirects to the Login page component
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
