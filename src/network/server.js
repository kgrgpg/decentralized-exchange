const Link = require('grenache-nodejs-link');
const { PeerRPCServer, PeerPub, PeerSub } = require('grenache-nodejs-ws');
const _ = require('lodash');
const Order = require('../models/Order'); 
const { 
  emitAddOrder, 
  emitDeleteOrder, 
  orderMatchedSubject$, 
  orderUpdatedSubject$, 
  orderAddedSubject$,
  orderRemovedSubject$,
  synchronizeAddOrder,
  synchronizeUpdateOrder,
  synchronizeRemoveOrder
} = require('../services/ordermanagement');
const { fromEvent } = require('rxjs');
const { filter, map } = require('rxjs/operators');

const link = new Link({
  grape: 'http://127.0.0.1:50001'
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

setTimeout(() => {
  // Subscribe to the desired topic
  try {
    // Check if service is available before subscribing
    link.lookup('order_updates', (err, res) => {
      if (err) {
        console.log('Error looking up order_updates:', err);
        console.log('Make sure another server is running before the timeout for peerSub expires.');
        return;
      }
      console.log('Lookup result:', res);
    });
    peerSub.sub('order_updates');
    // Listen for errors on the PeerSub instance
    peerSub.on('error', (error) => {
      console.error('Hello:', error);
    });
    peerSub.on('connected', () => {
      console.log('Subscription connected');
    });
    
    peerSub.on('disconnected', () => {
      console.log('Subscription disconnected');
    });
    
    // Convert PeerSub messages to an Observable stream
    const messageStream$ = fromEvent(peerSub, 'message');
    
    // Process and act on specific message types
    messageStream$.pipe(
      map(msg => JSON.parse(msg)),
      filter(({ action }) => action === 'order_added' || action === 'order_matched' || action === 'order_updated')
    ).subscribe({
      next: ({ action, data }) => {
        // Handle the action appropriately
        switch (action) {
          case 'order_added':
            // Handle order added event
            console.log(`New order added:`, data);
            synchronizeAddOrder(data); 
            break;
          case 'order_matched':
            // Handle order matched event
            console.log(`Order ${data.orderId} matched with ${data.matchedWith}. Executed Quantity: ${data.executedQuantity}`);
            // Function for matching is not needed as it does not alter the order books in itself. Other three actions do.
            break;
          case 'order_updated':
            // Handle order updated event
            console.log(`Order ${data.orderId} updated. New Quantity: ${data.newQuantity}`);
            synchronizeUpdateOrder(data); // Implement update synchronization
            break;
          case 'order_removed':
            // Handle order removed event
            console.log(`Order ${data.orderId} removed.`);
            synchronizeRemoveOrder(data); // Implement removal synchronization
            break;
        }
      },
      error: err => console.error('Error processing message:', err),
      complete: () => console.log('Message stream completed')
    });
  } catch (error) {
    console.error('Error subscribing to order_updates:', error);
  }

}, 6000);

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

// Subscribing to order removed events and broadcasting them
orderRemovedSubject$.subscribe(removedInfo => {
  broadcastMessage(removedInfo); // removedInfo already includes action and data
});
