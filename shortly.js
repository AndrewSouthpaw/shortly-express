var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('request');

var db = require('./app/config');
var bcrypt = require('bcrypt-nodejs');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();


// Use cookie parser
app.use(cookieParser());


// Set authentication configuration

var sess = {
  secret: 'top secret',
  cookie: {},
  // secret: 'top secret',
  resave: false,
  saveUninitialized: true
};

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess));


// Passport authentication path

passport.use(new LocalStrategy(
  function (username, password, done) {
    new User({username: username}).fetch()
      .then(function(user) {
        if (!user) {
          return done(null, false, { message: 'Invalid username.' });
        }
        user.authenticate(password, function(err, authenticated) {
          if (authenticated) {
            console.log('User', username, 'authenticated.');
            return done(null, '{"login": "username"}');
          } else {
            console.log('Invalid password for user', username);
            return done(null, false, { message: 'Invalid password.' });
          }
        });
      })
      .catch(function (err) {
        done(err);
      });
  }
));

// passport.serializeUser(function(user, done) {
//   done(null, user.get('id'));
// });

// passport.deserializeUser(function(id, done) {
//   new User({id: id}).fetch()
//     .then(function (user) {
//       done(null, user);
//     });
// });




// Passport authentication path

passport.use('GitHub',
  new OAuth2Strategy({
    authorizationURL: 'https://github.com/login/oauth/authorize',
    tokenURL: 'https://github.com/login/oauth/access_token',
    clientID: '7ba6eaaaf9bc86989896',
    clientSecret: 'c9b6cbf3076f818d162db21116d361564cff2950',
    callbackURL: 'http://127.0.0.1:4568/auth/GitHub/callback'
  },
  function (accessToken, refreshToken, profile, done) {
    request({
      method: 'GET',
      uri: 'https://api.github.com/user?access_token=' + accessToken,
      headers: {
        'User-Agent': 'Shortly-Express'
      }
    }, function (err, res, body) {
      done(null, body);
    });
  }
));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/GitHub', passport.authenticate('GitHub'));
app.get('/auth/GitHub/callback',
  passport.authenticate('GitHub', { successRedirect: '/',
                                    failureRedirect: '/login' }));


passport.serializeUser(function(user, done) {
  done(null, JSON.parse(user).login);
});

passport.deserializeUser(function(user, done) {
  done(null, JSON.stringify({login: user}));
});






// Handle other stuff

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.get('/links/:id', restrict,
function(req, res) {
  new Link({ id: req.params.id }).fetch().then(function (link) {
    if (!link) {
      return res.status(404).json({});
    }
    res.json(link);
  });
});

app.put('/links/:id', restrict,
function (req, res) {
  /* QUESTION: good way to safeguard against garbage being PUT? */
  new Link(req.body).save().then(function (link) {
    res.send('Save successful');
  })
});

app.get('/pages/:url', restrict,
function(req, res) {
  // Fetch link
  new Link({ url: 'http://' + req.params.url }).fetch().then(function(link) {
    // If it does not exist, redirect to index
    if (!link) {
      res.redirect('/');
    } else {
      // Otherwise, track the click, update the visit count, and render the page
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('url', '=', link.get('url'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.render('index');
          });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

function restrict(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/login', function(req, res) {
  res.render('login');
  res.end();
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

app.get('/github_login', function(req, res) {
  res.redirect('/auth/GitHub');
});

app.get('/signup', function (req, res) {
  res.render('signup');
});

app.post('/signup', function (req, res) {
  new User({username: req.body.username}).fetch().then(function (user) {
    if (!user) {
      new User(req.body).save().then(function() {
        req.session.user = req.body.username;
        res.redirect('/');
      })
    } else {
      res.redirect('/signup');
    }
  });
});

app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
