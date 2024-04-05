const moduleName = "Guild Events Management";

const config = require("../config.json");
const commandLoader = require('./commandLoader');
const {Collection, REST, Routes, Events} = require('discord.js')
const sql = require("../bot").sql;

var prepareObj = function(json) {return sql.escape(JSON.stringify(json) || "{}");};
var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};


module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {
        
        // Discord Bot has been added to a 'guild' (server)

        bot.on(Events.GuildCreate, (guild) => {
            var gid = guild.id;

            // Create the registry entry in `registered_guilds`

            log(`Bot was added to ${guild.name}`);
            
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
                                commandLoader.startModule(bot);
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
                        guild.fetchOwner().then(function(owner) {
                            owner.send("Welcome back! Your old quotes have been restored [placeholder]")
                        })
                    } else {
                        throw err;
                    }
                }    
            });    

            
        });

        // Discord Bot has been removed from a 'guild' (server)

        bot.on(Events.GuildDelete, (guild) => {
            var gid = guild.id;

            log(`Bot was removed from ${guild.name}`);
            sql.query(`UPDATE registered_guilds SET is_active=0 WHERE server_id='${gid}';`)
        })
    }
} 