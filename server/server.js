const path = require('node:path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const staticDir = path.resolve(__dirname, '../client/dist');

app.disable('x-powered-by');
app.use(express.static(staticDir, { maxAge: '1h', index: 'index.html' }));
app.get('*', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));

app.listen(PORT, () => console.log('JATE Studio listening on port ' + PORT));
