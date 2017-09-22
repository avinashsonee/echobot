var restify = require('restify');
var builder = require('botbuilder');
var pos = require('pos');
var chunker = require('pos-chunker');

// Setup Restify Server
var server = restify.createServer();
// server.listen(process.env.port || process.env.PORT || 3978, function () {
//     console.log('%s listening to %s', server.name, server.url);
// });

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

// Serve a static web page
server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'index.html'
}));

server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url); 
});

var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send("Hey there, I am OGenie! What can I do for you today?");
});

// Add global LUIS recognizer to bot
var luisAppUrl = process.env.LUIS_APP_URL || 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/59acbfb0-7813-4db2-91f1-1598c1b2d49c?subscription-key=d0a91686c3ac4e2abb446a8f5c4062e9';
bot.recognizer(new builder.LuisRecognizer(luisAppUrl));

//Note - Entities expected for completing this dialog are  [$Person.Names ] [$Person.Names ] [$Person.Names ] [$datetimeV2 ]
bot.dialog('/AddCalendar', [
    function (session, args, next) {
        var intent = args.intent;

        var names = builder.EntityRecognizer.findAllEntities(intent.entities, 'Person.Names');
        var datetime = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.datetimeV2.datetime');
        var time = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.datetimeV2.time');
        var date = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.datetimeV2.date');

        var appointment = session.dialogData.appointment = {
            dr_name: names ? concateNames(names) : null,
            date: date ? date.entity : null,
            time: time ? time.entity : null,
            datetime: datetime ? datetime.entity : null,
            prompt_state: 0
        };

        // Prompt for missing Doctor name
        if (!appointment.dr_name) {
            builder.Prompts.text(session, 'With whom would like to schedule an appointment?');
        } else {
            next();
        }
    },
    function (session, results, next) {
        var appointment = session.dialogData.appointment;

        if (results.response) {
            // var names = chunker.chunk(tags, '[{ tag: NNP }]');
            appointment.dr_name = results.response;
        }

        // Prompt for missing date and time
        if (!appointment.date && !appointment.time && !appointment.datetime) {
            builder.Prompts.text(session, 'What day and time?');
            appointment.prompt_state = 1;
        } else if (appointment.time && !appointment.date) {
            builder.Prompts.text(session, 'What day?');
            appointment.prompt_state = 2;
        } else if (appointment.date && !appointment.time) {
            builder.Prompts.text(session, 'What time?');
            appointment.prompt_state = 3;
        } else {
            next();
        }
    },
    function (session, results) {
        var appointment = session.dialogData.appointment;

        if (results.response) {
            if (appointment.prompt_state === 1)
                appointment.datetime = results.response;
            else if(appointment.prompt_state === 2)
                appointment.date = results.response;
            else if(appointment.prompt_state === 3)
                appointment.time = results.response;}

        // All missing details captured so end the dialog
        session.endDialog('Ok, scheduling an appointment with "%s" on "%s"',
            appointment.dr_name, (appointment.datetime ? appointment.datetime : (appointment.date + ' ' + appointment.time)));
    }

]).triggerAction({matches: 'Calendar.Add'});

function concateNames(entities) {
    var str = '';

    entities.forEach(function (name) {
        str += name.entity + ' '
    });

    return str;
}
