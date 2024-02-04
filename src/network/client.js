const Link = require('grenache-nodejs-link');
const { PeerRPCClient } = require('grenache-nodejs-ws');
const Order = require('../models/order');
const moment = require('moment');
const crypto = require('crypto');

const link = new Link({
  grape: 'http://127.0.0.1:30001'
});
link.start();

const peer = new PeerRPCClient(link, {});
peer.init();

/*
* Generate a Unique Identifier for Each Peer
* When the peer starts, generate a unique identifier
* This could be based on a hash of the current timestamp,
* a random number, or other system-specific information
* that remains constant for the lifetime of the peer.

* Incorporate this Identifier into the Order ID: Include this unique identifier in the order ID
* along with the timestamp and a sequence number.
*/ 
let sequenceNum = 0;

// Generate a unique hash for this peer instance
const peerId = crypto.createHash('sha256').update(moment().toISOString() + Math.random().toString()).digest('hex').substr(0, 6); // Short hash of 6 characters

function generateOrderId() {
  const timestamp = moment().format('YYYYMMDDHHmmssSSS');
  sequenceNum += 1;
  return `order_${peerId}_${timestamp}_${sequenceNum}`;
}

function sendOrder() {
  const actionType = Math.random() > 0.5 ? 'ADD_ORDER' : 'DELETE_ORDER';
  let payload;

  if (actionType === 'ADD_ORDER') {
    const orderId = generateOrderId();
    // Randomly choose between 'buy' and 'sell' order types
    const orderType = Math.random() > 0.5 ? 'buy' : 'sell';
    // Randomly generate order price and quantity
    const orderPrice = 100 + Math.floor(Math.random() * 10);
    const orderQuantity = 1 + Math.floor(Math.random() * 5);
    const newOrder = new Order(orderId, orderPrice, orderQuantity, orderType);

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
