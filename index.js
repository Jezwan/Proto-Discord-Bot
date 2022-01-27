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

const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS"] });

client.once('ready', () => {
  console.log(`Ready!. Logged in as ${client.user.tag}`);
})



client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith("proto")) return;
  commands = processCommand(message.content);

  // message.reply(JSON.stringify(commands)); // uncomment for debugging

  if (commands[0] === "give") {
    if (!message.member.roles.cache.some(role => role.name === 'LEAD')) {
      message.reply("Command reserved for Leadership roles");
      return;
    }
    userId = processUserId(commands[1]);
    if (userId === commands[1]) message.reply("Invalid user !");
    else if (isValidGuildMember(message.guild, userId)) {
      if (!isNaN(commands[2])) {
        givePoints(userId, commands[2], message, pool);
        message.reply(`<@${userId}> is given ${commands[2]}`)

      }
      else message.reply("Invalid command!. points should be a number!`");
    }
    else message.reply("Invalid command!. try `proto points`");
  }
  // else if (commands[0] === "points") {
  //   if(commands[1] === undefined) userId = message.author.id;
  //   else userId = processUserId(commands[1]);

  //   if (isValidGuildMember(message.guild, userId) && userId !== '758186429549117472') { // Sharan's userid
  //     getPointsByUserId(userId, message, pool).catch(console.log);
  //   }
  //   else message.reply("Invalid userid entered!")
  // }
  else if (commands[0] === "top") {
    getTopRank(message, pool);
  }
  else if (commands[0] === "init") {
    initialise(message, pool).catch(console.log);
  }
  else if (commands[0] === "delete") {
    if (message.member.roles.cache.some(role => role.name === 'LEAD') || message.member.roles.cache.some(role => role.name === 'ADMIN')) {
      if (commands[1] === undefined){
        message.reply("Invalid username!")
        return
      }
      else {
        userId = processUserId(commands[1]);
        if (isValidGuildMember(message.guild, userId)){
          deleteMember(userId).catch(console.log);
        }
      }
    }
    else {
      message.reply("Command reserved for Leadership roles");
      return;
    }
  }
  else if (commands[0] === "points") {
    if(commands[1] === undefined) userId = message.author.id;
    else userId = processUserId(commands[1]);

    if (isValidGuildMember(message.guild, userId) && userId !== '758186429549117472') { // Sharan's userid
      embedUser(userId, message);
    }
    else message.reply("Invalid userid entered!")
  }
  else message.reply("Invalid command!. `proto points @user`");

});

client.login(token);

//////////////////////////
function processUserId(userId) {
  if (userId === undefined) return undefined;
  if (userId.startsWith('<@') && userId.endsWith('>')) {
    userId = userId.slice(2, -1);

    if (userId.startsWith('!')) {
      userId = userId.slice(1);
    }
    return userId;
  }
}

function processCommand(command) {
  const commandBody = command.slice(5).toLowerCase();
  const args = commandBody.split(' ');
  const commands = args.filter(e => e);
  return commands;
}

async function givePoints(userId, points, message, pool) {
  pool
    .connect()
    .then(client => {
      message.guild.members.fetch(userId).then(promise => {
        return client
          .query(`
      INSERT INTO members (userId, points, tag, avatarurl)
      VALUES(${userId}, ${points}, '${promise.user.username}', '${promise.user.avatarURL()}') 
      ON CONFLICT (userId) 
      DO UPDATE SET 
      points = members.points + ${points},
      tag = '${promise.user.username}',
      avatarurl = '${promise.user.avatarURL()}';`)
      })
        .then(() => {
          client.release()
        })
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })


}

function isValidGuildMember(guild, userId) {
  if (userId === undefined) return false;
  else if (userId.startsWith('&')) return false;
  return guild.members.fetch(userId);
}

async function getAllRows(pool) {
  await pool.connect();
  const res = await pool.query('SELECT * FROM members');
  console.log(res.rows) // Hello world!
  return res;
}

async function getTopRank(message, pool) {
  pool.connect()
    .then(client => {
      return client
        .query(`SELECT * FROM members
      WHERE points = (
         SELECT MAX (points)
         FROM members
      );`)
        .then(res => {
          client.release()
          return res
        })
        .then(users => users.rows.map(user => message.reply(`<@${user.userid}>:${user.points}`)))
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })

}

async function getPointsByUserId(userId, message, pool) {

  pool
    .connect()
    .then(client => {
      return client
        .query(`SELECT * FROM members WHERE userid = '${userId}';`)
        .then(res => {
          client.release()
          return res
        })
        .then(user => message.reply(`<@${user.rows[0].userid}>:${user.rows[0].points}`))
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })

}

async function initialise(message, pool) {
  await pool.connect();
  querystring = `INSERT INTO members (userId, points, tag, avatarurl)
  VALUES`;
  message.guild.members.fetch()
    .then(members => {
      members.forEach(member => {
        if (!member.user.bot && member.user.id !== '758186429549117472') querystring += `(${member.user.id},0,'${member.user.username}','${member.user.avatarURL()}'),`
      })
      querystring = querystring.substring(0, querystring.length - 1) // for removing trailing comma of last entry
      querystring += ` ON CONFLICT (userId) DO NOTHING;`
      console.log(querystring);
      pool.query(querystring);

    })

}

async function deleteMember(userId){
  pool
    .connect()
    .then(client => {
      return client
        .query(`DELETE FROM members WHERE userid = '${userId}';`)
        .then(res => {
          client.release()
          return res
        })
        .then(user => message.reply(`<@${userId}> is removed from database`))
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })
}

function embedUser(userId, message){
  
  pool
    .connect()
    .then(client => {
      return client
        .query(`SELECT * FROM members WHERE userid = '${userId}';`)
        .then(res => {
          client.release()
          return res
        })
        .then(user =>{
        const exampleEmbed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle(`${user.rows[0].tag}  ${user.rows[0].points} cube points`)
      if(user.rows[0].avatarurl !== 'null')
        exampleEmbed.setImage(`${user.rows[0].avatarurl}`)
      else
        exampleEmbed.setImage(`https://cube-dashboard-backend.herokuapp.com/null`)
      message.reply({ embeds: [exampleEmbed] });
       })
        .catch(err => {
          console.log(err.stack)
        })
    })

  
}