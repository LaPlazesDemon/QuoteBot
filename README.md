This is a simple bot I designed to create fancy embeded quotes in discord servers and the code is not really designed to be used by others, if you would like this then I will publish a share link to add this bot your own server soon.

***Command Usage***

Command | Description
--- | ---
**Moderator Commands** | 
`/configure channel <channel>` | (Required) Sets the channel that the quotes will populate in (Restricted to roles that have "Manage Server" permission)
`/configure list_restrictions` | Lists all current censored and blocked words (Restricted to roles that have "Manage Server" permission)
`/configure restrictions` | Opens a modal menu to change words that are censored or blocked (Restricted to roles that have "Manage Server" permission)
`/delquote <user?> <phrase?> <number?>` | All fields are optional but at least one must be used. [^1]Deletes quotes based on provided filters (Restricted to roles that have "Manage Messages" permission)
**User Commands** | 
`/quote add <user> <text>` | All fields are required user must be a mentionable user, roles are not permitted.
`/quote get <user?> <text?> <number?>` | All fields are optional but add filters to the search such as quoted user, text in quote etc.

[^1]: **Note:** This does not remove the message from the database but simply "Archives" it to prevent wiping the whole database :)
