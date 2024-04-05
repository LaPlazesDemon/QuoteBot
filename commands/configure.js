const moduleName = "Config Command";

const {SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

var prepareObj = function(json) {return sql.escape(JSON.stringify(json) || "{}");};
var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("configure")
    .setDescription("Change bot settings")
    .setDefaultMemberPermissions(32)
    .addSubcommand(subcommand =>
        subcommand.setName("channel")
        .setDescription("Required - Set the channel that quotes will populate in")
        .addChannelOption(option =>
            option.setName("channel")
            .setDescription("Quote Channel. Make sure this is accessible by the bot")
            .setRequired(true)
        )
    ).addSubcommand(subcommand =>
        subcommand.setName("restrictions")
        .setDescription("Open menu to change banned/censored words")
    ).addSubcommand(subcommand => 
        subcommand.setName("list_restrictions")
        .setDescription("Lists all the blocked and censored words")
    ),
    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "channel") {
            var channel = interaction.options.getChannel("channel");
            sql.query(`UPDATE registered_guilds SET quote_channel=${channel.id} WHERE server_id = ${interaction.guild.id};`, function (err, results) {
                if (err) {
                    debug(err)
                    interaction.reply({content: ":x: There was an error modifying the channel ID, please try again later", ephemeral: true})
                } else {
                    interaction.reply({content:":white_check_mark: Setting updated", ephemeral: true})
                }
            });
        } else if (subcommand == "quoter_role") {
            var role = interaction.options.getRole("minrole");
            sql.query(`UPDATE registered_guilds SET quote_role_min = ${role.id} WHERE server_id = ${interaction.guild.id};`, function (err, results) {
                if (err) {
                    debug(err)
                    interaction.reply({content: ":x: There was an error modifying the role ID, please try again later", ephemeral: true})
                } else {
                    interaction.reply({content:":white_check_mark: Setting updated", ephemeral: true})
                }
            });
        } else if (subcommand == "restrictions") {
            sql.query(`SELECT * FROM registered_guilds WHERE server_id = ${interaction.guild.id};`, async function (err, guildresult) {
                if (err) {
                    debug(err)
                    interaction.reply({content: ":x: There was an error, please try again later", ephemeral: true})
                } else {
                    var modal_name = `restricted_words_guild${interaction.guild.id}`;
                    var blocked_name = `blocked_words_guild${interaction.guild.id}`;
                    var censored_name = `censored_words_guild${interaction.guild.id}`;

                    const modal = new ModalBuilder()
                    .setCustomId(modal_name)
                    .setTitle('Quote Bot Restriction Configurator');
            
                    // Create the text input components
                    const blockedWordsInput = new TextInputBuilder()
                        .setCustomId(blocked_name)
                        .setLabel("Blocked words (new line for each word)")
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(JSON.parse(guildresult[0].blocked_words).join("\n"));
            
                    const censoredWordsInput = new TextInputBuilder()
                        .setCustomId(censored_name)
                        .setLabel("Censored words (new line for each word)")
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(JSON.parse(guildresult[0].censored_words).join("\n"));
            
                    const blocked = new ActionRowBuilder().addComponents(blockedWordsInput);
                    const censored = new ActionRowBuilder().addComponents(censoredWordsInput);
            
                    // Add inputs to the modal
                    modal.addComponents(blocked, censored);
            
                    await interaction.showModal(modal);
    
                    const submitted = await interaction.awaitModalSubmit({time: 600000, filter: i => i.user.id === interaction.user.id,}).catch(error => {
                        console.error(error)
                        return null
                    });
    
                    if (submitted) {
                        var blocked_words = submitted.fields.getTextInputValue(blocked_name).split("\n");
                        var censored_words = submitted.fields.getTextInputValue(censored_name).split("\n");
    
                        sql.query(`UPDATE registered_guilds SET blocked_words = ${prepareStr(JSON.stringify(blocked_words))}, censored_words = ${prepareStr(JSON.stringify(censored_words))} WHERE server_id = ${interaction.guild.id};`, function (err, result) {
                            if (err) {
                                debug(err.sqlMessage);
                                submitted.reply({content: ":x: An unknown error occurred, try again later", ephemeral: true});
                            } else {
                                submitted.reply({content: ":white_check_mark: Settings saved!", ephemeral: true});
                                log(`Settings changed for ${interaction.guild.name}`);
                            }
                        });
                    }
                }
            });
        } else if (subcommand == "list_restrictions") {

            sql.query(`SELECT * FROM registered_guilds WHERE server_id = ${interaction.guild.id};`, function(err, result) {
                if (err) {
                    log(err.sqlMessage);
                    interaction.reply({content: ":x: There was an error retrieving restrictions, please try again later", ephemeral: true})
                } else {
                    var blocked_words = JSON.parse(result[0].blocked_words).join(",");
                    var censored_words = JSON.parse(result[0].censored_words).join(",");

                    const embed = new EmbedBuilder()
                    .setTitle(`Quote Bot Restrictions List`)
                    .setDescription(`:no_entry: **__Blocked Words__**:\n${blocked_words}\n\n:face_with_symbols_over_mouth: **__Censored Words__**:\n${censored_words}`)

                    interaction.reply({embeds: [embed], ephemeral:true});
                }
            });
        }
    }
}