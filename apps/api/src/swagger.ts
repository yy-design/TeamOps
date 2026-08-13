export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'TeamOps API',
    version: '0.1.0',
    description: 'REST API for the TeamOps enterprise project and ticket management demo.'
  },
  servers: [{ url: 'http://localhost:4000/api' }],
  paths: {
    '/auth/login': { post: { summary: 'Sign in and receive a JWT' } },
    '/auth/me': { get: { summary: 'Return the current authenticated user' }, patch: { summary: 'Update the current user profile' } },
    '/dashboard': { get: { summary: 'Return dashboard metrics' } },
    '/projects': { get: { summary: 'List projects visible through membership' }, post: { summary: 'Create a project with members (ADMIN/MANAGER)' } },
    '/projects/member-candidates': { get: { summary: 'List active users available for project membership' } },
    '/projects/{id}': { patch: { summary: 'Update a managed project and synchronize members' }, delete: { summary: 'Delete a managed project' } },
    '/sprints': { get: { summary: 'List visible sprints' }, post: { summary: 'Create a planning sprint' } },
    '/sprints/{id}': { patch: { summary: 'Update sprint metadata' }, delete: { summary: 'Delete an empty planning sprint' } },
    '/sprints/{id}/status': { patch: { summary: 'Activate or complete a sprint with workflow guards' } },
    '/tasks': { get: { summary: 'List tasks in visible projects' }, post: { summary: 'Create a BACKLOG task in a managed project' } },
    '/tasks/{id}': { patch: { summary: 'Update task metadata as project owner' }, delete: { summary: 'Delete a task as project owner' } },
    '/tasks/{id}/status': { patch: { summary: 'Apply an authorized task state transition' } },
    '/tasks/{id}/comments': { post: { summary: 'Add a task comment as assignee or project owner' } },
    '/users': { get: { summary: 'List users' }, post: { summary: 'Create a user' } },
    '/users/{id}': { patch: { summary: 'Update a user role and profile' } },
    '/notifications': { get: { summary: 'List notifications for current user' } },
    '/notifications/stream': { get: { summary: 'Subscribe to authenticated notification changes through SSE' } },
    '/notifications/read-all': { patch: { summary: 'Mark all notifications as read' } }
  }
};
