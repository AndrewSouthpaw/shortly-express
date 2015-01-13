var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var bcrypt = require('bcrypt-nodejs');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();



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
  console.log('/ restricted reached');
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
  console.log('/links reached');
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

/************************************************************/
// Write your authentication routes here
/************************************************************/

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/login', function(req, res) {
  console.log('/login reached');
  res.render('login');
  res.end();
  // res.send('hello');
});

app.post('/login', function(req, res) {
  console.log('/login POST');
  var username = req.body.username;
  var password = req.body.password;

  new User({username: username}).fetch()
    .then(function(user) {
      user.authenticate(password, function(err, authenticated) {
        if (authenticated) {
          console.log('User', username, 'authenticated.');
          req.session.user = username;
          res.redirect('/');
        } else {
          console.log('Invalid password for user', username);
          res.redirect('/login');
        }
      });
    });
});

app.get('/signup', function (req, res) {
  console.log('/signup reached');
  res.render('signup');

});

app.post('/signup', function (req, res) {
  console.log('creating user',req.body)
  new User(req.body).save().then(function() {
    req.session.user = req.body.username;
    res.redirect('/');
  })

app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log('/* reached');
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      console.log('redirecting to /');
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
