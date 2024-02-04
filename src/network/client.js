const { from, interval, timer, of } = require('rxjs');
const { switchMap, catchError, retryWhen, delayWhen, tap, finalize } = require('rxjs/operators');
const Link = require('grenache-nodejs-link');
const { PeerRPCClient, PeerSub } = require('grenache-nodejs-ws');
const Order = require('../models/Order');
const moment = require('moment');
const crypto = require('crypto');
const { set } = require('lodash');

// Initialize Grenache Link and PeerRPCClient
const link = new Link({ grape: 'http://127.0.0.1:60001' });
link.start();
const peer = new PeerRPCClient(link, {});
peer.init();

setTimeout(() => {
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
    // Currently orderbooks are only updated by the servers. These messages are for informational purposes only.
    // In a real-world scenario, the client can also have access to complete orderbook and its updates.
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
  } catch (error) {
    console.error('Error subscribing to order_updates:', error);
  }
}, 6000);

// Generate a unique identifier for the peer
const peerId = crypto.createHash('sha256').update(`${moment().toISOString()}${Math.random()}`).digest('hex').substr(0, 6);
let sequenceNum = 1;
let addedOrderIds = []; // Store for added order IDs

// Function to create an observable for order requests
const createOrderObservable = (actionType) => {
  let payload;
  if (actionType === 'ADD_ORDER') {
    const order = new Order(peerId, 100 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 5), Math.random() > 0.5 ? 'buy' : 'sell', sequenceNum++);
    payload = { type: actionType, order: order };
    // Store the order ID for future deletion
    addedOrderIds.push(order.id);
  } else {
    // Choose a random order ID from the list of added orders for deletion
    const orderIdToDelete = addedOrderIds.length > 0 ? addedOrderIds.shift() : 'no-valid-order'; // Fallback if no valid order exists
    payload = { type: actionType, orderId: orderIdToDelete, timestamp: new Date().toISOString() };
  }

  return from(new Promise((resolve, reject) => {
    peer.request('order_service', payload, { timeout: 10000 }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })).pipe(
    catchError(error => {
      // Log and rethrow error for retryWhen to catch
      console.error('Error in request:', error);
      return of(`Request failed: ${error.message}`); // Handling the error and transforming it into a recoverable state
    })
  );
};

// Interval observable for sending orders
const orderRequestInterval$ = interval(1000).pipe(
  switchMap(() => createOrderObservable(Math.random() > 0.5 ? 'ADD_ORDER' : 'DELETE_ORDER')),
  retryWhen(errors =>
    errors.pipe(
      tap(err => console.log(`Error encountered: ${err.message}. Retrying...`)),
      delayWhen((_, attemptIndex) => timer(attemptIndex * 1000)),
      finalize(() => console.log('All retries completed or an unrecoverable error encountered.'))
    )
  )
);

// Subscription to the interval observable
orderRequestInterval$.subscribe({
  next: response => console.log('Response from server:', response),
  error: err => console.error('Observable encountered an error:', err),
  complete: () => console.log('Observable completed')
});
