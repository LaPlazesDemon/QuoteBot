const {Client, GatewayIntentBits, Events, Partials, ActivityType, Collection, REST} = require('discord.js');
var mysql = require("mysql2")
var path = require("path")
var fs = require("fs")
var config = require("./config.json")
var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[Bot][Debug]`, data);};
var log = function(data) {console.log(`[Bot]`, data);};

// Discord Bot Auth and Initiation

var bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

bot.login(config.discord.token);

bot.on(Events.ClientReady, function() {
    console.info(`[Bot] Logged in as ${bot.user.tag}!`);
    bot.user.setPresence({
        status: "Online",
        activities: [{name: "Quote the World!", type: ActivityType.Listening}]
    });

    // REFRESH GUILD REGISTRY BEFORE LOADING COMMANDS AND MODULES

    var guilds = bot.guilds.cache;
    guilds.forEach(function(guild) {
        var gid = guild.id;

        sql.query(`SELECT * FROM registered_guilds WHERE server_id = ${gid};`, function (err, results) {
            if (!results.length || results[0].is_active == 0) {

                log("Found a non-registered server");

                // Create the registry entry in `registered_guilds`
                
                sql.query(`INSERT INTO registered_guilds (server_id, is_blacklisted, is_active, server_name) VALUES ("${gid}", 0, 1, "${prepareStr(guild.name)}");`, function (err, result) {
                    if (err) {
                        if (err.code == "ER_DUP_ENTRY") {
                            
                            sql.query(`SELECT * FROM registered_guilds WHERE server_id=${gid};`, function (err, result) {
                                if (result[0].is_blacklisted) {
                                    guild.fetchOwner().then(function(owner) {
                                        owner.send("Your server has been blacklisted from using the Quote Bot").then(function() {
                                            guild.leave().then(guild => log(`A blacklisted guild attempted to add QuoteBot, leaving ${guild.name}`));
                                        });
                                    });
                                } else {
                                    sql.query(`UPDATE registered_guilds SET is_active=1 WHERE server_id=${gid}`);
                                }
                            });
                        } else {
                            throw err;
                        }
                    }
                });

                // Create the table in quote base for the server

                sql.query(`CREATE TABLE \`quotes_${gid}\` (
                    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
                    \`text\` text,
                    \`submitter\` varchar(45) DEFAULT NULL,
                    \`target\` varchar(45) DEFAULT NULL,
                    \`timestamp\` datetime DEFAULT CURRENT_TIMESTAMP,
                    \`message_id\` varchar(100) DEFAULT NULL,
                    \`channel_id\` varchar(100) DEFAULT NULL,
                    \`archived?\` int DEFAULT '0',
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`, function(err, result) {
                    if (err) {
                        if (err.code == "ER_TABLE_EXISTS_ERROR") {
                        } else {
                            throw err;
                        }
                    }    
                });    
            }
        });
    });

    var registered_guilds = 0;

    sql.query("SELECT * FROM registered_guilds WHERE is_active = 1;", function (err, results) {
        results.forEach(function(row) {
            registered_guilds += 1;
            if (!guilds.has(row.server_id)) {
                registered_guilds -= 1;
                log("A registered guild has left")
                sql.query(`UPDATE registered_guilds SET is_active = 0 WHERE server_id = ${row.server_id}`);
            }
        });

        log(`Loaded up with ${registered_guilds} servers`);
    
        // MODULE LOADER

        var moduleCount = 0;
        var modulesPath = path.join(__dirname, 'modules');
        var moduleFiles = fs.readdirSync(modulesPath, {recursive: true}).filter(file => file.endsWith('.js'));

        console.log("[Module Loader] Finding Modules");

        for (const file of moduleFiles) {
            var filePath = path.join(modulesPath, file);
            var botModule = require(filePath)
            console.log(`[Module Loader] Starting ${botModule.info.name} Module`);
            botModule.startModule(bot);
            moduleCount += 1;
        }

        console.log(`[Module Loader] Successfully loaded ${moduleCount} module(s)`);
    
    });
});


// SQL LOGIN TO PROMETHEUS 
var sql = mysql.createConnection({
    user: config.sql.user,
    password: config.sql.pass,
    database: config.sql.schema,
    host: config.sql.uri
});

sql.connect(function(err) {
    console.log("[Bot] MySQL Server Connection Successful")
});

sql.on('error', function (err) {
    console.log("[Bot] MySQL server connection lost reconnecting")
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        sql.connect();
    } else {
        throw err;
    }
});

module.exports.sql = sql;
module.exports.bot = bot;
