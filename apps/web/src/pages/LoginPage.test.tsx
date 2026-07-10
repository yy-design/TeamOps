import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows a centered split login panel with visual preview and demo account details', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByLabelText('TeamOps 工作台预览')).toBeInTheDocument();
    expect(screen.getByText('把项目、工单、权限和交付数据放在同一张作战图里。')).toBeInTheDocument();
    expect(screen.getByText(/admin@teamops.dev/i)).toBeInTheDocument();
    expect(screen.queryByText('RBAC')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入工作台/i })).toBeInTheDocument();
  });
});
