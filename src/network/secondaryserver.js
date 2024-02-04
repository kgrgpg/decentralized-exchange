// This is an intermediate server script created to simulate a secondary server in the Grenache network.
// The DHT is already running with two clients and a primary server. Without stopping the server, we enhance the server script to enable server-to-server communication.
// It will be deleted once the server-to-server communication is established, and then the two server scripts will be merged into a single script.

const Link = require('grenache-nodejs-link');
const { PeerRPCServer, PeerPub, PeerSub } = require('grenache-nodejs-ws');
const _ = require('lodash');
const Order = require('../models/Order'); 
const { 
  emitAddOrder, 
  emitDeleteOrder, 
  orderMatchedSubject$, 
  orderUpdatedSubject$, 
  orderAddedSubject$ 
} = require('../services/ordermanagement');

const link = new Link({
  grape: 'http://192.168.1.29:50001'
});
link.start();

const peerRPC = new PeerRPCServer(link, {});
peerRPC.init();

const serviceRPC = peerRPC.transport('server');
serviceRPC.listen(_.random(1000) + 1024);

setInterval(() => {
  link.announce('order_service', serviceRPC.port, {});
}, 1000);

const peerPub = new PeerPub(link, {});
peerPub.init();

const servicePub = peerPub.transport('server');
servicePub.listen(_.random(1000) + 2000); // Listen on a different port for publishing

setInterval(() => {
  link.announce('order_updates', servicePub.port, {});
}, 1000);

// Initialize PeerSub for listening to broadcasts
const peerSub = new PeerSub(link, {});
peerSub.init();

// Subscribe to the desired topic
peerSub.sub('order_updates', { timeout: 10000 });

peerSub.on('connected', () => {
  console.log('Subscription connected');
});

peerSub.on('disconnected', () => {
  console.log('Subscription disconnected');
});

// Handle incoming messages
peerSub.on('message', (msg) => {
  console.log('Received Raw message:', msg);
  try {
    const parsedMsg = JSON.parse(msg);
    const { action, data } = parsedMsg;

    console.log(`Received ${action} message:`, data);

    switch (action) {
      case 'order_matched':
        // Handle order matched event
        console.log(`Order ${data.orderId} matched with ${data.matchedWith}. Executed Quantity: ${data.executedQuantity}`);
        break;
      case 'order_updated':
        // Handle order updated event
        console.log(`Order ${data.orderId} updated. New Quantity: ${data.newQuantity}`);
        break;
      case 'order_added':
        // Handle order added event
        console.log(`New order added:`, data);
        break;
      default:
        console.warn(`Unknown action type received: ${action}`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

serviceRPC.on('request', (rid, key, payload, handler) => {
  console.log('Received payload:', payload);
  
  switch (payload.type) {
    case 'ADD_ORDER':
      // Assuming payload.order contains all necessary information
      const newOrder = new Order(
        payload.order.peerId, 
        payload.order.price, 
        payload.order.quantity, 
        payload.order.type, 
        payload.order.sequenceNumber
      );
      newOrder.timestamp = payload.order.timestamp; // Ensure the timestamp from client is preserved
      emitAddOrder(newOrder);
      break;
    case 'DELETE_ORDER':
      // For DELETE_ORDER, directly use payload.orderId
      // Include the deletion timestamp in the deletion event
      emitDeleteOrder({ orderId: payload.orderId, timestamp: payload.timestamp });
      break;
  }

  handler.reply(null, 'Order processed');
});

const broadcastMessage = (message) => {
  // Directly use the message object which includes both action and data
  servicePub.pub(JSON.stringify(message));
};

// Subscribing to order matched events and broadcasting them
orderMatchedSubject$.subscribe(matchInfo => {
  broadcastMessage(matchInfo); // matchInfo already includes action and data
});

// Subscribing to order updated events and broadcasting them
orderUpdatedSubject$.subscribe(updateInfo => {
  broadcastMessage(updateInfo); // updateInfo already includes action and data
});

// Subscribing to order added events and broadcasting them
orderAddedSubject$.subscribe(addedInfo => {
  broadcastMessage(addedInfo); // addedInfo already includes action and data
});