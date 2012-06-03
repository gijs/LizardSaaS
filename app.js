require("v8-profiler")
var express = require('express'),
  passport = require('passport'),
  path = require('path'),
  http = require('http'),
  url = require('url'),
  DropboxClient = require('dropbox').DropboxClient,
  MongoStore = require('connect-mongo')(express),
  mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  util = require('util'),
  pg = require('pg'),
  DropboxStrategy = require('passport-dropbox').Strategy,
  config = require('./config');


var dropbox;


// Create workspace in Geoserver
var geoserver_post_workspaces_options = {
    host: config.geoserver.hostname,
    port: config.geoserver.port,
    path: '/geoserver/rest/workspaces',
    method: 'POST',
    auth: config.geoserver.auth
};

// Create workspace in Geoserver
var geoserver_get_workspaces_options = {
    host: config.geoserver.hostname,
    port: config.geoserver.port,
    path: '/geoserver/rest/workspaces',
    method: 'GET',
    auth: config.geoserver.auth
};



// var conString = config.postgres.conn_string;
// var client = new pg.Client(conString);
// client.connect();


// Initialize database
var db = mongoose.connect(config.mongodb.conn_string);
var app = express.createServer();

// configure Express
app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    // app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: config.mongodb.secret,
        store: new MongoStore({
          db: config.mongodb.db,
          host: config.mongodb.hostname,
          collection: 'apisessions',
          auto_reconnect: config.mongodb.auto_reconnect
        })
    }));
    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.errorHandler());
    // app.use(express.static(__dirname + '/public'));
});







var WorkspaceSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    date: {
        type: Date,
    default:
        Date.now
    },
    description: {
        type: String,
        required: true
    },
    _owner: {
        type: mongoose.Schema.ObjectId
    }
});
var WorkspaceSchemaName = 'Workspaces';



var UserSchema = new Schema({
    name: String,
    prefix: {
        type: String,
        required: true
    }
});

// This instance method returns models (prefixed collections) for the user
UserSchema.methods.getModel = function(name) {
    return this.model(this.prefix + name);
}



// Define User model based on UserSchema
var User = mongoose.model('User', UserSchema);
// var Workspace = mongoose.model('Workspace', WorkspaceSchema);




// Generates uniquely prefixed models/collections for a user
function createTenancy(user, cb) {
    user.prefix = 'tenant' + String(Math.random()).substring(2, 6);
    user.save(function(err) {
        if (err) return cb(err);
        mongoose.model(user.prefix + WorkspaceSchemaName, WorkspaceSchema);
        cb();
    });
}









// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Dropbox profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(user, done) {
    User.findById(user,
    function(err, user) {
        done(err, user);
    });
});





// Use the DropboxStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Dropbox profile), and
//   invoke a callback with a user object.
passport.use(new DropboxStrategy({
    consumerKey: config.dropbox.app_key,
    consumerSecret: config.dropbox.app_secret,
    callbackURL: config.dropbox.callback_url
},
function(token, tokenSecret, profile, done) {

    
    dropbox = new DropboxClient(config.dropbox.app_key, config.dropbox.app_secret, token, tokenSecret);

    dropbox.getAccountInfo(function(err, data) {
        if (err) console.log('Error: ' + err)
        else console.log(data.display_name + ', ' + data.email)
    });

    process.nextTick(function() {
        console.log("profile._json.email: ", profile._json.email);
        
        User.findOne({name: profile._json.email}, function(err, user) {
            console.log("user:", user);
            if ( user ) {
                console.log("we have a user: ", user);
                return done(null, user);
            }
            else {
                console.log("no user!");
                var user = new User({
                    name: profile._json.email,
                    prefix: profile.id,
                });

                createTenancy(user, function(err) {

                    if (err) return console.error(err.stack);

                    var W = user.getModel('Workspaces');
                    var workspace = new W({
                        _owner: user,
                        title: 'Your first workspace',
                        description: 'We just created an empty workspace for you. Go ahead and play with it.'
                    });
                    console.log('Saving workspaces of %s to collection %s', user.name, W.modelName);

                    workspace.save(function(err) {
                        if (err) return console.error(err.stack);

                        W.findById(workspace,
                        function(err, workspace) {
                            if (err) return console.error(err.stack);
                            console.log('Found prefixed workspace', workspace);
                        });
                    });

                    // Create Geoserver 'workspace' for this user!
                    var req = http.request(geoserver_post_workspaces_options,
                    function(res) {
                        console.log('STATUS: ' + res.statusCode);
                        console.log('HEADERS: ' + JSON.stringify(res.headers));
                        res.setEncoding('utf8');
                        res.on('data',
                        function(chunk) {
                            console.log('BODY: ' + chunk);
                        });
                    });

                    req.on('error',
                    function(e) {
                        console.log('problem with request: ' + e.message);
                    });

                    // write data to request body
                    req.setHeader("Content-Type", "text/xml");
                    req.write('<workspace><name>Lizard_' + user._id + '</name></workspace>');
                    req.end();

                });
                return done(null, user);
            }
        });
    });
}
));







// API definitions
app.get('/api/v1/nl/:userid/workspaces', ensureAuthenticated,
function(req, res, user) {
    var user;
    User.findById(req.user._id,
    function(err, user) {
    // User.findById(req.params.userid, function(err,user) { // <--- Gets user from req.params
        console.log("user: ", user);
        var W = user.getModel('Workspaces');

        W.find(function(err, workspaces) {
            if (!err) {
                return res.send(workspaces);
            } else {
                return console.error(err);
            }
        });
    });
});

app.post('/api/v1/nl/:userid/workspaces', ensureAuthenticated,
function(req, res) {
    var user;
    User.findById(req.user._id,
    function(err, user) {
        var W = user.getModel('Workspaces');
        var workspace = new W({
            _owner: user,
            title: req.body.title,
            description: req.body.description,
        });
        workspace.save(function(err) {
            if (!err) {
                console.log("Workspace created");
                return res.send(workspace);
            } else {
                console.log(err);
                return res.send(err);
            }
        });
        
    });
});

app.get('/api/v1/nl/:user/workspaces/:id', ensureAuthenticated,
function(req, res) {
    return Workspace.findById(req.params.id,
    function(err, workspace) {
        if (!err) {
            return res.send(workspace);
        } else {
            return console.log(err);
        }
    });
});

app.put('/api/v1/nl/:user/workspaces/:id', ensureAuthenticated,
function(req, res) {
    return Workspace.findById(req.params.id,
    function(err, workspace) {
        workspace.title = req.body.title;
        workspace.description = req.body.description;
        return workspace.save(function(err) {
            if (!err) {
                console.log("updated");
            } else {
                console.log(err);
            }
            return res.send(workspace);
        });
    });
});

app.del('/api/v1/nl/:user/workspaces/:id', ensureAuthenticated,
function(req, res) {
    var user;
    User.findById(req.user._id,
    function(err, user) {
        var W = user.getModel('Workspaces');

        W.findById(req.params.id, function(err,workspace) {
           if(!err && workspace)  {
               workspace.remove(function(err) {
                  if(!err) {
                      console.log("Removed!", workspace);
                      return res.send(workspace);
                  } else {
                      console.log("Error:", err);
                  }
               });
           } else {
               console.log("Error:", err);
               return res.send(err);
           }
        });
    });
});



app.get('/api/v1/nl/:userid/dropbox/documents', ensureAuthenticated,
function(req, res, user) {    
    dropbox.getMetadata('',
    function(err, data) {
        if (err) {
            console.log(err);
            return res.send(err);
        } else {
            return res.send(data);
        }
    });
});

app.post('/api/v1/nl/:userid/dropbox/documents', ensureAuthenticated,
function(req, res, user) {
    dropbox.deleteItem(req.body.path, 
    function(err, data) {
        if (err) {
            console.log(err);
            return res.send(err);
        }
        else {
            return res.send(data);
        }
    });    
});







// app.get('/api/v1/nl/:userid/postgis', ensureAuthenticated,
// function(req, res) {
//     var user;
//     User.findById(req.user._id,
//     function(err, user) {
//         if(err) return console.log(err);
//         console.log("Creating PostGIS schema 'user.prefix':", user.prefix);
//         client.query("CREATE SCHEMA " + user.prefix);
//         client.query("ALTER EXTENSION postgis SET SCHEMA " + user.prefix);
//         return res.send("ok");
//     });
// });







app.get('/',
function(req, res) {
    res.render('index', {
        user: req.user
    });
});


app.get('/api', ensureAuthenticated,
function(req, res) {
    res.render('api', {
        user: req.user
    });
});

app.get('/about', ensureAuthenticated,
function(req, res) {
    res.render('about', {
        user: req.user
    });
});


app.get('/login',
function(req, res) {
    res.render('login', {
        user: req.user
    });
});

// GET /auth/dropbox
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Dropbox authentication will involve redirecting
//   the user to dropbox.com.  After authorization, Dropbox will redirect the user
//   back to this application at /auth/dropbox/callback
app.get('/auth/dropbox',
passport.authenticate('dropbox'),
function(req, res) {
    // The request will be redirected to Dropbox for authentication, so this
    // function will not be called.
    });

// GET /auth/dropbox/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/dropbox/callback',
passport.authenticate('dropbox', {
    failureRedirect: '/auth/dropbox'
}),
function(req, res) {
    res.redirect('/');
});

app.get('/logout',
function(req, res) {
    req.logout();
    res.redirect('/');
});

app.listen(3000);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/dropbox')
}