var express = require('express');
var app = express();

var util = require('./lib/utility');
var request = require('request');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

// Passport modules
var keys = require('./config');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// Database module, models, and collections
var db = require('./app/config');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');



/******************************************************************************
 * Express Middleware
 *****************************************************************************/

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


/******************************************************************************
 * Passport Middleware
 *****************************************************************************/

// Session storage
var sess = {
  secret: 'top secret',
  cookie: {},
  resave: false,
  saveUninitialized: true
};

app.use(cookieParser());
app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());



/******************************************************************************
 * Passport Authentication Strategies
 *****************************************************************************/

// Local Login
passport.use('local-login', new LocalStrategy(
  function (username, password, done) {
    new User({username: username}).fetch()
      .then(function(user) {
        if (!user) {
          return done(null, false, { message: 'Invalid username.' });
        }
        user.authenticate(password, function(err, authenticated) {
          if (authenticated) {
            console.log('User', username, 'authenticated.');
            var userObj = {
              username: username,
              imageUrl: ''
            }
            return done(null, userObj);
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

// Local Signup
passport.use('local-signup', new LocalStrategy(
  function (username, password, done) {
    console.log('local-signup')
    new User({username: username}).fetch().then(function (user) {
      if (!user) {
        new User({username: username, password: password})
          .save().then(function (user) {
            console.log('Registered:', username);
            var userObj = {
              username: user.get('username'),
              imageUrl: ''
            }
            return done(null, userObj);
          });
      } else {
        console.log('Could not register', username);
        return done(null, false, { message: 'Username already exists.' });
      }
    });
  }
));

// GitHub
passport.use('GitHub',
  new OAuth2Strategy({
    authorizationURL: 'https://github.com/login/oauth/authorize',
    tokenURL: 'https://github.com/login/oauth/access_token',
    clientID: keys.GITHUB_CLIENT_ID,
    clientSecret: keys.GITHUB_CLIENT_SECRET,
    callbackURL: 'http://localhost:4568/auth/GitHub/callback'
  },
  function (accessToken, refreshToken, profile, done) {
    request({
      method: 'GET',
      uri: 'https://api.github.com/user?access_token=' + accessToken,
      headers: {
        'User-Agent': 'Shortly-Express'
      }
    }, function (err, res, body) {
      // Extract username and image URL
      body = JSON.parse(body);
      var user = {
        username: body.login,
        imageUrl: body.avatar_url
      };

      done(null, user);
    });
  }
));


// Google
passport.use(new GoogleStrategy({
    clientID: keys.GOOGLE_CLIENT_ID,
    clientSecret: keys.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:4568/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    var user = {
      username: profile.displayName,
      imageUrl: profile._json.picture
    }
    done(null, user);
  }
));


/******************************************************************************
 * Passport User Serialization
 *****************************************************************************/

passport.serializeUser(function(user, done) {
  console.log('Serializing user:', user)
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log('Deserializing user', obj)
  done(null, obj);
});


/******************************************************************************
 * Passport Authentication Routes
 *****************************************************************************/

// Local Login
app.post('/login',
  passport.authenticate('local-login', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

// Local Signup
app.post('/signup',
  passport.authenticate('local-signup', {
    successRedirect: '/',
    failureRedirect: '/signup'
  }));

// GitHub
app.get('/auth/GitHub', passport.authenticate('GitHub'));
app.get('/auth/GitHub/callback',
  passport.authenticate('GitHub', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

// Google
app.get('/auth/google',
  passport.authenticate('google',  {
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });



/******************************************************************************
 * Restricted Access Middleware
 *****************************************************************************/

function restrict(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login');
  }
}





/******************************************************************************
 * Express Routes
 *****************************************************************************/

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

app.get('/login', function(req, res) {
  res.render('login');
  res.end();
});


app.get('/signup', function (req, res) {
  res.render('signup');
});

app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.get('/userSession', function (req, res) {
  res.send(req.user);
})

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
