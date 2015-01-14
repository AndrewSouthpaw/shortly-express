Shortly.Router = Backbone.Router.extend({
  initialize: function(options){
    this.$el = options.el;
  },

  routes: {
    '':       'index',
    'create': 'create',
    'pages/:url': 'page'
    // 'pages/:page': 'page'
  },

  swapView: function(view){
    this.$el.html(view.render().el);
  },

  index: function(){
    var links = new Shortly.Links();
    var linksView = new Shortly.LinksView({
      collection: links,
      attributes: {
        router: this
      }
    });
    this.swapView(linksView);
  },

  create: function(){
    this.swapView(new Shortly.createLinkView());
  },

  // page: function(page) {
  //   console.log('page', page)
  page: function(url){
    console.log('hello, url:', url)
    this.swapView(new Shortly.createPageView({
      attributes: { url: url }
    }));
  },
});
