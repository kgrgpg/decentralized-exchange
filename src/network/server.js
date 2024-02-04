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
  grape: 'http://192.168.1.18:30001'
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
