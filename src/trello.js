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

// HINT: use the board IDs are stored in env file

//trelloApi.get(`/boards/${boardId}/lists`).then(res => {
//  console.log("Trello board lists:", res.data)
//})

// If you want to apply labels to your Trello cards based on input in the Slack dialog, first create the labels in Trello, then get their ids by uncommenting the following code:

//trelloApi.get(`/boards/${boardId}/labels`).then(response => {
//  console.log("Trello board labels:", response.data)
//})

// Define consts for the labels you care about here, used when creating card below.
// note: include empty string for user-assigned values without a label, otherwise you'll get Trello error.
const labels = {
  onboarding: '5bf31bc43cb5ca740bffba45',
  web_app: '5bf48abe3c6a551c772c595b',
  crx: '5bf48ac7585e310ad5f533ba',
  sdk: '5bf48ad2966b9c5506cc0575',
  mobile: '5bfed5006bc6e811965f565b',
  other: '',
  general_ux: '5b8592679f87303b1017fffa',
  feature_request: '5b85b6d1126cf681ff088311',
  feedback: '',
  bug: ''
}

//
//  Send card creation confirmation via
//  chat.postMessage to the user who created it
//
const sendConfirmation = (card) => {
  
  // send all non-bugs feedback into #product-feedback
  const confirmationChannel = card.listId === process.env.ISSUES_LIST_ID ? '#bugs' : '#product-feedback'
  
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
  let userRealName = null;
  let trelloMemberId = null;
  
  console.log("submission: ", submission);
  
  // assign to the right list, on the right board
  if (submission.type === 'bug') {
    card.listId = process.env.ISSUES_LIST_ID
  } else if (submission.category === 'onboarding') {
    card.listId = process.env.ONBOARDING_LIST_ID
  } else {             
    card.listId = process.env.FEEDBACK_LIST_ID
  }
  
  // assign the labels
  // note: we're not putting any labels on buggies yet
  if (submission.type != 'bug') {
    card.labelIds = []
    card.labelIds.push(labels[submission.category]);
    card.labelIds.push(labels[submission.type]);
    card.labelIds = card.labelIds.filter(id => id);
    card.labelIds = card.labelIds.join();
  }

  const fetchUserName = new Promise((resolve, reject) => {
    users.find(userId).then((result) => {
      debug(`Find user: ${userId}`);
      resolve(result.data.user.profile.real_name_normalized);
    }).catch((err) => { reject(err); });
  });
  
  const fetchTrelloMemberId = new Promise((resolve, reject) => {
    trelloApi.get('/organization/appcues/members').then((response) => {
      console.log('userRealName is set as: ', userRealName);
      let member = response.data.filter(m => m.fullName === userRealName);
      console.log('member is: ', member[0]);
      resolve(member && member[0] && member[0].id);
    }).catch((err) => { reject(err); });
  });

  fetchUserName.then((result) => {
    userRealName = result;
    return fetchTrelloMemberId;
  }).then((result) => {
    console.log('result: ', result);
    card.userId = userId;
    card.userRealName = userRealName;
    card.title = submission.title;
    card.description = submission.description;
    card.type = submission.type;
    card.memberIds = [result];
    
    console.log('trelloMemberid: ', result, card.memberIds);
    
    trelloApi.post('/cards', qs.stringify({
      idList: card.listId,
      name: submission.title,
      desc: `${submission.description}\n\n---\n Proposed Solution \n ${submission.proposed_solution}\n\n---\n Submitted by ${card.userRealName}`,
      idLabels: card.labelIds,
      idMembers: card.memberIds
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
