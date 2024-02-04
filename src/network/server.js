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
  grape: 'http://127.0.0.1:30001'
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

const broadcastMessage = (topic, message) => {
  // Using the correct method for publishing messages based on the Grenache example
  servicePub.pub(topic, JSON.stringify(message));
};

// Subscriptions to internal order events for broadcasting
orderMatchedSubject$.subscribe(matchInfo => {
  broadcastMessage('order_matched', matchInfo);
});

orderUpdatedSubject$.subscribe(updateInfo => {
  broadcastMessage('order_updated', updateInfo);
});

orderAddedSubject$.subscribe(addedInfo => {
  broadcastMessage('order_added', addedInfo);
});