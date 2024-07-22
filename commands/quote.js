const moduleName = "Add Quote";

const {SlashCommandBuilder, EmbedBuilder, quote} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

var prepareObj = function(json) {return sql.escape(JSON.stringify(json) || "{}");};
var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

function replaceAllButFirst(str) {
    return str.charAt(0) + '\\*'.repeat(Math.max(0, str.length - 1));
}

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Add or get a quote")
    .addSubcommand(subcommand => 
        subcommand.setName("add")
        .setDescription("Adds a new quote")
        .addStringOption(option =>
            option.setName("text")
            .setDescription("What is the quote?")
            .setRequired(true)
        ).addUserOption(option =>
            option.setName("user")
            .setDescription("Who said it?")
            .setRequired(true)
        )
    ).addSubcommand(subcommand => 
        subcommand.setName("get")
        .setDescription("Gets a quote")
        .addUserOption(option =>
            option.setName("user")
            .setDescription("Filter by user")
        ).addStringOption(option =>
            option.setName("text")
            .setDescription("Filter by text")
        ).addIntegerOption(option =>
            option.setName("number")
            .setDescription("Filters by number")
        )
    ),
    async execute(interaction) {
        const cmdguild = interaction.guild;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "add") {
            const quotetext = interaction.options.getString("text").trim().replace("\\n", "\n");
            const quoteuser = interaction.options.getUser("user");

            log(`Adding a new quote to ${interaction.guild.name}`);

            sql.query(`SELECT * FROM registered_guilds WHERE server_id = ${cmdguild.id};`, function (err, guildresult) {
                if (!guildresult[0].quote_channel) {
                    interaction.reply({content: ":x: Your staff team haven't set a channel to be used for quoting. Please ask them to use the `/configure` command to set the quotes channel before quoting", ephemeral: true});
                } else {
                    var blocked_words = JSON.parse(guildresult[0].blocked_words);
                    var censored_words = JSON.parse(guildresult[0].censored_words);
                    var quote_channel = guildresult[0].quote_channel;
                    var blocked_word_found = false;
                    var newtext = quotetext;

                    if (blocked_words) {
                        if (blocked_words.length) {
                            blocked_words.forEach(word => {
                                if (quotetext.indexOf(word) >= 0) {
                                    blocked_word_found = true;
                                    return;
                                }
                            });
                        }
                    }
                    
                    if (censored_words) {
                        if (censored_words.length) {
                            censored_words.forEach(word => {
                                newtext = newtext.replaceAll(word, replaceAllButFirst(word));
                            });
                        }    
                    }
                    
                    if (blocked_word_found) {
                         interaction.reply({content: ":no_entry: Your quote contains a blocked word "})
                    } else {
                        cmdguild.channels.fetch(quote_channel).then(channel => {
                            sql.query(`SELECT * FROM quotes_${cmdguild.id} WHERE text = ${prepareStr(newtext)} AND target = ${quoteuser.id};`, function (err, checkresults) {
                                if (checkresults.length) {
                                    interaction.reply({content: ":x: That quote has already been submitted", ephemeral: true})
                                } else {
                                    sql.query(`INSERT INTO quotes_${cmdguild.id} (text, submitter, target) VALUES (${prepareStr(newtext)}, ${interaction.user.id}, ${quoteuser.id});`, function(err, result) {
                                        if (err) {
                                            debug(err.sqlMessage)
                                            interaction.reply({content: ":x: There was an error adding the quote", ephemeral: true})
                                        } else {
                                            try {
                                                const embed = new EmbedBuilder()
                                                .setColor(interaction.guild.members.cache.get(quoteuser.id).roles.highest.color)
                                                .setTitle(`Quote #${result.insertId}`)
                                                .setDescription(`"${newtext.replaceAll("\\n", "\n")}"\n ~<@${quoteuser.id}>`)
                                                .setFooter({ text: `Quoted by ${interaction.user.nickname || interaction.user.username}`});
                                        
                                                channel.send({embeds: [embed]}).then(function(message) {
                                                    sql.query(`UPDATE quotes_${cmdguild.id} SET message_id = ${message.id}, channel_id = ${message.channel.id} WHERE id = ${result.insertId};`);
                                                    if (newtext !== quotetext) {
                                                        interaction.reply({content:":white_check_mark: Quote added\n:warning: Note: some words have been censored", ephemeral: true})
                                                    } else {
                                                        interaction.reply({content:":white_check_mark: Quote added", ephemeral: true})
                                                    }
                                                }).catch(error => {
                                                    if (error.status == 403) {
                                                        interaction.reply({content: ":x: I do not have access to the quotes channel. Please ask the staff team to give me access to the quotes channel before quoting", ephemeral: true});
                                                        sql.query(`DELETE FROM quotes_${interaction.guild.id} WHERE id=${result.insertId};`);
                                                    }
                                                });
                                            } catch (error) {
                                                if (error.status == 403) {
                                                    interaction.reply({content: ":x: I do not have access to the quotes channel. Please ask the staff team to give me access to the quotes channel before quoting", ephemeral: true});
                                                } else {
                                                    interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
                                                }
                                            }
                                        }
                                    }); 
                                }
                            });
                        }).catch(error => {
                            if (error.status == 404) {
                                interaction.reply({content: ":x: The quotes channel has been deleted. Please ask the staff team to use the `/configure` command to set the quotes channel before quoting", ephemeral: true});
                            } else {
                                interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
                            }
                        });
                    }
                }
            });
        } else if (subcommand == "get") {

            const userfilter = interaction.options.getUser("user");
            const textfilter = interaction.options.getString("text");
            const intfilter = interaction.options.getInteger("number");

            if (intfilter) {
                sql.query(`SELECT * FROM quotes_${cmdguild.id} WHERE id = ${intfilter} AND \`archived?\` = 0;`, function (err, results) {
                    if (err) {
                        log(err.sqlMessage)
                        interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
                    } else {
                        if (results.length) {
                            interaction.guild.members.fetch(results[0].target).then((member) => {
                                const embed = new EmbedBuilder()
                                .setColor(member.roles.highest.color)
                                .setTitle(`Quote #${results[0].id}`)
                                .setDescription(`"${results[0].text}"\n ~<@${results[0].target}>`);
            
                                interaction.reply({embeds: [embed], ephemeral: false});
                            });
                        } else {
                            interaction.reply({content: ":mag_right: Quote was not found", ephemeral: true});
                        }   
                    }
                });
            } else {
                var sqlfilterarr = ["\`archived?\` = 0"];
                var sqlfiltertext = ""
                if (userfilter) {sqlfilterarr.push(`target = ${userfilter.id}`)}
                if (textfilter) {sqlfilterarr.push(`text = ${prepareStr(textfilter)}`)}
                sqlfiltertext = "WHERE "+sqlfilterarr.join(" AND ");
    
                sql.query(`SELECT * FROM quotes_${cmdguild.id} ${sqlfiltertext} ORDER BY RAND() LIMIT 1;`, function(err, results) {
                    if (err) {
                        debug(err)
                        interaction.reply({content: ":x: An unknown error occurred, please try again later", ephemeral: true});
                    } else {
                        if (!results.length) {
                            interaction.reply({content: ":mag_right: No quotes could be found with that filter", ephemeral: true});
                        } else {
                            interaction.guild.members.fetch(results[0].target).then((member) => {
                                const embed = new EmbedBuilder()
                                .setColor(member.roles.highest.color)
                                .setTitle(`Quote #${results[0].id}`)
                                .setDescription(`"${results[0].text}"\n ~<@${results[0].target}>`);
            
                                interaction.reply({embeds: [embed], ephemeral: false});
                            });
                        }
                    }
                });
            }
        }
    }
} 