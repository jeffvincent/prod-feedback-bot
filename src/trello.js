const axios = require('axios');
const debug = require('debug')('slash-command-template:card');
const qs = require('querystring');
const users = require('./users');

const trelloApi = axios.create({
  baseURL: 'https://api.trello.com/1/',
  timeout: 1000,
  params: {
    key: process.env.TRELLO_KEY,
    token: process.env.TRELLO_ACCESS_TOKEN
  }
});


// 👋 HI! Be sure to read the following comments to make this app work with your Trello account. ✅

// Get your board's from the URL of your Trello board, like 'onACmdbl' if your board's URL is https://trello.com/b/onACmdbl/product-feedback-firehose. Uncomment the following and set it to your own board's id:

//trelloApi.get('/organization/appcues/boards').then(res => {
//  console.log(res.data.filter(board => board.name == "Product Feedback"))
//})

// feedbackBoard = '583ef59fd8bbcbd409ba5293'
// issuesBoard = '583ef534ea189acacdcfedd2'
const boardId = '583ef59fd8bbcbd409ba5293';

//trelloApi.get(`/boards/${boardId}/lists`).then(res => {
//  console.log("Trello board lists:", res.data)
//})


const feedbackList = '5b8585b90a14bc2b75458891';
const issuesList = '59f3384fd3edfd746350817c';

// If you want to apply labels to your Trello cards based on input in the Slack dialog, first create the labels in Trello, then get their ids by uncommenting the following code:

//trelloApi.get(`/boards/${boardId}/labels`).then(response => {
//  console.log("Trello board labels:", response.data)
//})

// Define consts for the labels you care about here, then use those when creating the Trello card (see the 'createCard' method lower down in this file):

// feedback labels
const labels = {
  account: '5b85924b52c2c466b895c620',
  create: '5b8592530a0c2781d5075111',
  target: '5b859258a67e31197c2d4876',
  publish: '5b85925e8d0d394c7b29afc4',
  analyze: '5b8592627d7c6a81c766178f',
  general_ux: '5b8592679f87303b1017fffa',
  feedback: '5b85b6cc0f1f8a598fedafdf',
  feature_request: '5b85b6d1126cf681ff088311',
  nps: '5b86e4a14566116e92cfbfb1',
  kitchen_sink: '',
  bug: ''
}

//
//  Send card creation confirmation via
//  chat.postMessage to the user who created it
//
const sendConfirmation = (card) => {
  const confirmationChannel = card.listId === feedbackList ? '#product-feedback' : '#bugs';
  axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
    token: process.env.SLACK_ACCESS_TOKEN,
    channel: confirmationChannel,
    text: `new ${card.type} from <@${card.userId}>: ${card.title}`,
    attachments: JSON.stringify([
      {
        title: card.title,
        title_link: card.shortUrl,
        text: card.text,
        fields: [
          {
            title: 'Description',
            value: card.description || 'None provided',
          },
        ],
      },
    ]),
  })).then((result) => {
    debug('sendConfirmation: %o', result.data);
  }).catch((err) => {
    debug('sendConfirmation error: %o', err);
    console.error(err);
  });
};

// Create Trello card. Call users.find to get the user's email address
// from their user ID
const createCard = (userId, submission) => {
  const card = {};
  
  // assign the list ID
  if (submission.type === 'bug') {
    card.listId = issuesList
  } else {
    card.listId = feedbackList
  }
  
  // assign the labels
  // note: we're not putting any labels on buggies yet
  if (submission.type != 'bug') {
    card.labelIds = []
    card.labelIds.push(labels[submission.category]);
    card.labelIds.push(labels[submission.type]);
    card.labelIds = card.labelIds.filter(id => id);
  }

  const fetchUserName = new Promise((resolve, reject) => {
    users.find(userId).then((result) => {
      debug(`Find user: ${userId}`);
      console.log("User info:", result.data.user);
      resolve(result.data.user.profile.real_name_normalized);
    }).catch((err) => { reject(err); });
  });

  fetchUserName.then((result) => {
    card.userId = userId;
    card.userRealName = result;
    card.title = submission.title;
    card.description = submission.description;
    card.type = submission.type;
    
    console.log('label ids:', card.labelIds)
    
    trelloApi.post('/cards', qs.stringify({
      idList: card.listId,
      name: submission.title,
      desc: `${submission.description}\n\n---\n Proposed Solution \n ${submission.proposed_solution}\n\n---\n Submitted by ${card.userRealName}`,
      idLabels: card.labelIds
    }))
    .then((response) => {
      card.shortUrl = response.data.shortUrl;
      sendConfirmation(card);
    })
    .catch(function (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);
    });

    return card;
  }).catch((err) => { console.error(err); });
};

module.exports = { createCard, sendConfirmation };
