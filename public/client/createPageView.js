Shortly.createPageView = Backbone.View.extend({

  className: 'pageView',

  template:
    _.template(
      // '<iframe src="<%- url ->" width="500" height="500"></iframe>'
      '<p>Hello</p>'
    ),

  render: function(){
    this.$el.html(this.template());
    return this;
  }

});
