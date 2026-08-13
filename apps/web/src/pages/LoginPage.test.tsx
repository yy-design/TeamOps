import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows the collaboration visual, login form, and demo account details', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByLabelText('TeamOps 智能协作平台')).toBeInTheDocument();
    expect(screen.getByText('项目 · 任务 · 权限 · 交付')).toBeInTheDocument();
    expect(screen.getByText(/管理员：admin@teamops.dev/i)).toBeInTheDocument();
    expect(screen.getByText(/经理：manager@teamops.dev/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入工作台/i })).toBeInTheDocument();
  });
});
