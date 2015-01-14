Shortly.LinkView = Backbone.View.extend({
  className: 'link',

  template: Templates['link'],

  events: {
    'click': 'nav'
  },

  nav: function(){
    this.attributes.router.navigate('/pages/' + this.model.get('url').slice(7), { trigger: true });
    // this.attributes.router.navigate('/pages/test', { trigger: true });
    // this.attributes.router.navigate('/pages', { trigger: true})
  },

  render: function() {
    this.$el.html(this.template(this.model.attributes));
    return this;
  }
});
