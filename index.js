const Discord = require("discord.js");
const token = process.env.token;

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query(`CREATE TABLE IF NOT EXISTS members (
  userId varchar(20) PRIMARY KEY,
  points int,
  tag varchar(50),
  avatarurl varchar(100)
);`)

const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS"]});

client.once('ready', () => {
	console.log(`Ready!. Logged in as ${client.user.tag}`);
})



client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith("proto")) return;
  commands = processCommand(message.content);
  
  // message.reply(JSON.stringify(commands)); // uncomment for debugging
  
  if(commands[0] === "give")
  {
    if (!message.member.roles.cache.some(role => role.name === 'Leader')) 
    {
      message.reply("Command reserved for Leadership roles");
      return;
    }
    userId = processUserId(commands[1]);
    if(userId === commands[1]) message.reply("Invalid command!. `proto give <user> <points>`");
    else if(isValidGuildMember(message.guild, userId))
    {
      if(!isNaN(commands[2]))
      {
        givePoints(userId, commands[2],message ,pool);
        
      }
      else message.reply("Invalid command!. `proto give <user> <points>`");
    }
    else message.reply("Invalid command!. `proto give <user> <points>`");
  }
  else if(commands[0] === "points" )
  {
    if(!commands[1]) return;
    userId = processUserId(commands[1]);
    if(isValidGuildMember(message.guild, userId))
    {
      getPointsByUserId(userId)
      .then(user=>message.reply(
        `<@${user.rows[0].userid}>:${user.rows[0].points}`
        ))
        .catch(console.log);
    }
  }
  else if(commands[0] === "top" )
  {
    getTopRank(pool).then(users=>users.rows.map(user=>message.reply(`<@${user.userid}>:${user.points}`)));
  }
  else if(commands[0] === "init" )
  {
    initialise(message, pool).catch(console.log);
  }
  else message.reply("Invalid command!. `proto give <user> <points>`");

});

client.login(token);

function processUserId(userId)
{
  if (!userId) return 0;
	if (userId.startsWith('<@') && userId.endsWith('>')) {
		userId = userId.slice(2, -1);

	if (userId.startsWith('!')) {
		userId = userId.slice(1);
  }
		return userId;
	}
}

function processCommand(command)
{
  const commandBody = command.slice(5).toLowerCase();
  const args = commandBody.split(' ');
  const commands = args.filter(e => e);
  return commands;
}

async function givePoints(userId, points,message, pool)
{
  await pool.connect();
  message.guild.members.fetch(userId).then(promise=>{
    pool.query(`
    INSERT INTO members (userId, points, tag, avatarurl)
    VALUES(${userId}, ${points}, '${promise.user.username}', '${promise.user.avatarURL()}') 
    ON CONFLICT (userId) 
    DO UPDATE SET points = members.points + ${points};`);
  }).catch(err=>console.log(err))
  
  
}

function isValidGuildMember(guild, userId)
{
  if(userId===undefined) return false;
  else if(userId.startsWith('&')) return false;
  return guild.members.fetch(userId);
}

async function getAllRows(pool){
  await pool.connect();
  const res = await pool.query('SELECT * FROM members');
  console.log(res.rows) // Hello world!
  return res;
}

async function getTopRank(pool){
  await pool.connect();
  const res = await pool.query(`SELECT * FROM members
  WHERE points = (
     SELECT MAX (points)
     FROM members
  );`);
  // console.log(res.rows) // Hello world!
  return res;
}

async function getPointsByUserId(userId)
{
  await pool.connect();
  var res = await pool.query(
  `
    SELECT * FROM members WHERE userid = '${userId}';
  `);
  console.log(res);
  return res;
}

async function initialise(message, pool)
{
  await pool.connect();
  querystring = `INSERT INTO members (userId, points, tag, avatarurl)
  VALUES`;
  message.guild.members.fetch()
    .then(members=>{
      members.forEach(member=> {
        if(!member.user.bot) querystring += `(${member.user.id},0,'${member.user.username}','${member.user.avatarURL()}'),`
      })
      querystring = querystring.substring(0, querystring.length - 1)
      querystring += ` ON CONFLICT (userId) DO NOTHING;`
      console.log(querystring);
      pool.query(querystring);
  })
  
}
