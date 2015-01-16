Shortly.User = Backbone.Model.extend({
  initialize: function() {
    if (!this.get('imageUrl')) {
      this.set('imageUrl', '/user_no_image.png');
    }
  }
});
