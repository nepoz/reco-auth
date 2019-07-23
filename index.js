const app = require('express')();
const cors = require('cors');

app.use(cors());

app.get('/callback', (req, res) => {
  console.log(req.params);
});

app.listen(8080, () => {
  console.log('listening on port 8080');
});
