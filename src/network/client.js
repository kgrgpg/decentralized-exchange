const Link = require('grenache-nodejs-link');
const { PeerRPCClient } = require('grenache-nodejs-ws');
const Order = require('../models/order');
const moment = require('moment');

const link = new Link({
  grape: 'http://127.0.0.1:30001'
});
link.start();

const peer = new PeerRPCClient(link, {});
peer.init();

let sequenceNum = 0;

function generateOrderId() {
  const timestamp = moment().format('YYYYMMDDHHmmssSSS');
  sequenceNum += 1;
  return `order_${timestamp}_${sequenceNum}`;
}

function sendOrder() {
  const actionType = Math.random() > 0.5 ? 'ADD_ORDER' : 'DELETE_ORDER';
  let payload;

  if (actionType === 'ADD_ORDER') {
    const orderId = generateOrderId();
    const newOrder = new Order(orderId, 100 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 5), 'buy');
    payload = { type: 'ADD_ORDER', order: newOrder };
  } else {
    // For DELETE_ORDER, you need to provide valid order IDs. This part depends on how you track or store orders.
    const orderIdToDelete = 'someValidOrderId'; // Replace with actual logic to determine which order to delete
    payload = { type: 'DELETE_ORDER', orderId: orderIdToDelete };
  }

  peer.request('rpc_test', payload, { timeout: 10000 }, (err, data) => {
    if (err) {
      console.error('Request Error:', err);
      return;
    }
    console.log('Response from server:', data);
  });
}

setInterval(() => {
  sendOrder();
}, 2000);
