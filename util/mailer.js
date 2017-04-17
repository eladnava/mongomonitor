var log = require('npmlog');
var crypto = require('crypto');
var Mailgen = require('mailgen');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var transport;

// Configure mailgen with product branding
var mailGenerator = new Mailgen({
    theme: 'salted',
    product: {
        name: 'mongomonitor',
        link: 'https://github.com/eladnava/mongomonitor'
    }
});

// Keep track of e-mails previously sent to avoid spamming the same e-mail constantly
var emailHistory = {};

exports.generate = function (options) {
    // Use mailgen to generate the email HTML body and plaintext version
    return {
        html: mailGenerator.generate(options),
        text: mailGenerator.generatePlaintext(options)
    };
};

exports.sendMail = function (mail, config) {
    // Initialize and cache transport object
    if (!transport) {
        transport = nodemailer.createTransport(smtpTransport(config.smtp));
    }

    // Get current unix timestamp in ms
    var now = new Date().getTime();

    // Calculate unique e-mail identifier for this e-mail's contents
    var emailIdentifier = crypto.createHash('sha256').update(mail.text).digest('hex');

    // Make sure we're not spamming the same e-mail constantly (check that at least 30 minutes passed)
    if (emailHistory[emailIdentifier] && emailHistory[emailIdentifier] > now - (60 * 1000 * 30)) {
        return;
    }

    // We're going to send an e-mail now
    emailHistory[emailIdentifier] = now;

    // Prevent Gmail/Inbox grouping / truncating e-mails
    if (mail.html) {
        mail.headers = { 'X-Entity-Ref-ID': 1 };
    }

    // Send it via transport
    transport.sendMail(mail).catch(function(err) {
         // Log error to CLI
        log.error('mongomonitor', 'Failed to send e-mail: ', err);
    });
};