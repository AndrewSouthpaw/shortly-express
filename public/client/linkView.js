Shortly.LinkView = Backbone.View.extend({
  className: 'link',

  template: Templates['link'],

  events: {
    'click': 'nav'
  },

  nav: function(e){
    e && e.preventDefault();
    this.attributes.router.navigate('/pages/' + this.model.get('url').slice(7), { trigger: true });
  },

  render: function() {
    this.$el.html(this.template(this.model.attributes));
    return this;
  },
});
