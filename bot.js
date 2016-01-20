/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
          \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
           \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


*/

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var url = 'mongodb://localhost:27017/botkit';


var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

controller.hears(['add link (.*)'],'direct_message,direct_mention,mention',function(bot, message) {
    var matches = message.text.match(/add link (.*)/i);
    var link = matches[1];
    console.log(link);
    console.log('Message Link ' + link);
    console.log(message.user);

    var user = message.user;
    var tags = '';

    bot.startConversation(message,function(err, convo) {
        convo.ask('What tag would you like to add?', function(message, callback){
            tags = message.text;
            console.log(tags);
            convo.say("I have added the link with your tag!");
            convo.next();
            MongoClient.connect(url, function(err, db) {
              assert.equal(null, err);
              insertLink(db, message, message.user, link, tags, function() {
                  db.close();
              });
            });
        });
    });
});

controller.hears(['get links'],'direct_message,direct_mention,mention',function(bot, message) {
    MongoClient.connect(url, function(err, db) {
      assert.equal(null, err);
      findLink(db, message, '', function() {
          db.close();
      });
    });
});



controller.hears(['bring links with tag (.*)'],'direct_message,direct_mention,mention',function(bot, message) {
//start conversation for what tags they would like
    var matches = message.text.match(/bring links with tag (.*)/i);
    var tag = matches[1];
    console.log('This is the tag:' + tag);


    MongoClient.connect(url, function(err, db) {
      assert.equal(null, err);
      findLinkWithTag(db, message, tag, function() {
          db.close();
      });
    });
});


var findLink = function(db, message, tag, callback) {
   var cursor = db.collection('links').find( { "user": message.user} );
   bot.reply(message, "Getting links, to get links with a specific tag, say 'bring link with tag <tag>'");

   cursor.each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
         console.dir(doc);
         var string = doc.link
         string = string.replace(/[\<\>]/g,'*');
         console.log(string);
         string += " tagged as: " + doc.tags;
         bot.reply(message, string);
      } else {
         callback();
      }
   });
};

var findLinkWithTag = function(db, message, tag, callback) {
    console.log('Tag: ' + tag);
    tag = tag.toLowerCase();
    bot.reply(message, 'If you don\'t have any, I probably won\'t say anything...');
    var cursor = db.collection('links').find( { "user": message.user, "tags": tag} );
    cursor.each(function(err, doc) {
    assert.equal(err, null);
    if (doc != null) {
         console.dir(doc);
         var string = doc.link
         string = string.replace(/[\<\>]/g,'*');
         console.log(string);
         string += " tagged as: " + doc.tags;
         bot.reply(message, string);
      } else {
         callback();
      }
   });
};

var insertLink = function(db, message, user, link, tags, callback) {
    tags = tags.toLowerCase();
    db.collection('links').insertOne( {
        "user" : user,
        "link" : link,
        "tags" : tags
    }, function(err, result) {
    assert.equal(err, null);
    console.log("Inserted a document into the link collection.");
    callback(result);
  });
};


controller.hears(['help','about'],'direct_message,direct_mention,mention',function(bot, message) {


    controller.storage.users.get(message.user,function(err, user) {
        var outputMessage = '';
        if (user && user.name) {
            outputMessage = 'Hello ' + user.name + '!!';
        } else {
            outputMessage = 'Hello.';
        }

        outputMessage += '\n\n These are the commands that I can respond to at the moment. \n\nhello or hi - Say hello to me \ncall me "name" - Tell me your name and I will respond to you by name. \nuptime - I will tell you a little about myself\nadd link <link> - This will add a link to for you to be retrieved later.\nget links - will return your links\nbring links with tag <tag> - Will return links of a speific tag'
        bot.reply(message,outputMessage);
    });
});


controller.hears(['hello','hi'],'direct_message,direct_mention,mention',function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    },function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(',err);
        }
    });


    controller.storage.users.get(message.user,function(err, user) {
        if (user && user.name) {
            bot.reply(message,'Hello ' + user.name + '!!');
        } else {
            bot.reply(message,'Hello.');
        }
    });
});

controller.hears(['call me (.*)'],'direct_message,direct_mention,mention',function(bot, message) {
    var matches = message.text.match(/call me (.*)/i);
    var name = matches[1];
    controller.storage.users.get(message.user,function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user,function(err, id) {
            bot.reply(message,'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name','who am i'],'direct_message,direct_mention,mention',function(bot, message) {

    controller.storage.users.get(message.user,function(err, user) {
        if (user && user.name) {
            bot.reply(message,'Your name is ' + user.name);
        } else {
            bot.reply(message,'I don\'t know yet!');
        }
    });
});


controller.hears(['shutdown'],'direct_message,direct_mention,mention',function(bot, message) {

    controller.storage.users.get(message.user,function(err, user) {
        if (user && (user.name == 'chris' || user.name == 'Chris')) {
            bot.startConversation(message,function(err, convo) {
                convo.ask('Are you sure you want me to shutdown?',[
                    {
                        pattern: bot.utterances.yes,
                        callback: function(response, convo) {
                            convo.say('Bye!');
                            convo.next();
                            setTimeout(function() {
                                process.exit();
                            },3000);
                        }
                    },
                {
                    pattern: bot.utterances.no,
                    default: true,
                    callback: function(response, convo) {
                        convo.say('*Phew!*');
                        convo.next();
                    }
                }
                ]);
            });
        } else {
            bot.reply(message,"Only @chris_p can shut me down!");
        }


    });

});


controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot, message) {

    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name + '>. I have been running for ' + uptime + ' on ' + hostname + '.');

});

controller.on('user_channel_join',function(bot,message) {
    bot.reply(message, 'Welcome to the channel! My name is thinkbot! If you need help, please type `thinkbot help` and I\'ll see what I can do!');
});


controller.hears(['question me'],['direct_message','direct_mention','mention','ambient'],function(bot,message) {

  // start a conversation to handle this response.
  bot.startConversation(message,function(err,convo) {

    convo.ask('Shall we proceed Say YES, NO or DONE to quit.',[
      {
        pattern: 'done',
        callback: function(response,convo) {
          convo.say('OK you are done!');
          convo.next();
        }
      },
      {
        pattern: bot.utterances.yes,
        callback: function(response,convo) {
          convo.say('Great! I will continue...');
          // do something else...
          convo.next();

        }
      },
      {
        pattern: bot.utterances.no,
        callback: function(response,convo) {
          convo.say('Perhaps later.');
          // do something else...
          convo.next();
        }
      },
      {
        default: true,
        callback: function(response,convo) {
          // just repeat the question
          convo.repeat();
          convo.next();
        }
      }
    ]);
  })
});










function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
