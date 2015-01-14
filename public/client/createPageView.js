Shortly.createPageView = Backbone.View.extend({

  className: 'pageView',

  template:
    _.template(
      '<iframe src="<%- "http://" + url %>" width="100%" height="800"></iframe>'
      // '<p>Hello</p>'
    ),

  render: function(){
    this.$el.html(this.template(this.attributes));
    return this;
  }

});
