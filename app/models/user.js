var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  initialize: function() {
    this.on('creating', function (model, attrs, options) {
      // Salt and hash the password
      bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(model.get('password'), salt, null, function (err, hash) {
          model.set('salt', salt);
          model.set('password', hash);
        });
      });
    });

    // Resave after finished hashing
    this.on('created', function () {
      this.save();
    });
  }
});

module.exports = User;


