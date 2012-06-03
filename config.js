var config = {};

config.dropbox = {};
config.dropbox.app_key = process.env.DROPBOX_APP_KEY || '';
config.dropbox.app_secret = process.env.DROPBOX_APP_SECRET || '';
config.dropbox.callback_url = "http://www.lizard.net/auth/dropbox/callback";

config.geoserver = {};
config.geoserver.hostname = "localhost";
config.geoserver.port = "8080";
config.geoserver.auth = "";

config.postgres = {};
config.postgres.username = "api";
config.postgres.password = "api";
config.postgres.hostname = "localhost";
config.postgres.database = "lizard";
config.postgres.conn_string = "tcp://api:api@localhost/lizardsaas";

config.mongodb = {};
config.mongodb.db = "lizard";
config.mongodb.hostname = "localhost";
config.mongodb.conn_string = "mongodb://localhost/lizard";
config.mongodb.secret = "";
config.mongodb.auto_reconnect = true;

module.exports = config;

