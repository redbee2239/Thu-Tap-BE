import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'taskflow-api',
  });
});

app.listen(port, () => {
  console.log('TaskFlow API is running on http://localhost:' + port);
});
