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
    '/projects': { get: { summary: 'List projects' }, post: { summary: 'Create a project' } },
    '/projects/{id}': { patch: { summary: 'Update a project' }, delete: { summary: 'Delete a project' } },
    '/tasks': { get: { summary: 'List tasks' }, post: { summary: 'Create a task' } },
    '/tasks/{id}': { patch: { summary: 'Update a task' }, delete: { summary: 'Delete a task' } },
    '/tasks/{id}/comments': { post: { summary: 'Add a task comment' } },
    '/users': { get: { summary: 'List users' }, post: { summary: 'Create a user' } },
    '/users/{id}': { patch: { summary: 'Update a user role and profile' } },
    '/notifications': { get: { summary: 'List notifications for current user' } },
    '/notifications/read-all': { patch: { summary: 'Mark all notifications as read' } }
  }
};
