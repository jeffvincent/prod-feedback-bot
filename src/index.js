require('dotenv').config();

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const qs = require('querystring');
const trello = require('./trello');
const debug = require('debug')('slash-command-template:index');

const app = express();

/*
 * Parse application/x-www-form-urlencoded && application/json
 */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('<h2>The Slash Command and Dialog app is running</h2> <p>Follow the' +
  ' instructions in the README to configure the Slack App and your environment variables.</p>');
});

/*
 * Endpoint to receive /helpdesk slash command from Slack.
 * Checks verification token and opens a dialog to capture more info.
 */
app.post('/commands', (req, res) => {
  
  // extract the verification token, slash command text,
  // and trigger ID from payload
  const { token, text, trigger_id } = req.body;

  // check that the verification token matches expected value
  if (token === process.env.SLACK_VERIFICATION_TOKEN) {
    // create the dialog payload - includes the dialog structure, Slack API token,
    // and trigger ID
    const dialog = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id,
      dialog: JSON.stringify({
        title: 'Submit product feedback',
        callback_id: 'submit-card',
        submit_label: 'Submit',
        elements: [
          {
            label: 'Title',
            type: 'text',
            name: 'title',
            value: text,
            hint: 'for questions/ideas, ping @jeff',
          },
          {
            label: 'Description',
            type: 'textarea',
            name: 'description',
            placeholder: `Context on the opportunity. Support ticket URL, customers experiencing it, links to recordings, etc.`,
          },
          {
            label: 'Proposed solution',
            type: 'textarea',
            name: 'proposed_solution',
            optional: true,
            placeholder: `What different ways could we solve this? (list lots as applicable)`,
          },
          {
            label: 'Type',
            type: 'select',
            name: 'type',
            options: [
              { label: 'Product feedback: improvements to current product', value: 'feedback' },
              { label: 'Feature request: new powers to add', value: 'feature_request' },
              { label: 'Bugs & issues: Something no worky', value: 'bug' },
            ]
          },
          {
            label: 'Category',
            type: 'select',
            name: 'category',
            options: [
              { label: 'Onboarding', value: 'onboarding' },
              { label: 'Web App', value: 'web_app' },
              { label: 'Flow Builder', value: 'crx' },
              { label: 'SDK', value: 'sdk' },
              { label: 'Mobile', value: 'mobile' },
              { label: 'General UX', value: 'general_ux' },
              { label: 'Other', value: 'other' }
            ],
          }
        ],
      }),
    };
    
    // open the dialog by calling dialogs.open method and sending the payload
    axios.post('https://slack.com/api/dialog.open', qs.stringify(dialog))
      .then((result) => {
        debug('dialog.open: %o', result.data);
        res.send('');
      }).catch((err) => {
        debug('dialog.open call failed: %o', err);
        res.sendStatus(500);
      });
  } else {
    debug('Verification token mismatch');
    res.sendStatus(500);
  }
});

/*
 * Endpoint to receive the dialog submission. Checks the verification token
 * and creates a Trello card
 */
app.post('/interactive-component', (req, res) => {
  const body = JSON.parse(req.body.payload);

  // check that the verification token matches expected value
  if (body.token === process.env.SLACK_VERIFICATION_TOKEN) {
    debug(`Form submission received: ${body.submission.trigger_id}`);

    // immediately respond with a empty 200 response to let
    // Slack know the command was received
    res.send('');

    // create Trello card
    trello.createCard(body.user.id, body.submission);
  } else {
    debug('Token mismatch');
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`App listening on port ${process.env.PORT}!`);
});
