import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows the demo admin account', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/admin@teamops.dev/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入工作台/i })).toBeInTheDocument();
  });
});
