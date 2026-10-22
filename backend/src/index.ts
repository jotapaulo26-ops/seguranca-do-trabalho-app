import { app } from './app.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

// If frontend build exists, serve it in production
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }
  const indexHtml = path.join(frontendDist, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(200).send('API do SegTrabalho está online.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🛡️  SEGTRABALHO API RODANDO COM SUCESSO!`);
  console.log(`  🔗  URL: http://localhost:${PORT}`);
  console.log(`  📍  Região Padrão do Mapa: Novo Horizonte - SP`);
  console.log(`  👤  Admin padrão: admin@segtrabalho.com.br / admin123`);
  console.log(`  👷  Técnico padrão: carlos.mendes@segtrabalho.com.br / tec123`);
  console.log(`======================================================\n`);
});
