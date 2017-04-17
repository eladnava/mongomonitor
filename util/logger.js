var log = require('npmlog');
var mailer = require('./mailer');

exports.notifyError = function (error, config, subject) {
    // Fallback to generic subject
    subject = subject || 'Health Check Failed';

    // Log error to CLI
    log.error('mongomonitor', new Date(), error.message);

    // Generate e-mail using mailgen
    var mail = mailer.generate({
        body: {
            title: subject,
            intro: error.message,
            outro: 'We thank you for choosing mongomonitor.'
        }
    });

    // Send mail via mailer
    mailer.sendMail({
        from: config.smtp.address,
        to: config.smtp.address,
        subject: `[mongomonitor] ${subject}`,
        html: mail.html,
        text: mail.text
    }, config);
};