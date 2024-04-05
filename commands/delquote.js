const moduleName = "Delete Quote Command";

const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

var prepareObj = function(json) {return sql.escape(JSON.stringify(json) || "{}");};
var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("delquote")
    .setDescription("Deletes a quote and removes its message for the quotes channel")
    .setDefaultMemberPermissions(8192)
    .addUserOption(option =>
        option.setName("user")
        .setDescription("Deletes all quotes MADE BY the user")
    ).addStringOption(option =>
        option.setName("phrase")
        .setDescription("Deletes all quotes that contain the phrase given")
    ).addIntegerOption(option =>
        option.setName("number")
        .setDescription("Deletes the quote with the same ID")
    ),
    async execute(interaction) {
        const userfilter = interaction.options.getUser("user");
        const textfilter = interaction.options.getString("phrase");
        const intfilter = interaction.options.getInteger("number");
        const guild = interaction.guild;

        const filtersapplied = !!(userfilter) + !!(textfilter) + !!(intfilter);

        var sqlfiltertext = "";

        if (!filtersapplied) {
            interaction.reply({content: ":x: You did not apply any filters, you need to apply a filter", ephemeral: true});
            return;
        } else if (intfilter) {
            sqlfiltertext = `WHERE id=${intfilter}`;
        } else {

            var sqlfilterarr = ["\`archived?\` = 0"];
            var sqlfiltertext = ""
            if (userfilter) {sqlfilterarr.push(`submitter = ${userfilter.id}`)}
            if (textfilter) {sqlfilterarr.push(`text LIKE ${prepareStr(`%${textfilter}%`)}`)}
            sqlfiltertext = "WHERE "+sqlfilterarr.join(" AND ");
        }

        sql.query(`SELECT * FROM quotes_${guild.id} ${sqlfiltertext};`, function (err, results) {
            if (err) {
                log(err.sqlMessage);
                interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
            } else {
                
                var messageIDs = (() => {
                    var returnarr = [];
                    results.forEach(row => returnarr.push({m:row.message_id, c: row.channel_id}));
                    return returnarr;
                })();

                log(`Archiving ${messageIDs.length} quotes from ${interaction.guild.name}`);

                sql.query(`UPDATE quotes_${guild.id} SET \`archived?\`=1 ${sqlfiltertext};`, function (err, results) {
                    if (err) {
                        log(err.sqlMessage)
                        interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
                    } else {
                        messageIDs.forEach(msg => {
                            interaction.guild.channels.fetch([msg.c]).then(channel => {
                                channel.messages.fetch(msg.m).then(message => {
                                    message.delete();
                                });
                            });
                        });
                        interaction.reply({content: `:wastebasket: ${results.affectedRows} quote(s) deleted`, ephemeral: true});
                    }
                });
            }
        });
    }
} 