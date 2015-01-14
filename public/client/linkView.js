Shortly.LinkView = Backbone.View.extend({
  className: 'link',

  template: Templates['link'],

  events: {
    'click': 'nav'
  },

  incrementVisits: function(){
    this.model.set('visits', this.model.get('visits') + 1);
    this.model.save();
  },

  nav: function(e){
    e && e.preventDefault();
    this.incrementVisits();
    this.attributes.router.navigate('/pages/' + this.model.get('url').slice(7), { trigger: true });
  },

  render: function() {
    this.$el.html(this.template(this.model.attributes));
    return this;
  },
});
