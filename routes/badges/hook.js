// hook.js
// process automatic requests to webhook ("hook" from reviewer and "accept" from earner)

var express = require('express');
var router = express.Router();
var http = require("http");
var jws = require('jws');
var logfmt = require("logfmt");
var crypto = require("crypto");
var qs = require("qs");
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
var sendgrid = require('sendgrid')(process.env.SG_USER, process.env.SG_PW);

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(logfmt.requestLogger());

router.post('/', function (req, res) {

    console.log("request to hook.js arrived");
    console.log("request headers are ");
    console.log(req.headers);
    var token = req.headers.authorization;
    token = token.slice(token.indexOf('"') + 1, -1);
    if (!jws.verify(token, 'HS256', process.env.BK_SECRET)) { //use your secret
        console.log("verification failed");
    }
    else {
        //process the data
        var decodedToken;
        try {
            decodedToken = jws.decode(token);
            console.log("decodedToken:");
            console.log(decodedToken);
            if (decodedToken.payload.body.hash !== crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')) {
                console.log("body hash does not match token hash");
                }
            else {
                //process review data
//                console.log("request body: ");
//                console.log(req.body);
                var action = req.body.action;
                var info = "";
                var emailTo = "";
                switch (action) {
                    //review event
                    case 'review':
                        //earner email
                        emailTo = req.body.application.learner;
                        //build badge name into email
                        info += "<p>Your application for the following badge was reviewed:" +
                            "<strong>" + req.body.application.badge.name + "</strong></p>";

                        //respond differently if approved or not
                        if (req.body.approved) {
                            info += "<p>Great news - your application was approved!</p>";
                            //include link to accept the badge
                            // - alter for your url
                            info += "<p><a href=" +
                                "'http://shielded-beach-7575.herokuapp.com/accept?badge=" +
                                req.body.application.badge.slug +
                                "&earner=" + req.body.application.learner +
                                "&application=" + req.body.application.slug +
                                "'>Accept your badge</a></p>";
                        }
                        else {
                            info += "<p>Unfortunately your application was unsuccessful this time. " +
                                "You can re-apply for the badge any time though!</p>";
                        }
                        //review includes multiple feedback and comment items
                        info += "<p>The reviewer included feedback for you:</p>";
                        info += "<ul>";
                        //comment field includes everything in the Finish page in BadgeKit Web app
                        info += "<li><em>" + req.body.review.comment + "</em></li>";
                        //review items array, one per criteria - build into list
                        var reviewItems = req.body.review.reviewItems;
                        console.log("reviewItems check: ",reviewItems);
                        var r;
                        for (r = 0; r < reviewItems.length; r++) {
                            info += "<li><em>" + reviewItems[r].comment + "</em></li>";
                            //can also include whether each criteria item was satisfied
                        }
                        info += "</ul>";
                        info += "<p><strong><em>Thanks for applying!</em></strong></p>";

                        //send email to earner with information from reviewer and link (if approved) for accepting badge
                        //I think nodemailer has been updated such that some of the code below is out of date?
/*                        var transporter = nodemailer.createTransport();
                        transporter.sendMail({
                            from: "Badge Issuer <happer@hotmail.com>", //your email
                            to: emailTo,
                            subject: "Badge", //your subject
                            generateTextFromHTML: true,
                            html: info
                        });
*/
                        //trying to work with sendgrid instead
                        sendgrid.send({
                            to: emailTo,
                            from: process.env.EMAIL,
                            subject: 'Badge via sendgrid',
                            text: 'My first email through SendGrid. html version should have badge information',
                            html: info
                        }, function (err, json) {
                            if (err) { return console.error(err); }
                            console.log(json);
                        });
                        console.log("info string is ", info);

                        break;

                    case 'award':
                        //process award hook
                        emailTo = req.body.email;
                        info += "<p>You've been awarded this badge:</p>";
                        info += "<img src='" + req.body.badge.imageUrl + "' alt='badge'/>";
                        info += "<p><a href='http://shielded-beach-7575.herokuapp.com/viewBadge?assertion=" +
                            req.body.assertionUrl +
                            "'>View Badge</a></p>";
                        //can offer to push to backpack etc
                        sendgrid.send({
                            to: emailTo,
                            from: 'happer@hotmail.com',
                            subject: 'your badge!',
                            text: 'Your badge has been processed',
                            html: info
                        }, function (err, json) {
                            if (err) { return console.error(err); }
                            console.log(json);
                        });

                        break;
                }
            }
        } catch (err) {
            console.log("error decoding the data", err);
        }
    }
});


module.exports = router;
