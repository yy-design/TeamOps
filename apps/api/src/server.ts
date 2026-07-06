import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`TeamOps API listening on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
});
