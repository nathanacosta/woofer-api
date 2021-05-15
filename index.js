require('dotenv').config();
const express = require('express');
const cors = require('cors');
const monk = require('monk');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');

const app = express();

const db = monk(process.env.MONGO_URI || 'localhost/woofer');
const woofs = db.get('woofs');
const filter = new Filter();

db.then(() => {
  console.log('Succesfully Connected to MongoDB!')
})

app.enable('trust proxy');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Woofer! 🐶'
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Woof Woof! 🐶❤'
  });
});

app.get('/woofs', cors(), (req, res, next) => {
  woofs
    .find()
    .then(woofs => {
      res.json(woofs);
    }).catch(next);
});

app.get('/v2/woofs', cors(), (req, res, next) => {
  // let skip = Number(req.query.skip) || 0;
  // let limit = Number(req.query.limit) || 10;
  let { skip = 0, limit = 5, sort = 'desc' } = req.query;
  skip = parseInt(skip) || 0;
  limit = parseInt(limit) || 5;

  skip = skip < 0 ? 0 : skip;
  limit = Math.min(50, Math.max(1, limit));

  Promise.all([
    woofs
      .count(),
    woofs
      .find({}, {
        skip,
        limit,
        sort: {
          created: sort === 'desc' ? -1 : 1
        }
      })
  ])
    .then(([ total, woofs ]) => {
      res.json({
        woofs,
        meta: {
          total,
          skip,
          limit,
          has_more: total - (skip + limit) > 0,
        }
      });
    }).catch(next);
});

function isValidwoof(woof) {
  return woof.displayName && woof.displayName.toString().trim() !== '' && woof.displayName.toString().trim().length <= 50 &&
    woof.content && woof.content.toString().trim() !== '' && woof.content.toString().trim().length <= 140;
}

app.use(rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 1
}));

const createwoof = (req, res, next) => {
  if (isValidwoof(req.body)) {
    const woof = {
      displayName: filter.clean(req.body.displayName.toString().trim()),
      username: filter.clean(req.body.username.toString().trim()),
      verified: req.body.verified,
      content: filter.clean(req.body.content.toString().trim()),
      image: filter.clean(req.body.image.toString().trim()),
      avatar: filter.clean(req.body.avatar.toString().trim()),
      created: new Date()
    };

    woofs
      .insert(woof)
      .then(createdwoof => {
        res.json(createdwoof);
      }).catch(next);
  } else {
    res.status(422);
    res.json({
      message: 'Hey! Name and Content are required! Name cannot be longer than 50 characters. Content cannot be longer than 140 characters.'
    });
  }
};

app.post('/woofs', createwoof);
app.post('/v2/woofs', createwoof);

app.use((error, req, res, next) => {
  res.status(500);
  res.json({
    message: error.message
  });
});

app.listen(5000, () => {
  console.log('Listening on http://localhost:5000');
});
